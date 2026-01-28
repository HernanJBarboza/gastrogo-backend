/**
 * GASTROGO - WebSocket Tests
 * Tests para validar sistema de comunicación en tiempo real
 */

const { EVENTS, handlers, wsService, WebSocketService } = require('../services/websocket');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ❌ ${name}`);
    console.log(`     Error: ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Reset service entre tests
function resetService() {
  wsService.rooms.clear();
  wsService.connections.clear();
  wsService.eventLog = [];
}

// ═══════════════════════════════════════════════════════════
// TEST 1: Connection Management
// ═══════════════════════════════════════════════════════════
console.log('\n🔷 TEST 1: Connection Management');

test('connect registra cliente correctamente', () => {
  resetService();
  
  const result = wsService.connect('client-1', { type: 'table', tableId: 5 });
  
  assert(result === true, 'connect debe retornar true');
  assert(wsService.connections.has('client-1'), 'cliente debe estar en connections');
  
  const client = wsService.connections.get('client-1');
  assert(client.type === 'table', 'datos del cliente deben persistir');
});

test('disconnect remueve cliente', () => {
  resetService();
  wsService.connect('client-1', {});
  
  wsService.disconnect('client-1');
  
  assert(!wsService.connections.has('client-1'), 'cliente debe ser removido');
});

test('disconnect remueve cliente de todas las salas', () => {
  resetService();
  wsService.connect('client-1', {});
  wsService.joinRoom('client-1', 'room-a');
  wsService.joinRoom('client-1', 'room-b');
  
  wsService.disconnect('client-1');
  
  assert(!wsService.rooms.get('room-a')?.has('client-1'), 'cliente removido de room-a');
  assert(!wsService.rooms.get('room-b')?.has('client-1'), 'cliente removido de room-b');
});

// ═══════════════════════════════════════════════════════════
// TEST 2: Room Management
// ═══════════════════════════════════════════════════════════
console.log('\n🔷 TEST 2: Room Management');

test('joinRoom crea sala si no existe', () => {
  resetService();
  wsService.connect('client-1', {});
  
  wsService.joinRoom('client-1', 'new-room');
  
  assert(wsService.rooms.has('new-room'), 'sala debe ser creada');
  assert(wsService.rooms.get('new-room').has('client-1'), 'cliente debe estar en sala');
});

test('joinRoom permite múltiples clientes en sala', () => {
  resetService();
  wsService.connect('client-1', {});
  wsService.connect('client-2', {});
  wsService.connect('client-3', {});
  
  wsService.joinRoom('client-1', 'shared-room');
  wsService.joinRoom('client-2', 'shared-room');
  wsService.joinRoom('client-3', 'shared-room');
  
  assert(wsService.rooms.get('shared-room').size === 3, 'sala debe tener 3 miembros');
});

test('leaveRoom remueve cliente de sala', () => {
  resetService();
  wsService.connect('client-1', {});
  wsService.joinRoom('client-1', 'room');
  
  wsService.leaveRoom('client-1', 'room');
  
  assert(!wsService.rooms.get('room').has('client-1'), 'cliente debe ser removido de sala');
});

// ═══════════════════════════════════════════════════════════
// TEST 3: Event Emission
// ═══════════════════════════════════════════════════════════
console.log('\n🔷 TEST 3: Event Emission');

test('emitToRoom envía a todos los miembros', () => {
  resetService();
  wsService.connect('client-1', {});
  wsService.connect('client-2', {});
  wsService.joinRoom('client-1', 'room');
  wsService.joinRoom('client-2', 'room');
  
  const result = wsService.emitToRoom('room', 'test_event', { data: 'test' });
  
  assert(result.delivered === 2, 'debe entregar a 2 clientes');
  assert(result.event === 'test_event', 'evento debe coincidir');
});

test('emitToRoom retorna 0 para sala vacía', () => {
  resetService();
  
  const result = wsService.emitToRoom('empty-room', 'test_event', {});
  
  assert(result.delivered === 0, 'debe retornar 0 para sala vacía');
});

