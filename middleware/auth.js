/**
 * GASTROGO - Authentication Middleware
 * Sistema de autenticación con soporte para múltiples proveedores
 * y control de acceso basado en roles (RBAC)
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'gastrogo-super-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Roles disponibles y sus permisos
const ROLES = {
  admin: {
    level: 100,
    permissions: ['*'] // Acceso total
  },
  staff: {
    level: 50,
    permissions: [
      'orders:read', 'orders:update', 'orders:create',
      'tables:read', 'tables:update',
      'dishes:read',
      'kitchen:access',
      'notifications:read'
    ]
  },
  customer: {
    level: 10,
    permissions: [
      'menu:read',
      'orders:create', 'orders:read:own',
      'tables:read:own'
    ]
  }
};

/**
 * Genera un token JWT para el usuario
 */
function generateToken(user, sessionData = {}) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    restaurantId: user.restaurant_id,
    ...sessionData
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Genera un token para sesión de mesa (cliente anónimo)
 */
function generateTableSessionToken(tableId, restaurantId, sessionId) {
  const payload = {
    type: 'table_session',
    tableId,
    restaurantId,
    sessionId,
    role: 'customer'
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

/**
 * Verifica y decodifica un token JWT
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthError('Token expirado', 401, 'TOKEN_EXPIRED');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new AuthError('Token inválido', 401, 'INVALID_TOKEN');
    }
    throw error;
  }
}

/**
 * Clase de error personalizada para autenticación
 */
class AuthError extends Error {
  constructor(message, statusCode = 401, code = 'AUTH_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AuthError';
  }
}

/**
 * Middleware principal de autenticación
 * Verifica el token JWT y adjunta el usuario a la request
 */
function authenticate(options = {}) {
  const { optional = false } = options;

  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : req.cookies?.token || req.query?.token;

      if (!token) {
        if (optional) {
          req.user = null;
          return next();
        }
        throw new AuthError('Token de autenticación requerido', 401, 'NO_TOKEN');
      }

      const decoded = verifyToken(token);
      
      // Diferenciar entre sesión de usuario y sesión de mesa
      if (decoded.type === 'table_session') {
        req.user = {
          type: 'table_session',
          tableId: decoded.tableId,
          restaurantId: decoded.restaurantId,
          sessionId: decoded.sessionId,
          role: 'customer',
          isAnonymous: true
        };
      } else {
        req.user = {
          type: 'user',
          id: decoded.userId,
          email: decoded.email,
          role: decoded.role,
          restaurantId: decoded.restaurantId,
          isAnonymous: false
        };
      }

      next();
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
      }
      next(error);
    }
  };
}

/**
 * Middleware de autorización por rol
 * Verifica que el usuario tenga el rol requerido
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Debes estar autenticado para acceder a este recurso'
        }
      });
    }

    const userRole = req.user.role;
    
    // Admin tiene acceso a todo
    if (userRole === 'admin') {
      return next();
    }

    // Verificar si el rol del usuario está permitido
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Acceso denegado. Se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}`
        }
      });
    }

    next();
  };
}

/**
 * Middleware de verificación de permiso específico
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Debes estar autenticado'
        }
      });
    }

    const userRole = req.user.role;
    const roleConfig = ROLES[userRole];

    if (!roleConfig) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INVALID_ROLE',
          message: 'Rol de usuario inválido'
        }
      });
    }

    // Admin tiene todos los permisos
    if (roleConfig.permissions.includes('*')) {
      return next();
    }

    // Verificar permiso específico
    if (!roleConfig.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: `No tienes permiso para: ${permission}`
        }
      });
    }

    next();
  };
}

/**
 * Middleware de validación de propiedad de mesa
 * Asegura que un cliente solo pueda acceder a su propia mesa
 */
