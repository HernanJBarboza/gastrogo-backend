/**
 * GASTROGO - Tables API Routes
 * Endpoints para gestión de mesas y sesiones QR
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { 
  authenticate, 
  authorize,
  generateTableSessionToken,
  ROLES 
} = require('../middleware/auth');

// Estado de mesas en memoria (en producción usar PostgreSQL)
let tables = [
  { id: 'table-1', restaurant_id: 'rest-001', number: 1, capacity: 2, status: 'available', qr_code: 'QR001' },
  { id: 'table-2', restaurant_id: 'rest-001', number: 2, capacity: 4, status: 'available', qr_code: 'QR002' },
  { id: 'table-3', restaurant_id: 'rest-001', number: 3, capacity: 4, status: 'occupied', qr_code: 'QR003' },
  { id: 'table-4', restaurant_id: 'rest-001', number: 4, capacity: 6, status: 'available', qr_code: 'QR004' },
  { id: 'table-5', restaurant_id: 'rest-001', number: 5, capacity: 4, status: 'available', qr_code: 'QR005' },
  { id: 'table-6', restaurant_id: 'rest-001', number: 6, capacity: 2, status: 'occupied', qr_code: 'QR006' },
  { id: 'table-7', restaurant_id: 'rest-001', number: 7, capacity: 8, status: 'available', qr_code: 'QR007' },
  { id: 'table-8', restaurant_id: 'rest-001', number: 8, capacity: 4, status: 'occupied', qr_code: 'QR008' },
  { id: 'table-9', restaurant_id: 'rest-001', number: 9, capacity: 4, status: 'reserved', qr_code: 'QR009' },
  { id: 'table-10', restaurant_id: 'rest-001', number: 10, capacity: 6, status: 'available', qr_code: 'QR010' },
];

let tableSessions = [];

/**
 * GET /api/tables
 * Listar todas las mesas del restaurante (staff/admin)
 */
router.get('/', authenticate, authorize(['staff', 'admin']), async (req, res) => {
  try {
    const { user } = req;
    const { status } = req.query;
    
    let filteredTables = tables;
    
    // Filtrar por restaurante si es staff
    if (user.role === 'staff') {
      filteredTables = filteredTables.filter(t => 
        t.restaurant_id === user.restaurant_id
      );
    }
    
    // Filtrar por estado
    if (status) {
      filteredTables = filteredTables.filter(t => t.status === status);
    }
    
    // Agregar información de sesión activa
    const tablesWithSessions = filteredTables.map(table => {
      const activeSession = tableSessions.find(s => 
        s.table_id === table.id && s.active
      );
      return {
        ...table,
        active_session: activeSession ? {
          id: activeSession.id,
          started_at: activeSession.started_at,
          guest_count: activeSession.guest_count,
        } : null,
      };
    });
    
    res.json({
      success: true,
      data: tablesWithSessions,
      summary: {
        total: tablesWithSessions.length,
        available: tablesWithSessions.filter(t => t.status === 'available').length,
        occupied: tablesWithSessions.filter(t => t.status === 'occupied').length,
        reserved: tablesWithSessions.filter(t => t.status === 'reserved').length,
      },
    });
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener mesas',
    });
  }
});

/**
 * GET /api/tables/:id
 * Obtener detalle de una mesa
 */
router.get('/:id', authenticate, authorize(['staff', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    const table = tables.find(t => t.id === id);
    
    if (!table) {
      return res.status(404).json({
        success: false,
        error: 'Mesa no encontrada',
      });
    }
    
    // Validar restaurante
    if (user.role === 'staff' && table.restaurant_id !== user.restaurant_id) {
      return res.status(403).json({
        success: false,
        error: 'No tiene acceso a esta mesa',
      });
    }
    
    // Obtener sesión activa y pedidos
    const activeSession = tableSessions.find(s => 
      s.table_id === table.id && s.active
    );
    
    res.json({
      success: true,
      data: {
        ...table,
        active_session: activeSession || null,
      },
    });
  } catch (error) {
    console.error('Error fetching table:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener mesa',
    });
  }
});

/**
 * POST /api/tables/scan
 * Escanear QR y crear/obtener sesión de mesa (público)
 */
