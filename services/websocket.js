/**
 * GASTROGO - WebSocket Service
 * Comunicación en tiempo real entre clientes y KDS
 */

// En producción usar: npm install socket.io
// const { Server } = require('socket.io');

/**
 * Configuración de WebSocket para GastroGO
 * Este archivo define la estructura de eventos y handlers
 */

const EVENTS = {
  // Eventos del cliente (mesa -> servidor)
  CLIENT: {
    JOIN_TABLE: 'client:join_table',      // Cliente se une a sala de mesa
    NEW_ORDER: 'client:new_order',         // Cliente envía nuevo pedido
    CALL_WAITER: 'client:call_waiter',     // Cliente llama al mozo
    REQUEST_BILL: 'client:request_bill',   // Cliente pide la cuenta
  },
  
  // Eventos del KDS (cocina -> servidor)
  KITCHEN: {
    JOIN_KITCHEN: 'kitchen:join',          // KDS se conecta
    UPDATE_STATUS: 'kitchen:update_status', // KDS cambia estado de pedido
    BUMP_ORDER: 'kitchen:bump_order',      // KDS avanza pedido
    PRINT_ORDER: 'kitchen:print_order',    // KDS imprime pedido
  },
  
  // Eventos del servidor (servidor -> clientes)
  SERVER: {
    ORDER_CREATED: 'server:order_created',     // Pedido creado (a KDS)
    ORDER_UPDATED: 'server:order_updated',     // Estado actualizado (a todos)
    ORDER_READY: 'server:order_ready',         // Pedido listo (a mesa)
    WAITER_NOTIFIED: 'server:waiter_notified', // Mozo notificado
    BILL_REQUESTED: 'server:bill_requested',   // Cuenta solicitada
    NEW_NOTIFICATION: 'server:notification',   // Notificación general
  },
};

/**
 * Simula Socket.IO Server
 * En producción se integra con el servidor Express
 */
class WebSocketService {
  constructor() {
    this.rooms = new Map();      // room_id -> Set of connections
    this.connections = new Map(); // connection_id -> connection data
    this.eventLog = [];          // Log de eventos para debug
  }
  
  /**
   * Simula conexión de cliente
   */
  connect(clientId, data) {
    this.connections.set(clientId, {
      id: clientId,
      ...data,
      connectedAt: new Date().toISOString(),
    });
    
    this.log('connect', clientId, data);
    return true;
  }
  
  /**
   * Simula desconexión
   */
  disconnect(clientId) {
    const client = this.connections.get(clientId);
    if (client) {
      // Remover de todas las salas
      this.rooms.forEach((members, room) => {
        members.delete(clientId);
      });
      this.connections.delete(clientId);
    }
    
    this.log('disconnect', clientId);
    return true;
  }
  
  /**
   * Unirse a una sala
   */
  joinRoom(clientId, room) {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room).add(clientId);
    
    this.log('join_room', clientId, { room });
    return true;
  }
  
  /**
   * Salir de una sala
   */
  leaveRoom(clientId, room) {
    if (this.rooms.has(room)) {
      this.rooms.get(room).delete(clientId);
    }
    
    this.log('leave_room', clientId, { room });
    return true;
  }
  
  /**
   * Emitir evento a una sala
   */
  emitToRoom(room, event, data) {
    const members = this.rooms.get(room);
    if (!members || members.size === 0) {
      return { delivered: 0 };
    }
    
    this.log('emit_to_room', room, { event, data, recipients: members.size });
    
    return {
      delivered: members.size,
      room,
      event,
    };
  }
  
  /**
   * Emitir evento a un cliente específico
   */
  emitToClient(clientId, event, data) {
    const client = this.connections.get(clientId);
    if (!client) {
      return { delivered: false };
    }
    
    this.log('emit_to_client', clientId, { event, data });
    
    return {
      delivered: true,
      clientId,
      event,
    };
  }
  
  /**
   * Broadcast a todos los conectados
   */
  broadcast(event, data) {
    const count = this.connections.size;
    
    this.log('broadcast', null, { event, data, recipients: count });
    
    return {
      delivered: count,
      event,
    };
  }
  
  /**
   * Log interno
   */
  log(action, clientId, data = {}) {
    this.eventLog.push({
      timestamp: new Date().toISOString(),
      action,
      clientId,
      data,
    });
    
    // Mantener solo últimos 100 eventos
    if (this.eventLog.length > 100) {
      this.eventLog.shift();
    }
  }
  
  /**
   * Obtener estadísticas
   */
  getStats() {
    return {
      connections: this.connections.size,
      rooms: this.rooms.size,
      roomDetails: Array.from(this.rooms.entries()).map(([room, members]) => ({
        room,
        members: members.size,
      })),
      recentEvents: this.eventLog.slice(-10),
    };
  }
}

