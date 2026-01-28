require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuid } = require('uuid');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const http = require('http');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

// ═══════════════════════════════════════════════════════════
// SOCKET.IO SETUP
// ═══════════════════════════════════════════════════════════
const { EVENTS, handlers, wsService } = require('./services/websocket');

// Socket.IO integration (conditionally loaded)
let io = null;
try {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);
    wsService.connect(socket.id, { socketId: socket.id });

    // Client events
    socket.on(EVENTS.CLIENT.JOIN_TABLE, (data) => {
      const result = handlers[EVENTS.CLIENT.JOIN_TABLE](wsService, socket.id, data);
      socket.join(`table:${data.tableId}`);
      socket.join(`session:${data.sessionId}`);
      socket.emit(EVENTS.SERVER.SESSION_JOINED, result);
    });

    socket.on(EVENTS.CLIENT.NEW_ORDER, (data) => {
      const result = handlers[EVENTS.CLIENT.NEW_ORDER](wsService, socket.id, data);
      io.to(`kitchen:${data.restaurantId}`).emit(EVENTS.SERVER.ORDER_CREATED, data.order);
      socket.emit('order:confirmed', result);
    });

    socket.on(EVENTS.CLIENT.CALL_WAITER, (data) => {
      const result = handlers[EVENTS.CLIENT.CALL_WAITER](wsService, socket.id, data);
      io.to(`staff:${data.restaurantId}`).emit(EVENTS.SERVER.WAITER_NOTIFIED, {
        tableId: data.tableId,
        tableNumber: data.tableNumber,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on(EVENTS.CLIENT.REQUEST_BILL, (data) => {
      handlers[EVENTS.CLIENT.REQUEST_BILL](wsService, socket.id, data);
      io.to(`staff:${data.restaurantId}`).emit('bill:requested', {
        tableId: data.tableId,
        tableNumber: data.tableNumber,
      });
    });

    // Kitchen events
    socket.on(EVENTS.KITCHEN.JOIN_KITCHEN, (data) => {
      const result = handlers[EVENTS.KITCHEN.JOIN_KITCHEN](wsService, socket.id, data);
      socket.join(`kitchen:${data.restaurantId}`);
      socket.emit('kitchen:joined', result);
    });

    socket.on(EVENTS.KITCHEN.UPDATE_STATUS, (data) => {
      handlers[EVENTS.KITCHEN.UPDATE_STATUS](wsService, socket.id, data);
      io.to(`table:${data.tableId}`).emit(EVENTS.SERVER.ORDER_UPDATED, {
        orderId: data.orderId,
        status: data.status,
      });
      io.to(`kitchen:${data.restaurantId}`).emit(EVENTS.SERVER.ORDER_UPDATED, {
        orderId: data.orderId,
        status: data.status,
      });
      
      // Special notification when order is ready
      if (data.status === 'ready') {
        io.to(`table:${data.tableId}`).emit(EVENTS.SERVER.ORDER_READY, {
          orderId: data.orderId,
          message: '¡Tu pedido está listo!',
        });
      }
    });

    socket.on(EVENTS.KITCHEN.BUMP_ORDER, (data) => {
      handlers[EVENTS.KITCHEN.BUMP_ORDER](wsService, socket.id, data);
      io.to(`kitchen:${data.restaurantId}`).emit('order:bumped', {
        orderId: data.orderId,
      });
    });

    // Staff events
    socket.on('staff:join', (data) => {
      socket.join(`staff:${data.restaurantId}`);
      wsService.joinRoom(socket.id, `staff:${data.restaurantId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
      wsService.disconnect(socket.id);
    });
  });

  console.log('✅ Socket.IO inicializado correctamente');
} catch (error) {
  console.log('⚠️ Socket.IO no disponible, WebSocket deshabilitado');
  console.log('   Para habilitar: npm install socket.io');
}

// Exportar io para uso en rutas
app.set('io', io);
app.set('wsService', wsService);
// ═══════════════════════════════════════════════════════════

app.use(cors());
app.use(express.json());

// ═══════════════════════════════════════════════════════════
// GASTROGO API ROUTES
// ═══════════════════════════════════════════════════════════
const authRoutes = require('./routes/auth');
const menuRoutes = require('./routes/menu');
const ordersRoutes = require('./routes/orders');
const tablesRoutes = require('./routes/tables');
const kitchenRoutes = require('./routes/kitchen');
const qrRoutes = require('./routes/qr');
const displayRoutes = require('./routes/display');

app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/tables', tablesRoutes);
app.use('/api/kitchen', kitchenRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/display', displayRoutes);
// ═══════════════════════════════════════════════════════════

// Simple API key auth for protected routes
const API_KEY = process.env.API_KEY || 'secret-api-key';
function apiKeyAuth(req, res, next){
  const key = req.header('x-api-key') || req.query.apiKey;
  if (!key || key !== API_KEY) return res.status(401).json({ error: 'unauthorized' });
  next();
}

// JWT auth
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwt';
const users = [];
function generateToken(user){
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '8h' });
}
function requireAuth(req, res, next){
  // allow API key OR bearer token
  const key = req.header('x-api-key') || req.query.apiKey;
  if (key && key === API_KEY) return next();
  const auth = req.header('authorization');
  if (!auth) return res.status(401).json({ error: 'unauthorized' });
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'invalid_auth' });
  try{
    const payload = jwt.verify(parts[1], JWT_SECRET);
    req.user = payload;
    return next();
  }catch(e){
    return res.status(401).json({ error: 'invalid_token' });
  }
}

// Presentation cache (in-memory)
const presCache = new Map(); // menuId -> { payload, expiresAt }
function getCachedPresentation(menuId){
  const entry = presCache.get(menuId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { presCache.delete(menuId); return null; }
  return entry.payload;
}
function setCachedPresentation(menuId, payload, ttlSec){
  const ttl = (ttlSec && Number(ttlSec)) ? Number(ttlSec) : 30; // default 30s
  presCache.set(menuId, { payload, expiresAt: Date.now() + ttl*1000 });
}


// In-memory stores (replace with DB in production)
const recipes = [
  { id: uuid(), title: 'Ensalada Mediterránea', ingredients: ['lechuga', 'tomate', 'aceitunas'], steps: ['Lavar', 'Cortar', 'Mezclar'] }
];

const products = [
  { id: uuid(), name: 'Tomate orgánico', price: 1.5, stock: 120 }
];

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'gastro-backend' }));

// Recipes
app.get('/recipes', (req, res) => res.json(recipes));
app.get('/recipes/:id', (req, res) => {
  const r = recipes.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'not_found' });
  res.json(r);
});
// Serve admin static files
app.use('/admin', express.static(path.join(__dirname, 'admin')));

app.post('/recipes', (req, res) => {
  const { title, ingredients, steps } = req.body;
  if (!title) return res.status(400).json({ error: 'title_required' });
  const newR = { id: uuid(), title, ingredients: ingredients || [], steps: steps || [] };
  recipes.push(newR);
  res.status(201).json(newR);
});

// Products
app.get('/products', (req, res) => res.json(products));
app.post('/products', (req, res) => {
  const { name, price, stock } = req.body;
  if (!name) return res.status(400).json({ error: 'name_required' });
  const p = { id: uuid(), name, price: price || 0, stock: stock || 0 };
  products.push(p);
  res.status(201).json(p);
});

// Auth endpoints
app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email_password_required' });
  if (users.find(u => u.email === email)) return res.status(409).json({ error: 'user_exists' });
  const hashed = await bcrypt.hash(password, 8);
  const user = { id: uuid(), email, passwordHash: hashed };
  users.push(user);
  const token = generateToken(user);
  res.status(201).json({ id: user.id, email: user.email, token });
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email_password_required' });
  const user = users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
  const token = generateToken(user);
  res.json({ id: user.id, email: user.email, token });
});

app.get('/auth/me', requireAuth, (req, res) => {
  const u = users.find(x => x.id === req.user.id);
  if (!u) return res.status(404).json({ error: 'not_found' });
  res.json({ id: u.id, email: u.email });
});

// Menus interactivos (CRUD)
const menus = [
  { id: uuid(), title: 'Menu Desayuno', items: [{ name: 'Cafe', price: 1.2 }, { name: 'Tostada', price: 2.5 }], templateId: 'mc-style', active: true }
];

app.get('/menus', (req, res) => res.json(menus));
app.get('/menus/:id', (req, res) => {
  const m = menus.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'not_found' });
  res.json(m);
});
app.post('/menus', apiKeyAuth, (req, res) => {
  const { title, items, templateId, active } = req.body;
  if (!title) return res.status(400).json({ error: 'title_required' });
  const newM = { id: uuid(), title, items: items || [], templateId: templateId || null, active: active !== false };
  menus.push(newM);
  // clear cache for this menu just in case
  presCache.delete(newM.id);
  res.status(201).json(newM);
});
app.put('/menus/:id', apiKeyAuth, (req, res) => {
  const m = menus.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'not_found' });
  const { title, items, templateId, active } = req.body;
  if (title !== undefined) m.title = title;
  if (items !== undefined) m.items = items;
  if (templateId !== undefined) m.templateId = templateId;
  if (active !== undefined) m.active = active;
  // clear cache for this menu
  presCache.delete(m.id);
  res.json(m);
});
app.delete('/menus/:id', apiKeyAuth, (req, res) => {
  const idx = menus.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not_found' });
  const removed = menus.splice(idx, 1);
  presCache.delete(removed[0].id);
  res.status(204).end();
});

// Templates para pantallas (plantillas de anuncio)
const fs = require('fs');
// path ya está importado arriba

app.get('/templates', (req, res) => {
  const dir = path.join(__dirname, 'templates');
  try {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    const templates = files.map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch(e){ return null }
    }).filter(Boolean);
    res.json(templates);
  } catch (e) {
    res.json([]);
  }
});

app.get('/templates/:id', (req, res) => {
  const id = req.params.id;
  const file = path.join(__dirname, 'templates', `${id}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'not_found' });
  try { const data = JSON.parse(fs.readFileSync(file, 'utf8')); res.json(data); } catch(e){ res.status(500).json({ error: 'invalid_template' }) }
});
app.post('/templates', apiKeyAuth, (req, res) => {
  const { id, name, config } = req.body;
  if (!id || !config) return res.status(400).json({ error: 'id_and_config_required' });
  const file = path.join(__dirname, 'templates', `${id}.json`);
  try { fs.writeFileSync(file, JSON.stringify({ id, name: name || id, config }, null, 2), 'utf8');
    // clear all cached presentations because templates changed
    presCache.clear();
    res.status(201).json({ id, name: name || id });
  } catch(e){ res.status(500).json({ error: 'write_failed' }) }
});

// Endpoint para limpiar cache (protegido)
app.post('/cache/clear', apiKeyAuth, (req, res) => {
  presCache.clear();
  res.json({ cleared: true });
});

// Endpoint de presentación para pantallas (combina menú + plantilla)
app.get('/present/:menuId', (req, res) => {
  const menuId = req.params.menuId;
  const menu = menus.find(m => m.id === menuId);
  if (!menu) return res.status(404).json({ error: 'menu_not_found' });

  const force = req.query.refresh === 'true' || req.query.force === 'true';
  // check cache
  if (!force) {
    const cached = getCachedPresentation(menuId);
    if (cached) return res.json({ cached: true, ...cached });
  }

  // Allow override of template via query param
  const templateId = req.query.templateId || menu.templateId;
  let template = null;
  if (templateId) {
    const file = path.join(__dirname, 'templates', `${templateId}.json`);
    if (fs.existsSync(file)) {
      try { template = JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e){ template = null }
    }
  }

  // Build presentation payload
  const presentation = {
    menu: { id: menu.id, title: menu.title, items: menu.items },
    template: template || { id: null, name: null, config: { backgroundColor: '#fff', accentColor: '#000', sections: [] } },
    meta: {
      generatedAt: new Date().toISOString(),
      rotate: (template && template.config && template.config.behaviors && template.config.behaviors.autoRotate) || req.query.rotate === 'true',
      rotateIntervalSec: (template && template.config && template.config.behaviors && template.config.behaviors.rotateIntervalSec) || parseInt(req.query.interval) || 8
    }
  };

  // Simple slide generation: map template sections to slides using menu items
  const slides = [];
  const sections = presentation.template.config.sections || [];
  for (const section of sections) {
    if (section.type === 'hero') {
      slides.push({ type: 'hero', height: section.height, content: menu.items.slice(0, 1) });
    } else if (section.type === 'carousel') {
      slides.push({ type: 'carousel', height: section.height, content: menu.items });
    } else if (section.type === 'grid') {
      slides.push({ type: 'grid', height: section.height, content: menu.items });
    } else if (section.type === 'list') {
      slides.push({ type: 'list', height: section.height, content: menu.items });
    } else if (section.type === 'video') {
      slides.push({ type: 'video', height: section.height, content: { url: section.videoUrl || null } });
    } else if (section.type === 'ticker') {
      slides.push({ type: 'ticker', height: section.height, content: menu.items.map(i => i.name).join(' • ') });
    } else {
      slides.push({ type: section.type || 'unknown', height: section.height, content: menu.items });
    }
  }

  presentation.slides = slides;

  // cache result - ttl can be provided by template.config.cacheTTLsec
  const ttl = (template && template.config && template.config.cacheTTLsec) ? template.config.cacheTTLsec : 30;
  setCachedPresentation(menuId, { cached: false, ...presentation }, ttl);

  res.json({ cached: false, ...presentation });
});

// Templates CRUD
app.get('/templates', (req, res) => res.json(templates));
app.get('/templates/:id', (req, res) => {
  const t = templates.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'not_found' });
  res.json(t);
});
app.post('/templates', (req, res) => {
  const { id, name, layout, style, blocks } = req.body;
  const tpl = { id: id || `tpl-${uuid()}`, name, layout, style: style || {}, blocks: blocks || [] };
  templates.push(tpl);
  res.status(201).json(tpl);
});
app.put('/templates/:id', (req, res) => {
  const idx = templates.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not_found' });
  templates[idx] = { ...templates[idx], ...req.body };
  res.json(templates[idx]);
});
app.delete('/templates/:id', (req, res) => {
  const idx = templates.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not_found' });
  templates.splice(idx, 1);
  res.status(204).end();
});

// Menus CRUD
app.get('/menus', (req, res) => res.json(menus));
app.get('/menus/:id', (req, res) => {
  const m = menus.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'not_found' });
  res.json(m);
});
app.post('/menus', (req, res) => {
  const { id, name, items, templateId, active } = req.body;
  const menu = { id: id || `menu-${uuid()}`, name, items: items || [], templateId: templateId || null, active: !!active, updatedAt: new Date().toISOString() };
  if (menu.active) menus.forEach(x => x.active = false);
  menus.push(menu);
  res.status(201).json(menu);
});
app.put('/menus/:id', (req, res) => {
  const idx = menus.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not_found' });
  menus[idx] = { ...menus[idx], ...req.body, updatedAt: new Date().toISOString() };
  if (menus[idx].active) menus.forEach((m, i) => { if (i !== idx) m.active = false; });
  res.json(menus[idx]);
});
app.delete('/menus/:id', (req, res) => {
  const idx = menus.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not_found' });
  menus.splice(idx, 1);
  res.status(204).end();
});