test('emitToClient envía a cliente específico', () => {
  resetService();
  wsService.connect('target-client', {});
  
  const result = wsService.emitToClient('target-client', 'private_event', { secret: true });
  
  assert(result.delivered === true, 'debe entregar al cliente');
  assert(result.clientId === 'target-client', 'clientId debe coincidir');
});

test('emitToClient falla para cliente inexistente', () => {
  resetService();
  
  const result = wsService.emitToClient('non-existent', 'event', {});
  
  assert(result.delivered === false, 'debe fallar para cliente inexistente');
});

test('broadcast envía a todos los conectados', () => {
  resetService();
  wsService.connect('client-1', {});
  wsService.connect('client-2', {});
  wsService.connect('client-3', {});
  
  const result = wsService.broadcast('global_event', { important: true });
  
  assert(result.delivered === 3, 'debe entregar a 3 clientes');
});

// ═══════════════════════════════════════════════════════════
// TEST 4: Event Handlers
// ═══════════════════════════════════════════════════════════
console.log('\n🔷 TEST 4: Event Handlers');

test('JOIN_TABLE handler une a salas correctas', () => {
  resetService();
  wsService.connect('client-1', {});
  
  const result = handlers[EVENTS.CLIENT.JOIN_TABLE](
    wsService,
    'client-1',
    { tableId: 'table-5', sessionId: 'session-123' }
  );
  
  assert(result.success === true, 'handler debe retornar success');
  assert(wsService.rooms.get('table:table-5').has('client-1'), 'cliente debe estar en sala de mesa');
  assert(wsService.rooms.get('session:session-123').has('client-1'), 'cliente debe estar en sala de sesión');
});

test('NEW_ORDER handler notifica a cocina', () => {
  resetService();
  wsService.connect('kitchen-1', {});
  wsService.joinRoom('kitchen-1', 'kitchen:rest-001');
  wsService.connect('table-client', {});
  wsService.joinRoom('table-client', 'table:table-5');
  
  const result = handlers[EVENTS.CLIENT.NEW_ORDER](
    wsService,
    'table-client',
    {
      order: { id: 'ord-1', tableId: 'table-5' },
      restaurantId: 'rest-001',
    }
  );
  
  assert(result.success === true, 'handler debe retornar success');
  assert(result.kitchenNotified === true, 'cocina debe ser notificada');
});

test('UPDATE_STATUS handler notifica a mesa y cocina', () => {
  resetService();
  wsService.connect('table-client', {});
  wsService.joinRoom('table-client', 'table:table-5');
  wsService.connect('kitchen', {});
  wsService.joinRoom('kitchen', 'kitchen:rest-001');
  
  const result = handlers[EVENTS.KITCHEN.UPDATE_STATUS](
    wsService,
    'kitchen',
    {
      orderId: 'ord-1',
      status: 'preparing',
      tableId: 'table-5',
      restaurantId: 'rest-001',
    }
  );
  
  assert(result.success === true, 'handler debe retornar success');
  assert(result.tableNotified === true, 'mesa debe ser notificada');
});

test('CALL_WAITER handler notifica a staff', () => {
  resetService();
  wsService.connect('staff-1', {});
  wsService.joinRoom('staff-1', 'staff:rest-001');
  
  const result = handlers[EVENTS.CLIENT.CALL_WAITER](
    wsService,
    'table-client',
    {
      tableId: 'table-5',
      tableNumber: 5,
      restaurantId: 'rest-001',
    }
  );
  
  assert(result.success === true, 'handler debe retornar success');
  assert(result.message.includes('Mozo'), 'mensaje debe mencionar mozo');
});