router.post('/scan', async (req, res) => {
  try {
    const { qr_code, guest_count } = req.body;
    
    if (!qr_code) {
      return res.status(400).json({
        success: false,
        error: 'Código QR requerido',
      });
    }
    
    // Buscar mesa por QR
    const table = tables.find(t => t.qr_code === qr_code);
    
    if (!table) {
      return res.status(404).json({
        success: false,
        error: 'Mesa no encontrada. QR inválido.',
      });
    }
    
    // Verificar si mesa está disponible o tiene sesión activa
    let session = tableSessions.find(s => 
      s.table_id === table.id && s.active
    );
    
    if (!session) {
      // Crear nueva sesión
      session = {
        id: uuidv4(),
        table_id: table.id,
        table_number: table.number,
        restaurant_id: table.restaurant_id,
        guest_count: guest_count || 1,
        started_at: new Date().toISOString(),
        active: true,
      };
      
      tableSessions.push(session);
      
      // Actualizar estado de mesa
      const tableIndex = tables.findIndex(t => t.id === table.id);
      tables[tableIndex].status = 'occupied';
    }
    
    // Generar token de sesión
    const token = generateTableSessionToken({
      session_id: session.id,
      table_id: table.id,
      table_number: table.number,
      restaurant_id: table.restaurant_id,
    });
    
    res.json({
      success: true,
      data: {
        session,
        table: {
          id: table.id,
          number: table.number,
          capacity: table.capacity,
        },
        token,
      },
      message: session.started_at === new Date().toISOString() 
        ? 'Nueva sesión iniciada' 
        : 'Sesión existente recuperada',
    });
  } catch (error) {
    console.error('Error scanning QR:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar QR',
    });
  }
});

/**
 * PATCH /api/tables/:id/status
 * Actualizar estado de mesa (staff/admin)
 */
router.patch('/:id/status', authenticate, authorize(['staff', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { user } = req;
    
    const validStatuses = ['available', 'occupied', 'reserved', 'maintenance'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Estado inválido',
        valid_statuses: validStatuses,
      });
    }
    
    const tableIndex = tables.findIndex(t => t.id === id);
    
    if (tableIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Mesa no encontrada',
      });
    }
    
    const table = tables[tableIndex];
    
    // Validar restaurante
    if (user.role === 'staff' && table.restaurant_id !== user.restaurant_id) {
      return res.status(403).json({
        success: false,
        error: 'No tiene acceso a esta mesa',
      });
    }
    
    // Si se marca como disponible, cerrar sesión activa
    if (status === 'available') {
      const sessionIndex = tableSessions.findIndex(s => 
        s.table_id === table.id && s.active
      );
      if (sessionIndex !== -1) {
        tableSessions[sessionIndex].active = false;
        tableSessions[sessionIndex].ended_at = new Date().toISOString();
      }
    }
    
    tables[tableIndex].status = status;
    
    res.json({
      success: true,
      data: tables[tableIndex],
      message: `Mesa ${table.number} actualizada a '${status}'`,
    });
  } catch (error) {
    console.error('Error updating table status:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar mesa',
    });
  }
});

/**
 * POST /api/tables/:id/close-session
 * Cerrar sesión de mesa (staff/admin)
 */
router.post('/:id/close-session', authenticate, authorize(['staff', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    const table = tables.find(t => t.id === id);
    
    if (!table) {
      return res.status(404).json({
        success: false,
        error: 'Mesa no encontrada',
      });
    }
    
    // Validar restaurante
    if (user.role === 'staff' && table.restaurant_id !== user.restaurant_id) {
      return res.status(403).json({
        success: false,
        error: 'No tiene acceso a esta mesa',
      });
    }
    
    // Buscar y cerrar sesión activa
    const sessionIndex = tableSessions.findIndex(s => 
      s.table_id === table.id && s.active
    );
    
    if (sessionIndex === -1) {
      return res.status(400).json({
        success: false,
        error: 'No hay sesión activa en esta mesa',
      });
    }
    
    tableSessions[sessionIndex] = {
      ...tableSessions[sessionIndex],
      active: false,
      ended_at: new Date().toISOString(),
      closed_by: user.id,
    };
    
    // Liberar mesa
    const tableIndex = tables.findIndex(t => t.id === id);
    tables[tableIndex].status = 'available';
    
    res.json({
      success: true,
      data: {
        session: tableSessions[sessionIndex],
        table: tables[tableIndex],
      },
      message: `Sesión de Mesa ${table.number} cerrada`,
    });
  } catch (error) {
    console.error('Error closing session:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cerrar sesión',
    });
  }
});

/**
 * GET /api/tables/qr/:code
 * Obtener información de mesa por código QR (público)
 */
router.get('/qr/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    const table = tables.find(t => t.qr_code === code);
    
    if (!table) {
      return res.status(404).json({
        success: false,
        error: 'Código QR inválido',
      });
    }
    
    res.json({
      success: true,
      data: {
        table_id: table.id,
        number: table.number,
        capacity: table.capacity,
        status: table.status,
      },
    });
  } catch (error) {
    console.error('Error fetching table by QR:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener mesa',
    });
  }
});

module.exports = router;