function validateTableOwnership(tableIdParam = 'tableId') {
  return (req, res, next) => {
    // Admin y Staff pueden ver cualquier mesa
    if (req.user.role === 'admin' || req.user.role === 'staff') {
      return next();
    }

    // Cliente solo puede ver su mesa
    if (req.user.type === 'table_session') {
      const requestedTableId = req.params[tableIdParam] || req.body?.tableId || req.query?.tableId;
      
      if (requestedTableId && requestedTableId !== req.user.tableId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'TABLE_ACCESS_DENIED',
            message: 'No tienes acceso a esta mesa'
          }
        });
      }
    }

    next();
  };
}

/**
 * Middleware de validación de propiedad de pedido
 * Asegura que un cliente solo pueda acceder a sus propios pedidos
 */
function validateOrderOwnership(orderIdParam = 'orderId') {
  return async (req, res, next) => {
    // Admin y Staff pueden ver cualquier pedido del restaurante
    if (req.user.role === 'admin' || req.user.role === 'staff') {
      return next();
    }

    // Cliente solo puede ver pedidos de su sesión de mesa
    if (req.user.type === 'table_session') {
      const orderId = req.params[orderIdParam];
      
      if (orderId) {
        // Aquí se debería consultar la DB para verificar
        // Por ahora adjuntamos la validación para que se haga en el controlador
        req.validateOrderSession = true;
        req.userSessionId = req.user.sessionId;
      }
    }

    next();
  };
}

/**
 * Middleware de validación de restaurante
 * Asegura que el usuario solo acceda a datos de su restaurante
 */
function validateRestaurant(restaurantIdParam = 'restaurantId') {
  return (req, res, next) => {
    const requestedRestaurantId = req.params[restaurantIdParam] || 
                                   req.body?.restaurantId || 
                                   req.query?.restaurantId;

    if (!requestedRestaurantId) {
      return next();
    }

    // Verificar que el usuario pertenezca al restaurante
    if (req.user.restaurantId && req.user.restaurantId !== requestedRestaurantId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'RESTAURANT_ACCESS_DENIED',
          message: 'No tienes acceso a este restaurante'
        }
      });
    }

    next();
  };
}

/**
 * Hashea una contraseña
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compara una contraseña con su hash
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Middleware de rate limiting básico para login
 */
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutos

function rateLimitLogin(req, res, next) {
  const identifier = req.body.email || req.ip;
  const now = Date.now();
  
  const attempts = loginAttempts.get(identifier);
  
  if (attempts) {
    // Limpiar intentos antiguos
    if (now - attempts.lastAttempt > LOGIN_LOCKOUT_TIME) {
      loginAttempts.delete(identifier);
    } else if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
      const timeLeft = Math.ceil((LOGIN_LOCKOUT_TIME - (now - attempts.lastAttempt)) / 1000 / 60);
      return res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_ATTEMPTS',
          message: `Demasiados intentos fallidos. Intenta de nuevo en ${timeLeft} minutos`
        }
      });
    }
  }

  next();
}

/**
 * Registra un intento de login fallido
 */
function recordFailedLogin(identifier) {
  const attempts = loginAttempts.get(identifier) || { count: 0, lastAttempt: 0 };
  attempts.count++;
  attempts.lastAttempt = Date.now();
  loginAttempts.set(identifier, attempts);
}

/**
 * Limpia los intentos de login tras éxito
 */
function clearLoginAttempts(identifier) {
  loginAttempts.delete(identifier);
}

module.exports = {
  // Generación de tokens
  generateToken,
  generateTableSessionToken,
  verifyToken,
  
  // Middlewares
  authenticate,
  authorize,
  requirePermission,
  validateTableOwnership,
  validateOrderOwnership,
  validateRestaurant,
  rateLimitLogin,
  
  // Utilidades de password
  hashPassword,
  comparePassword,
  
  // Tracking de login
  recordFailedLogin,
  clearLoginAttempts,
  
  // Constantes
  ROLES,
  AuthError
};
