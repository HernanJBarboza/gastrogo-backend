/**
 * GASTROGO - Kitchen API Routes
 * Endpoints específicos para el Kitchen Display System (KDS)
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

// Referencia a pedidos (compartida con orders.js en producción sería DB)
// Por ahora simulamos con datos mock
let kitchenOrders = [
  {
    id: 'ord-abc123',
    restaurant_id: 'rest-001',
    table_number: 5,
    status: 'created',
    created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    total: 15800,
    items: [
      { id: 'item-1', dish_name: 'Provoleta', quantity: 1, notes: 'Sin orégano' },
      { id: 'item-2', dish_name: 'Bife de Chorizo', quantity: 2, modifiers: ['Jugoso', 'Papas fritas'] },
    ],
  },
  {
    id: 'ord-def456',
    restaurant_id: 'rest-001',
    table_number: 3,
    status: 'preparing',
    created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    total: 22300,
    items: [
      { id: 'item-3', dish_name: 'Empanadas Criollas', quantity: 6 },
      { id: 'item-4', dish_name: 'Entraña', quantity: 1, modifiers: ['A punto'] },
      { id: 'item-5', dish_name: 'Ñoquis de Papa', quantity: 1, modifiers: ['Bolognesa'] },
    ],
    notes: 'Cliente alérgico a mariscos',
  },
  {
    id: 'ord-ghi789',
    restaurant_id: 'rest-001',
    table_number: 8,
    status: 'preparing',
    created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    total: 18500,
    items: [
      { id: 'item-6', dish_name: 'Asado de Tira', quantity: 2 },
      { id: 'item-7', dish_name: 'Ensalada Mixta', quantity: 2 },
    ],
  },
  {
    id: 'ord-jkl012',
    restaurant_id: 'rest-001',
    table_number: 1,
    status: 'confirmed',
    created_at: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    total: 7400,
    items: [
      { id: 'item-8', dish_name: 'Tiramisú', quantity: 2 },
      { id: 'item-9', dish_name: 'Café Espresso', quantity: 2 },
    ],
  },
  {
    id: 'ord-mno345',
    restaurant_id: 'rest-001',
    table_number: 10,
    status: 'ready',
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    total: 12500,
    items: [
      { id: 'item-10', dish_name: 'Bife de Chorizo', quantity: 1, modifiers: ['Cocido', 'Puré'] },
    ],
  },
];

/**
 * GET /api/kitchen/orders
 * Obtener todos los pedidos activos para el KDS
 */
router.get('/orders', authenticate, authorize(['staff', 'admin']), async (req, res) => {
  try {
    const { user } = req;
    
    // Filtrar pedidos activos (no completados ni cancelados)
    let activeOrders = kitchenOrders.filter(o => 
      !['delivered', 'paid', 'cancelled'].includes(o.status)
    );
    
    // Filtrar por restaurante si es staff
    if (user.role === 'staff' && user.restaurant_id) {
      activeOrders = activeOrders.filter(o => 
        o.restaurant_id === user.restaurant_id
      );
    }
    
    // Calcular tiempo de espera para cada pedido
    const ordersWithWaitTime = activeOrders.map(order => {
      const waitTimeMs = Date.now() - new Date(order.created_at).getTime();
      const waitTimeMin = Math.floor(waitTimeMs / 60000);
      
      return {
        ...order,
        wait_time_minutes: waitTimeMin,
        urgency: waitTimeMin >= 15 ? 'critical' : waitTimeMin >= 10 ? 'urgent' : 'normal',
      };
    });
    
    // Ordenar por urgencia y tiempo de creación
    ordersWithWaitTime.sort((a, b) => {
      // Primero los críticos, luego urgentes, luego normales
      const urgencyOrder = { critical: 0, urgent: 1, normal: 2 };
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      
      // Dentro del mismo nivel de urgencia, los más antiguos primero
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    
    res.json({
      success: true,
      data: ordersWithWaitTime,
      stats: {
        total: ordersWithWaitTime.length,
        created: ordersWithWaitTime.filter(o => o.status === 'created').length,
        confirmed: ordersWithWaitTime.filter(o => o.status === 'confirmed').length,
        preparing: ordersWithWaitTime.filter(o => o.status === 'preparing').length,
        ready: ordersWithWaitTime.filter(o => o.status === 'ready').length,
        urgent: ordersWithWaitTime.filter(o => o.urgency !== 'normal').length,
      },
    });
  } catch (error) {
    console.error('Error fetching kitchen orders:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener pedidos',
    });
  }
});

/**
 * GET /api/kitchen/orders/grouped
 * Obtener pedidos agrupados por estado (para vista de columnas)
 */
router.get('/orders/grouped', authenticate, authorize(['staff', 'admin']), async (req, res) => {
  try {
    const { user } = req;
    
    let activeOrders = kitchenOrders.filter(o => 
      !['delivered', 'paid', 'cancelled'].includes(o.status)
    );
    
    if (user.role === 'staff' && user.restaurant_id) {
      activeOrders = activeOrders.filter(o => 
        o.restaurant_id === user.restaurant_id
      );
    }
    
    // Agregar tiempo de espera
    const ordersWithWaitTime = activeOrders.map(order => {
      const waitTimeMs = Date.now() - new Date(order.created_at).getTime();
      const waitTimeMin = Math.floor(waitTimeMs / 60000);
      
      return {
        ...order,
        wait_time_minutes: waitTimeMin,
        urgency: waitTimeMin >= 15 ? 'critical' : waitTimeMin >= 10 ? 'urgent' : 'normal',
      };
    });
    
    // Agrupar por estado
    const grouped = {
      created: ordersWithWaitTime.filter(o => o.status === 'created'),
      confirmed: ordersWithWaitTime.filter(o => o.status === 'confirmed'),
      preparing: ordersWithWaitTime.filter(o => o.status === 'preparing'),
      ready: ordersWithWaitTime.filter(o => o.status === 'ready'),
    };
    
    res.json({
      success: true,
      data: grouped,
      counts: {
        created: grouped.created.length,
        confirmed: grouped.confirmed.length,
        preparing: grouped.preparing.length,
        ready: grouped.ready.length,
        total: activeOrders.length,
      },
    });
  } catch (error) {
    console.error('Error fetching grouped orders:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener pedidos agrupados',
    });
  }
});

