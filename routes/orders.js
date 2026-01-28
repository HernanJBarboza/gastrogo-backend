/**
 * GASTROGO - Orders API Routes
 * Endpoints para gestión de pedidos
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { 
  authenticate, 
  authorize, 
  validateTableOwnership,
  validateOrderOwnership,
  ROLES 
} = require('../middleware/auth');

// Estado de pedidos en memoria (en producción usar PostgreSQL)
let orders = [];

// Estados válidos y transiciones permitidas
const ORDER_STATES = {
  created: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivered'],
  delivered: ['paid'],
  paid: [],
  cancelled: [],
};

/**
 * POST /api/orders
 * Crear un nuevo pedido (cliente desde QR)
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { table_id, items, notes } = req.body;
    const { user, tableSession } = req;
    
    // Validar que tenga sesión de mesa
    if (!tableSession && user.role === 'customer') {
      return res.status(403).json({
        success: false,
        error: 'Debe escanear el QR de la mesa para realizar pedidos',
      });
    }
    
    // Validar items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'El pedido debe contener al menos un item',
      });
    }
    
    // Calcular total (simulado)
    const total = items.reduce((sum, item) => {
      const basePrice = item.price || 0;
      const modifiersPrice = (item.modifiers || []).reduce(
        (mSum, m) => mSum + (m.price_adjustment || 0), 
        0
      );
      return sum + (basePrice + modifiersPrice) * item.quantity;
    }, 0);
    
    const order = {
      id: uuidv4(),
      restaurant_id: tableSession?.restaurant_id || user.restaurant_id,
      table_id: tableSession?.table_id || table_id,
      table_number: tableSession?.table_number || req.body.table_number,
      user_id: user.id,
      session_id: tableSession?.session_id,
      status: 'created',
      items: items.map(item => ({
        id: uuidv4(),
        dish_id: item.dish_id,
        dish_name: item.dish_name,
        quantity: item.quantity,
        unit_price: item.price,
        modifiers: item.modifiers || [],
        notes: item.notes || '',
      })),
      notes: notes || '',
      total,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    orders.push(order);
    
    // En producción: emitir evento WebSocket a KDS
    // io.to(`kitchen:${order.restaurant_id}`).emit('new_order', order);
    
    res.status(201).json({
      success: true,
      data: order,
      message: 'Pedido creado exitosamente',
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear pedido',
    });
  }
});

/**
 * GET /api/orders
 * Listar pedidos (filtrados según rol)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { user, tableSession } = req;
    const { status, table_id, limit = 50 } = req.query;
    
    let filteredOrders = [...orders];
    
    // Filtrar según rol
    if (user.role === 'customer') {
      // Clientes solo ven sus propios pedidos de la sesión actual
      if (tableSession) {
        filteredOrders = filteredOrders.filter(o => 
          o.session_id === tableSession.session_id
        );
      } else {
        filteredOrders = filteredOrders.filter(o => o.user_id === user.id);
      }
    } else if (user.role === 'staff') {
      // Staff ve pedidos del restaurante
      filteredOrders = filteredOrders.filter(o => 
        o.restaurant_id === user.restaurant_id
      );
    }
    // Admin ve todos
    
    // Filtros adicionales
    if (status) {
      filteredOrders = filteredOrders.filter(o => o.status === status);
    }
    
    if (table_id) {
      filteredOrders = filteredOrders.filter(o => o.table_id === table_id);
    }
    
    // Ordenar por fecha (más recientes primero)
    filteredOrders.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    // Limitar
    filteredOrders = filteredOrders.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      data: filteredOrders,
      total: filteredOrders.length,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener pedidos',
    });
  }
});

/**
 * GET /api/orders/:id
 * Obtener detalle de un pedido
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { user, tableSession } = req;
    
    const order = orders.find(o => o.id === id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado',
      });
    }
    
    // Validar acceso
    if (user.role === 'customer') {
      if (tableSession && order.session_id !== tableSession.session_id) {
        return res.status(403).json({
          success: false,
          error: 'No tiene acceso a este pedido',
        });
      }
      if (!tableSession && order.user_id !== user.id) {
        return res.status(403).json({
          success: false,
          error: 'No tiene acceso a este pedido',
        });
      }
    } else if (user.role === 'staff' && order.restaurant_id !== user.restaurant_id) {
      return res.status(403).json({
        success: false,
        error: 'No tiene acceso a este pedido',
      });
    }
    
    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener pedido',
    });
  }
});

/**
 * PATCH /api/orders/:id/status
 * Actualizar estado de un pedido (staff/admin)
 */