// Activate menu
app.post('/menus/:id/activate', (req, res) => {
  const m = menus.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'not_found' });
  menus.forEach(x => x.active = false);
  m.active = true;
  m.updatedAt = new Date().toISOString();
  res.json(m);
});

// Presentation endpoint: devuelve el menú activo junto con la plantilla
app.get('/presentation', (req, res) => {
  const menuId = req.query.menuId;
  let menu = null;
  if (menuId) menu = menus.find(x => x.id === menuId);
  else menu = menus.find(x => x.active) || menus[0] || null;
  if (!menu) return res.status(404).json({ error: 'no_menu' });
  const template = templates.find(t => t.id === menu.templateId) || null;
  res.json({ menu, template, timestamp: new Date().toISOString() });
});

// Mount menu module
const menuModule = require('./menuModule');
app.use('/menu', menuModule);

// WebSocket stats endpoint
app.get('/api/ws/stats', (req, res) => {
  res.json(wsService.getStats());
});

server.listen(PORT, () => console.log(`gastro-backend listening on ${PORT}`));

// Debug route
app.get('/debug', (req, res) => {
  res.json({ pid: process.pid, uptimeSec: process.uptime(), port: PORT, env: process.env.NODE_ENV || 'development' });
});

console.log('process.pid =', process.pid);