/**
 * PATCH /api/kitchen/orders/:id/status
 * Actualizar estado de pedido desde KDS
 */
router.patch('/orders/:id/status', authenticate, authorize(['staff', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { user } = req;
    
    const validStatuses = ['confirmed', 'preparing', 'ready', 'delivered'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Estado inválido para cocina',
        valid_statuses: validStatuses,
      });
    }
    
    const orderIndex = kitchenOrders.findIndex(o => o.id === id);
    
    if (orderIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado',
      });
    }
    
    const order = kitchenOrders[orderIndex];
    
    // Validar restaurante
    if (user.role === 'staff' && order.restaurant_id !== user.restaurant_id) {
      return res.status(403).json({
        success: false,
        error: 'No tiene acceso a este pedido',
      });
    }
    
    // Actualizar estado
    kitchenOrders[orderIndex] = {
      ...order,
      status,
      [`${status}_at`]: new Date().toISOString(),
      updated_by: user.id,
    };
    
    // En producción: emitir WebSocket
    // io.to(`kitchen:${order.restaurant_id}`).emit('order_updated', kitchenOrders[orderIndex]);
    // io.to(`table:${order.table_id}`).emit('order_status', { id, status });
    
    res.json({
      success: true,
      data: kitchenOrders[orderIndex],
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
 * POST /api/kitchen/orders/:id/bump
 * "Bump" un pedido al siguiente estado (flujo KDS)
 */
router.post('/orders/:id/bump', authenticate, authorize(['staff', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    const orderIndex = kitchenOrders.findIndex(o => o.id === id);
    
    if (orderIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado',
      });
    }
    
    const order = kitchenOrders[orderIndex];
    
    // Validar restaurante
    if (user.role === 'staff' && order.restaurant_id !== user.restaurant_id) {
      return res.status(403).json({
        success: false,
        error: 'No tiene acceso a este pedido',
      });
    }
    
    // Determinar siguiente estado
    const stateFlow = {
      created: 'confirmed',
      confirmed: 'preparing',
      preparing: 'ready',
      ready: 'delivered',
    };
    
    const nextStatus = stateFlow[order.status];
    
    if (!nextStatus) {
      return res.status(400).json({
        success: false,
        error: 'Pedido ya está en estado final',
        current_status: order.status,
      });
    }
    
    // Actualizar
    kitchenOrders[orderIndex] = {
      ...order,
      status: nextStatus,
      [`${nextStatus}_at`]: new Date().toISOString(),
      bumped_by: user.id,
    };
    
    res.json({
      success: true,
      data: kitchenOrders[orderIndex],
      message: `Pedido bumped a '${nextStatus}'`,
      previous_status: order.status,
    });
  } catch (error) {
    console.error('Error bumping order:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar bump',
    });
  }
});

/**
 * GET /api/kitchen/stats
 * Estadísticas del KDS
 */
router.get('/stats', authenticate, authorize(['staff', 'admin']), async (req, res) => {
  try {
    const { user } = req;
    const { period = 'today' } = req.query;
    
    let orders = kitchenOrders;
    
    if (user.role === 'staff' && user.restaurant_id) {
      orders = orders.filter(o => o.restaurant_id === user.restaurant_id);
    }
    
    // Calcular estadísticas
    const activeOrders = orders.filter(o => 
      !['delivered', 'paid', 'cancelled'].includes(o.status)
    );
    
    const avgWaitTime = activeOrders.length > 0
      ? activeOrders.reduce((sum, o) => {
          const waitMs = Date.now() - new Date(o.created_at).getTime();
          return sum + Math.floor(waitMs / 60000);
        }, 0) / activeOrders.length
      : 0;
    
    const urgentOrders = activeOrders.filter(o => {
      const waitMin = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
      return waitMin >= 10;
    });
    
    res.json({
      success: true,
      data: {
        active_orders: activeOrders.length,
        pending_orders: orders.filter(o => o.status === 'created').length,
        preparing_orders: orders.filter(o => o.status === 'preparing').length,
        ready_orders: orders.filter(o => o.status === 'ready').length,
        urgent_orders: urgentOrders.length,
        avg_wait_time_minutes: Math.round(avgWaitTime),
        total_items_pending: activeOrders.reduce((sum, o) => 
          sum + o.items.reduce((iSum, item) => iSum + item.quantity, 0)
        , 0),
      },
    });
  } catch (error) {
    console.error('Error fetching kitchen stats:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas',
    });
  }
});

module.exports = router;
