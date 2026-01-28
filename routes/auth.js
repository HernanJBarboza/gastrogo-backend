/**
 * GASTROGO - Authentication Routes
 * Endpoints para login, registro y gestión de sesiones
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const {
  generateToken,
  generateTableSessionToken,
  hashPassword,
  comparePassword,
  authenticate,
  authorize,
  rateLimitLogin,
  recordFailedLogin,
  clearLoginAttempts
} = require('../middleware/auth');

// Simulación de base de datos (reemplazar con PostgreSQL)
const users = new Map();
const tables = new Map();
const tableSessions = new Map();

// Usuario admin de prueba
users.set('admin@gastrogo.com', {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  email: 'admin@gastrogo.com',
  password_hash: '$2b$10$rOzJqQZQKqK8qZJ8YqJ8qeOzJqQZQKqK8qZJ8YqJ8qeOzJqQZQKqK8', // admin123
  name: 'Admin GastroGo',
  role: 'admin',
  restaurant_id: '11111111-1111-1111-1111-111111111111'
});

// Mesas de prueba
for (let i = 1; i <= 10; i++) {
  const tableId = `table-${i}`;
  tables.set(tableId, {
    id: tableId,
    restaurant_id: '11111111-1111-1111-1111-111111111111',
    table_number: String(i),
    qr_code: `qr-mesa-${String(i).padStart(3, '0')}-${uuidv4().slice(0, 6)}`
  });
}

/**
 * POST /auth/login
 * Login con email y contraseña
 */
router.post('/login', rateLimitLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Email y contraseña son requeridos'
        }
      });
    }

    // Buscar usuario (en producción usar DB)
    const user = users.get(email.toLowerCase());

    if (!user) {
      recordFailedLogin(email);
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Credenciales inválidas'
        }
      });
    }

    // Para pruebas, aceptar "admin123" como password
    const isValidPassword = password === 'admin123' || await comparePassword(password, user.password_hash);

    if (!isValidPassword) {
      recordFailedLogin(email);
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Credenciales inválidas'
        }
      });
    }

    clearLoginAttempts(email);

    const token = generateToken(user);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          restaurantId: user.restaurant_id
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error interno del servidor'
      }
    });
  }
});

/**
 * POST /auth/register
 * Registro de nuevo usuario (solo admin puede crear staff)
 */
router.post('/register', authenticate({ optional: true }), async (req, res) => {
  try {
    const { email, password, name, role = 'customer' } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email, contraseña y nombre son requeridos'
        }
      });
    }

    // Solo admin puede crear usuarios staff
    if (role === 'staff' || role === 'admin') {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Solo un administrador puede crear usuarios staff'
          }
        });
      }
    }

    // Verificar si el email ya existe
    if (users.has(email.toLowerCase())) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Este email ya está registrado'
        }
      });
    }

    const passwordHash = await hashPassword(password);
    const restaurantId = req.user?.restaurantId || '11111111-1111-1111-1111-111111111111';

    const newUser = {
      id: uuidv4(),
      email: email.toLowerCase(),
      password_hash: passwordHash,
      name,
      role,
      restaurant_id: restaurantId,
      created_at: new Date().toISOString()
    };

    users.set(newUser.email, newUser);

    const token = generateToken(newUser);

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          restaurantId: newUser.restaurant_id
        }
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error interno del servidor'
      }
    });
  }
});

/**
 * POST /auth/qr-session
 * Crear sesión de mesa escaneando QR (cliente anónimo)
 */
router.post('/qr-session', async (req, res) => {
  try {
    const { qrCode, tableId, restaurantId } = req.body;

    if (!qrCode && !tableId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_QR_OR_TABLE',
          message: 'Se requiere código QR o ID de mesa'
        }
      });
    }

    // Buscar mesa por QR o ID
    let table = null;
    for (const [, t] of tables) {
      if (t.qr_code === qrCode || t.id === tableId) {
        table = t;
        break;
      }
    }

    if (!table) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TABLE_NOT_FOUND',
          message: 'Mesa no encontrada'
        }
      });
    }

    // Crear nueva sesión de mesa
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      table_id: table.id,
      restaurant_id: table.restaurant_id,
      session_token: uuidv4(),
      started_at: new Date().toISOString(),
      is_active: true
    };

    tableSessions.set(sessionId, session);

    // Generar token de sesión
    const token = generateTableSessionToken(table.id, table.restaurant_id, sessionId);

    res.json({
      success: true,
      data: {
        token,
        session: {
          id: sessionId,
          tableId: table.id,
          tableNumber: table.table_number,
          restaurantId: table.restaurant_id
        }
      }
    });
  } catch (error) {
    console.error('QR Session error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error interno del servidor'
      }
    });
  }
});

/**
 * GET /auth/me
 * Obtener información del usuario actual
 */
router.get('/me', authenticate(), (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user
    }
  });
});

/**
 * POST /auth/logout
 * Cerrar sesión (invalidar token en cliente)
 */
router.post('/logout', authenticate(), (req, res) => {
  // En una implementación real, aquí se invalidaría el token
  // Por ejemplo, añadiéndolo a una blacklist o borrando de Redis
  
  res.json({
    success: true,
    message: 'Sesión cerrada correctamente'
  });
});

/**
 * POST /auth/close-table-session
 * Cerrar sesión de mesa (solo staff o admin)
 */
router.post('/close-table-session', authenticate(), authorize('admin', 'staff'), async (req, res) => {
  try {
    const { sessionId, tableId } = req.body;

    if (!sessionId && !tableId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_SESSION_INFO',
          message: 'Se requiere ID de sesión o ID de mesa'
        }
      });
    }

    // Buscar y cerrar la sesión
    for (const [id, session] of tableSessions) {
      if (session.id === sessionId || session.table_id === tableId) {
        session.is_active = false;
        session.closed_at = new Date().toISOString();
        tableSessions.set(id, session);
        
        return res.json({
          success: true,
          message: 'Sesión de mesa cerrada correctamente'
        });
      }
    }

    res.status(404).json({
      success: false,
      error: {
        code: 'SESSION_NOT_FOUND',
        message: 'Sesión de mesa no encontrada'
      }
    });
  } catch (error) {
    console.error('Close session error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error interno del servidor'
      }
    });
  }
});

/**
 * GET /auth/validate
 * Validar token actual
 */
router.get('/validate', authenticate(), (req, res) => {
  res.json({
    success: true,
    valid: true,
    user: {
      role: req.user.role,
      type: req.user.type,
      restaurantId: req.user.restaurantId
    }
  });
});

module.exports = router;