/**
 * Handlers para eventos de GastroGO
 */
const handlers = {
  // Cliente se une a sala de mesa
  [EVENTS.CLIENT.JOIN_TABLE]: (ws, clientId, { tableId, sessionId }) => {
    ws.joinRoom(clientId, `table:${tableId}`);
    ws.joinRoom(clientId, `session:${sessionId}`);
    
    return {
      success: true,
      message: `Conectado a mesa ${tableId}`,
    };
  },
  
  // Nuevo pedido desde cliente
  [EVENTS.CLIENT.NEW_ORDER]: (ws, clientId, { order, restaurantId }) => {
    // Notificar a cocina
    const kitchenResult = ws.emitToRoom(`kitchen:${restaurantId}`, EVENTS.SERVER.ORDER_CREATED, { order });
    
    // Notificar a la mesa
    ws.emitToRoom(`table:${order.tableId}`, EVENTS.SERVER.ORDER_CREATED, { 
      orderId: order.id,
      status: 'created',
    });
    
    return {
      success: true,
      kitchenNotified: kitchenResult.delivered > 0,
    };
  },
  
  // KDS actualiza estado
  [EVENTS.KITCHEN.UPDATE_STATUS]: (ws, clientId, { orderId, status, tableId, restaurantId }) => {
    // Notificar a mesa
    const tableResult = ws.emitToRoom(`table:${tableId}`, EVENTS.SERVER.ORDER_UPDATED, {
      orderId,
      status,
    });
    
    // Notificar a todas las cocinas
    ws.emitToRoom(`kitchen:${restaurantId}`, EVENTS.SERVER.ORDER_UPDATED, {
      orderId,
      status,
    });
    
    // Si está listo, notificación especial
    if (status === 'ready') {
      ws.emitToRoom(`table:${tableId}`, EVENTS.SERVER.ORDER_READY, {
        orderId,
        message: '¡Tu pedido está listo!',
      });
    }
    
    return {
      success: true,
      tableNotified: tableResult.delivered > 0,
    };
  },
  
  // Cliente llama al mozo
  [EVENTS.CLIENT.CALL_WAITER]: (ws, clientId, { tableId, tableNumber, restaurantId }) => {
    // Notificar a staff
    const staffResult = ws.emitToRoom(`staff:${restaurantId}`, EVENTS.SERVER.WAITER_NOTIFIED, {
      tableId,
      tableNumber,
      type: 'call_waiter',
      timestamp: new Date().toISOString(),
    });
    
    return {
      success: true,
      staffNotified: staffResult.delivered > 0,
      message: 'Mozo notificado',
    };
  },
  
  // Cliente pide la cuenta
  [EVENTS.CLIENT.REQUEST_BILL]: (ws, clientId, { tableId, tableNumber, restaurantId }) => {
    ws.emitToRoom(`staff:${restaurantId}`, EVENTS.SERVER.BILL_REQUESTED, {
      tableId,
      tableNumber,
      timestamp: new Date().toISOString(),
    });
    
    return {
      success: true,
      message: 'Cuenta solicitada',
    };
  },
  
  // KDS se conecta
  [EVENTS.KITCHEN.JOIN_KITCHEN]: (ws, clientId, { restaurantId }) => {
    ws.joinRoom(clientId, `kitchen:${restaurantId}`);
    
    return {
      success: true,
      message: `KDS conectado a restaurante ${restaurantId}`,
    };
  },
};

// Instancia singleton
const wsService = new WebSocketService();

module.exports = {
  EVENTS,
  handlers,
  wsService,
  WebSocketService,
};