test('JOIN_KITCHEN handler une a sala de cocina', () => {
  resetService();
  wsService.connect('kds-device', {});
  
  const result = handlers[EVENTS.KITCHEN.JOIN_KITCHEN](
    wsService,
    'kds-device',
    { restaurantId: 'rest-001' }
  );
  
  assert(result.success === true, 'handler debe retornar success');
  assert(wsService.rooms.get('kitchen:rest-001').has('kds-device'), 'KDS debe estar en sala de cocina');
});

// ═══════════════════════════════════════════════════════════
// TEST 5: Statistics
// ═══════════════════════════════════════════════════════════
console.log('\n🔷 TEST 5: Statistics');

test('getStats retorna datos correctos', () => {
  resetService();
  wsService.connect('client-1', {});
  wsService.connect('client-2', {});
  wsService.joinRoom('client-1', 'room-a');
  wsService.joinRoom('client-2', 'room-a');
  wsService.joinRoom('client-1', 'room-b');
  
  const stats = wsService.getStats();
  
  assert(stats.connections === 2, 'debe reportar 2 conexiones');
  assert(stats.rooms === 2, 'debe reportar 2 salas');
  assert(Array.isArray(stats.roomDetails), 'roomDetails debe ser array');
  assert(Array.isArray(stats.recentEvents), 'recentEvents debe ser array');
});

test('Event log mantiene máximo 100 eventos', () => {
  resetService();
  
  // Generar más de 100 eventos
  for (let i = 0; i < 120; i++) {
    wsService.log('test', `client-${i}`, {});
  }
  
  assert(wsService.eventLog.length === 100, 'log debe mantener máximo 100 eventos');
});

// ═══════════════════════════════════════════════════════════
// TEST 6: Event Constants
// ═══════════════════════════════════════════════════════════
console.log('\n🔷 TEST 6: Event Constants');

test('EVENTS.CLIENT tiene todos los eventos necesarios', () => {
  assert(EVENTS.CLIENT.JOIN_TABLE, 'JOIN_TABLE debe existir');
  assert(EVENTS.CLIENT.NEW_ORDER, 'NEW_ORDER debe existir');
  assert(EVENTS.CLIENT.CALL_WAITER, 'CALL_WAITER debe existir');
  assert(EVENTS.CLIENT.REQUEST_BILL, 'REQUEST_BILL debe existir');
});

test('EVENTS.KITCHEN tiene todos los eventos necesarios', () => {
  assert(EVENTS.KITCHEN.JOIN_KITCHEN, 'JOIN_KITCHEN debe existir');
  assert(EVENTS.KITCHEN.UPDATE_STATUS, 'UPDATE_STATUS debe existir');
  assert(EVENTS.KITCHEN.BUMP_ORDER, 'BUMP_ORDER debe existir');
});

test('EVENTS.SERVER tiene todos los eventos necesarios', () => {
  assert(EVENTS.SERVER.ORDER_CREATED, 'ORDER_CREATED debe existir');
  assert(EVENTS.SERVER.ORDER_UPDATED, 'ORDER_UPDATED debe existir');
  assert(EVENTS.SERVER.ORDER_READY, 'ORDER_READY debe existir');
  assert(EVENTS.SERVER.WAITER_NOTIFIED, 'WAITER_NOTIFIED debe existir');
});

// ═══════════════════════════════════════════════════════════
// RESULTADOS
// ═══════════════════════════════════════════════════════════
console.log('\n════════════════════════════════════════════════════════');
console.log('📊 RESULTADOS DE TESTS WEBSOCKET');
console.log('════════════════════════════════════════════════════════');
console.log(`   Pasaron: ${passed}`);
console.log(`   Fallaron: ${failed}`);
console.log(`   Total: ${passed + failed}`);
console.log('════════════════════════════════════════════════════════');

if (failed === 0) {
  console.log('\n✅ TODOS LOS TESTS DE WEBSOCKET PASARON');
  console.log('✅ COMUNICACIÓN EN TIEMPO REAL VALIDADA\n');
} else {
  console.log(`\n❌ ${failed} tests fallaron`);
  process.exit(1);
}