router.patch('/:id/status', authenticate, authorize(['staff', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { user } = req;
    
    const orderIndex = orders.findIndex(o => o.id === id);
    
    if (orderIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado',
      });
    }
    
    const order = orders[orderIndex];
    
    // Validar restaurante
    if (user.role === 'staff' && order.restaurant_id !== user.restaurant_id) {
      return res.status(403).json({
        success: false,
        error: 'No tiene acceso a este pedido',
      });
    }
    
    // Validar transición de estado
    const allowedTransitions = ORDER_STATES[order.status];
    if (!allowedTransitions.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `No se puede cambiar de '${order.status}' a '${status}'`,
        allowed_transitions: allowedTransitions,
      });
    }
    
    // Actualizar
    orders[orderIndex] = {
      ...order,
      status,
      updated_at: new Date().toISOString(),
      [`${status}_at`]: new Date().toISOString(),
      [`${status}_by`]: user.id,
    };
    
    // En producción: emitir evento WebSocket
    // io.to(`order:${id}`).emit('status_update', { status, order: orders[orderIndex] });
    // io.to(`table:${order.table_id}`).emit('order_update', orders[orderIndex]);
    
    res.json({
      success: true,
      data: orders[orderIndex],
      message: `Pedido actualizado a '${status}'`,
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar pedido',
    });
  }
});

/**
 * DELETE /api/orders/:id
 * Cancelar pedido (solo si está en estado 'created' o 'confirmed')
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { user, tableSession } = req;
    
    const orderIndex = orders.findIndex(o => o.id === id);
    
    if (orderIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado',
      });
    }
    
    const order = orders[orderIndex];
    
    // Validar propiedad o permisos
    if (user.role === 'customer') {
      if (tableSession && order.session_id !== tableSession.session_id) {
        return res.status(403).json({
          success: false,
          error: 'No puede cancelar este pedido',
        });
      }
    }
    
    // Solo se puede cancelar en ciertos estados
    if (!['created', 'confirmed'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        error: 'Este pedido ya no se puede cancelar',
        current_status: order.status,
      });
    }
    
    // Marcar como cancelado (no eliminar)
    orders[orderIndex] = {
      ...order,
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: user.id,
      updated_at: new Date().toISOString(),
    };
    
    res.json({
      success: true,
      data: orders[orderIndex],
      message: 'Pedido cancelado',
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cancelar pedido',
    });
  }
});

/**
 * GET /api/orders/kitchen/active
 * Obtener pedidos activos para KDS (staff/admin)
 */
router.get('/kitchen/active', authenticate, authorize(['staff', 'admin']), async (req, res) => {
  try {
    const { user } = req;
    
    let activeOrders = orders.filter(o => 
      !['delivered', 'paid', 'cancelled'].includes(o.status)
    );
    
    // Filtrar por restaurante si es staff
    if (user.role === 'staff') {
      activeOrders = activeOrders.filter(o => 
        o.restaurant_id === user.restaurant_id
      );
    }
    
    // Agrupar por estado
    const grouped = {
      created: activeOrders.filter(o => o.status === 'created'),
      confirmed: activeOrders.filter(o => o.status === 'confirmed'),
      preparing: activeOrders.filter(o => o.status === 'preparing'),
      ready: activeOrders.filter(o => o.status === 'ready'),
    };
    
    res.json({
      success: true,
      data: {
        orders: activeOrders,
        grouped,
        counts: {
          created: grouped.created.length,
          confirmed: grouped.confirmed.length,
          preparing: grouped.preparing.length,
          ready: grouped.ready.length,
          total: activeOrders.length,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching kitchen orders:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener pedidos de cocina',
    });
  }
});

/**
 * GET /api/orders/track/:orderNumber
 * Endpoint público para tracking de pedido por número
 * No requiere autenticación - usado por clientes para ver estado
 */
router.get('/track/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    
    // Buscar por ID o número de orden
    const order = orders.find(o => 
      o.id === orderNumber || 
      o.order_number === orderNumber ||
      o.id.startsWith(orderNumber)
    );
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado'
      });
    }
    
    // Calcular tiempo estimado basado en items y estado actual
    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
    let estimatedMinutes = Math.max(10, itemCount * 5); // 5 min por item, mínimo 10
    
    if (order.status === 'preparing') {
      // Ya pasó tiempo de confirmación
      const prepStarted = new Date(order.preparing_at || order.updated_at);
      const elapsed = (Date.now() - prepStarted.getTime()) / 1000 / 60;
      estimatedMinutes = Math.max(5, estimatedMinutes - elapsed);
    } else if (order.status === 'ready' || order.status === 'delivered') {
      estimatedMinutes = 0;
    }
    
    // Construir historial de estados
    const statusHistory = [];
    const statusOrder = ['created', 'confirmed', 'preparing', 'ready', 'delivered'];
    
    statusOrder.forEach(status => {
      const timestamp = order[`${status}_at`];
      if (timestamp) {
        statusHistory.push({ status, timestamp });
      }
    });
    
    // Si solo tiene created_at, usar eso
    if (statusHistory.length === 0 && order.created_at) {
      statusHistory.push({ status: 'created', timestamp: order.created_at });
    }
    
    // Respuesta formateada para tracking
    res.json({
      success: true,
      data: {
        id: order.id,
        orderNumber: order.order_number || order.id.slice(-6).toUpperCase(),
        tableNumber: order.table_number,
        status: order.status,
        items: order.items.map(item => ({
          name: item.dish_name,
          quantity: item.quantity
        })),
        estimatedMinutes: Math.round(estimatedMinutes),
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        statusHistory
      }
    });
  } catch (error) {
    console.error('Error tracking order:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estado del pedido'
    });
  }
});

module.exports = router;

