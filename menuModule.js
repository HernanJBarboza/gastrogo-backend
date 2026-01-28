const express = require('express');
const { v4: uuid } = require('uuid');

const router = express.Router();

// In-memory stores for menus, items, offers and templates
const menus = [];
const items = [];
const offers = [];
const templates = [
  {
    id: 'tpl-banner',
    type: 'banner',
    name: 'Banner clásico',
    description: 'Banner grande con imagen, título y CTA en primer plano',
    schema: { image: true, title: true, subtitle: true, cta: true }
  },
  {
    id: 'tpl-carousel',
    type: 'carousel',
    name: 'Carrusel de productos',
    description: 'Varios productos navegables, ideal para ofertas',
    schema: { items: true, price: true, badge: true }
  },
  {
    id: 'tpl-combo',
    type: 'combo',
    name: 'Combo destacado',
    description: 'Plantilla para combos especiales con precio y ahorro mostrado',
    schema: { components: true, originalPrice: true, comboPrice: true }
  }
];

// Helpers
function findById(list, id){ return list.find(x => x.id === id); }

// Templates
router.get('/templates', (req, res) => res.json(templates));
router.get('/templates/:id', (req, res) => {
  const t = findById(templates, req.params.id);
  if (!t) return res.status(404).json({ error: 'template_not_found' });
  res.json(t);
});

// Menus CRUD
router.get('/', (req, res) => res.json(menus));
router.get('/:id', (req, res) => {
  const m = findById(menus, req.params.id);
  if (!m) return res.status(404).json({ error: 'menu_not_found' });
  res.json(m);
});
router.post('/', (req, res) => {
  const { name, sections } = req.body;
  if (!name) return res.status(400).json({ error: 'name_required' });
  const m = { id: uuid(), name, sections: sections || [] };
  menus.push(m);
  res.status(201).json(m);
});

// Items CRUD (menu items)
router.get('/items/all', (req, res) => res.json(items));
router.post('/items', (req, res) => {
  const { title, price, description, image } = req.body;
  if (!title) return res.status(400).json({ error: 'title_required' });
  const it = { id: uuid(), title, price: price || 0, description: description || '', image: image || '' };
  items.push(it);
  res.status(201).json(it);
});

// Offers/Combos
router.get('/offers', (req, res) => res.json(offers));
router.post('/offers', (req, res) => {
  const { title, templateId, payload } = req.body;
  if (!title || !templateId) return res.status(400).json({ error: 'title_and_template_required' });
  const t = findById(templates, templateId);
  if (!t) return res.status(400).json({ error: 'invalid_template' });
  const o = { id: uuid(), title, templateId, payload, createdAt: new Date().toISOString() };
  offers.push(o);
  res.status(201).json(o);
});

// Endpoint para producir payload listo para pantallas publicitarias
// Ej: GET /menu/display/:id -> devuelve menu + bloques de ofertas y plantillas
router.get('/display/:id', (req, res) => {
  const menuId = req.params.id;
  const menu = findById(menus, menuId);
  if (!menu) return res.status(404).json({ error: 'menu_not_found' });

  // Construir payload de display: se incluyen templates de ofertas activas y items referenciados
  const activeOffers = offers.map(o => {
    const tpl = findById(templates, o.templateId) || {};
    return { id: o.id, title: o.title, template: tpl, payload: o.payload };
  });

  const response = {
    menu: menu,
    offers: activeOffers,
    generatedAt: new Date().toISOString()
  };

  res.json(response);
});

module.exports = router;
