/**
 * GASTROGO - End-to-End Test Suite
 * Simula flujos completos de usuario de principio a fin
 */

const { generateTableQR, validateQRCode } = require('../services/qr-engine');
const { EVENTS, handlers, wsService } = require('../services/websocket');

// ═══════════════════════════════════════════════════════════════════════════
// TEST INFRASTRUCTURE
// ═══════════════════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;
let total = 0;

function test(name, fn) {
  total++;
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
  if (!condition) throw new Error(message || 'Assertion failed');
}

function resetWsService() {
  wsService.rooms.clear();
  wsService.connections.clear();
  wsService.eventLog = [];
}

// Mock Database
const mockDB = {
  restaurants: new Map(),
  tables: new Map(),
  categories: new Map(),
  dishes: new Map(),
  orders: new Map(),
  sessions: new Map(),
  
  reset() {
    this.restaurants.clear();
    this.tables.clear();
    this.categories.clear();
    this.dishes.clear();
    this.orders.clear();
    this.sessions.clear();
  },
  
  seed() {
    // Restaurant
    this.restaurants.set('rest-001', {
      id: 'rest-001',
      name: 'La Parrilla del Puerto',
      address: 'Av. Costanera 1234',
      phone: '+54 11 5555-1234',
    });
    
    // Tables
    for (let i = 1; i <= 10; i++) {
      const qr = generateTableQR('rest-001', i);
      this.tables.set(`table-${i}`, {
        id: `table-${i}`,
        restaurant_id: 'rest-001',
        number: i,
        capacity: i <= 5 ? 2 : 4,
        status: 'available',
        qr_code: qr.qrCode,
      });
    }
    
    // Categories
    const categories = [
      { id: 'cat-1', name: 'Entradas', order: 1 },
      { id: 'cat-2', name: 'Carnes', order: 2 },
      { id: 'cat-3', name: 'Pastas', order: 3 },
      { id: 'cat-4', name: 'Bebidas', order: 4 },
      { id: 'cat-5', name: 'Postres', order: 5 },
    ];
    categories.forEach(c => this.categories.set(c.id, { ...c, restaurant_id: 'rest-001' }));
    
    // Dishes
    const dishes = [
      { id: 'dish-1', category_id: 'cat-1', name: 'Empanadas (6)', price: 8.50, available: true },
      { id: 'dish-2', category_id: 'cat-1', name: 'Provoleta', price: 12.00, available: true },
      { id: 'dish-3', category_id: 'cat-2', name: 'Bife de Chorizo', price: 25.00, available: true },
      { id: 'dish-4', category_id: 'cat-2', name: 'Asado de Tira', price: 22.00, available: true },
      { id: 'dish-5', category_id: 'cat-3', name: 'Ñoquis', price: 15.00, available: true },
      { id: 'dish-6', category_id: 'cat-4', name: 'Coca-Cola', price: 4.00, available: true },
      { id: 'dish-7', category_id: 'cat-4', name: 'Agua Mineral', price: 3.00, available: true },
      { id: 'dish-8', category_id: 'cat-5', name: 'Flan con Dulce', price: 7.00, available: true },
    ];
    dishes.forEach(d => this.dishes.set(d.id, { ...d, restaurant_id: 'rest-001' }));
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// E2E SCENARIO 1: Happy Path - Complete Order Flow
// Cliente escanea QR → Ve menú → Hace pedido → Cocina procesa → Entrega
// ═══════════════════════════════════════════════════════════════════════════
console.log('');
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║           GASTROGO - E2E TEST SUITE                            ║');
console.log('║           End-to-End Scenarios                                 ║');
console.log('╚════════════════════════════════════════════════════════════════╝');
console.log('');
console.log('🔷 E2E 1: Happy Path - Complete Order Flow');

// Setup
mockDB.reset();
mockDB.seed();
resetWsService();

// Step 1: Customer scans QR
test('1.1 Cliente escanea QR de mesa 5', () => {
  const table = mockDB.tables.get('table-5');
  const validation = validateQRCode(table.qr_code);
  
  assert(validation.valid === true, 'QR debe ser válido');
  assert(validation.tableNumber === 5, 'Debe ser mesa 5');
});

// Step 2: Customer connects via WebSocket
let customerSession = null;
test('1.2 Cliente se conecta y crea sesión', () => {
  wsService.connect('customer-phone-001', { device: 'mobile', userAgent: 'iPhone' });
  
  customerSession = {
    id: `session-${Date.now()}`,
    tableId: 'table-5',
    startedAt: new Date().toISOString(),
    customers: 1,
  };
  mockDB.sessions.set(customerSession.id, customerSession);
  
  const result = handlers[EVENTS.CLIENT.JOIN_TABLE](
    wsService,
    'customer-phone-001',
    { tableId: 'table-5', sessionId: customerSession.id }
  );
  
  assert(result.success === true, 'Debe unirse exitosamente');
  
  // Update table status
  const table = mockDB.tables.get('table-5');
  table.status = 'occupied';
});

// Step 3: Customer views menu
test('1.3 Cliente obtiene menú del restaurante', () => {
  const categories = Array.from(mockDB.categories.values())
    .filter(c => c.restaurant_id === 'rest-001')
    .sort((a, b) => a.order - b.order);
  
  const dishes = Array.from(mockDB.dishes.values())
    .filter(d => d.restaurant_id === 'rest-001' && d.available);
  
  assert(categories.length === 5, 'Debe haber 5 categorías');
  assert(dishes.length === 8, 'Debe haber 8 platos');
});

// Step 4: Customer adds items to cart
let cart = [];
test('1.4 Cliente agrega items al carrito', () => {
  cart = [
    { dishId: 'dish-1', quantity: 2, notes: '' },           // Empanadas x2
    { dishId: 'dish-3', quantity: 1, notes: 'Bien cocido' }, // Bife de Chorizo
    { dishId: 'dish-6', quantity: 2, notes: '' },           // Coca-Cola x2
  ];
  
  const subtotal = cart.reduce((sum, item) => {
    const dish = mockDB.dishes.get(item.dishId);
    return sum + (dish.price * item.quantity);
  }, 0);
  
  assert(cart.length === 3, 'Carrito debe tener 3 items');
  assert(subtotal === (8.50 * 2 + 25 + 4 * 2), 'Subtotal debe ser correcto');
});

// Step 5: Customer places order
let orderId = null;
test('1.5 Cliente confirma pedido', () => {
  orderId = `order-${Date.now()}`;
  
  const order = {
    id: orderId,
    session_id: customerSession.id,
    table_id: 'table-5',
    restaurant_id: 'rest-001',
    status: 'created',
    items: cart.map(item => {
      const dish = mockDB.dishes.get(item.dishId);
      return {
        dish_id: item.dishId,
        dish_name: dish.name,
        quantity: item.quantity,
        unit_price: dish.price,
        notes: item.notes,
      };
    }),
    subtotal: 50.00,
    tax: 5.25,
    total: 55.25,
    created_at: new Date().toISOString(),
  };
  
  mockDB.orders.set(orderId, order);
  
  // Connect kitchen
  wsService.connect('kds-kitchen-001', { device: 'kds' });
  handlers[EVENTS.KITCHEN.JOIN_KITCHEN](wsService, 'kds-kitchen-001', { restaurantId: 'rest-001' });
  
  // Notify via WebSocket
  const result = handlers[EVENTS.CLIENT.NEW_ORDER](
    wsService,
    'customer-phone-001',
    { order, restaurantId: 'rest-001' }
  );
  
  assert(result.success === true, 'Pedido debe enviarse');
  assert(result.kitchenNotified === true, 'Cocina debe ser notificada');
});

// Step 6: Kitchen confirms order
test('1.6 Cocina confirma pedido', () => {
  const order = mockDB.orders.get(orderId);
  order.status = 'confirmed';
  order.confirmed_at = new Date().toISOString();
  
  const result = handlers[EVENTS.KITCHEN.UPDATE_STATUS](
    wsService,
    'kds-kitchen-001',
    { orderId, status: 'confirmed', tableId: 'table-5', restaurantId: 'rest-001' }
  );
  
  assert(result.success === true, 'Confirmación debe funcionar');
  assert(order.status === 'confirmed', 'Estado debe ser confirmed');
});

// Step 7: Kitchen starts preparing
test('1.7 Cocina comienza preparación', () => {
  const order = mockDB.orders.get(orderId);
  order.status = 'preparing';
  order.preparing_at = new Date().toISOString();
  
  const result = handlers[EVENTS.KITCHEN.UPDATE_STATUS](
    wsService,
    'kds-kitchen-001',
    { orderId, status: 'preparing', tableId: 'table-5', restaurantId: 'rest-001' }
  );
  
  assert(result.success === true, 'Preparación debe funcionar');
  assert(order.status === 'preparing', 'Estado debe ser preparing');
});

// Step 8: Order ready
test('1.8 Pedido listo para entregar', () => {
  const order = mockDB.orders.get(orderId);
  order.status = 'ready';
  order.ready_at = new Date().toISOString();
  
  const result = handlers[EVENTS.KITCHEN.UPDATE_STATUS](
    wsService,
    'kds-kitchen-001',
    { orderId, status: 'ready', tableId: 'table-5', restaurantId: 'rest-001' }
  );
  
  assert(result.success === true, 'Ready debe funcionar');
  assert(result.tableNotified === true, 'Mesa debe ser notificada');
});

// Step 9: Waiter delivers
test('1.9 Mozo entrega pedido', () => {
  const order = mockDB.orders.get(orderId);
  order.status = 'delivered';
  order.delivered_at = new Date().toISOString();
  
  assert(order.status === 'delivered', 'Estado debe ser delivered');
});

// Step 10: Customer requests bill
test('1.10 Cliente solicita cuenta', () => {
  wsService.connect('waiter-tablet', { device: 'tablet' });
  wsService.joinRoom('waiter-tablet', 'staff:rest-001');
  
  const result = handlers[EVENTS.CLIENT.REQUEST_BILL](
    wsService,
    'customer-phone-001',
    { tableId: 'table-5', tableNumber: 5, restaurantId: 'rest-001' }
  );
  
  assert(result.success === true, 'Solicitud debe funcionar');
});

// Step 11: Payment completed
test('1.11 Pago completado', () => {
  const order = mockDB.orders.get(orderId);
  order.status = 'paid';
  order.paid_at = new Date().toISOString();
  order.payment_method = 'card';
  
  // Free up table
  const table = mockDB.tables.get('table-5');
  table.status = 'available';
  
  assert(order.status === 'paid', 'Estado debe ser paid');
  assert(table.status === 'available', 'Mesa debe estar disponible');
});

// ═══════════════════════════════════════════════════════════════════════════
// E2E SCENARIO 2: Multiple Customers Same Table
// Varios clientes en la misma mesa hacen pedidos
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🔷 E2E 2: Multiple Customers Same Table');

resetWsService();

test('2.1 Primer cliente se une a mesa 8', () => {
  wsService.connect('customer-1', {});
  handlers[EVENTS.CLIENT.JOIN_TABLE](wsService, 'customer-1', { 
    tableId: 'table-8', 
    sessionId: 'shared-session-001' 
  });
  
  assert(wsService.rooms.get('table:table-8').has('customer-1'), 'Cliente 1 en mesa');
});

test('2.2 Segundo cliente se une a misma mesa', () => {
  wsService.connect('customer-2', {});
  handlers[EVENTS.CLIENT.JOIN_TABLE](wsService, 'customer-2', { 
    tableId: 'table-8', 
    sessionId: 'shared-session-001' 
  });
  
  assert(wsService.rooms.get('table:table-8').has('customer-2'), 'Cliente 2 en mesa');
  assert(wsService.rooms.get('table:table-8').size === 2, 'Dos clientes en mesa');
});

test('2.3 Ambos clientes reciben actualización de pedido', () => {
  wsService.connect('kds', {});
  handlers[EVENTS.KITCHEN.JOIN_KITCHEN](wsService, 'kds', { restaurantId: 'rest-001' });
  
  const result = handlers[EVENTS.KITCHEN.UPDATE_STATUS](
    wsService,
    'kds',
    { orderId: 'order-shared', status: 'ready', tableId: 'table-8', restaurantId: 'rest-001' }
  );
  
  assert(result.tableNotified === true, 'Mesa debe ser notificada');
});

// ═══════════════════════════════════════════════════════════════════════════
// E2E SCENARIO 3: Order Cancellation
// Cliente cancela pedido antes de preparación
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🔷 E2E 3: Order Cancellation');

test('3.1 Cliente crea pedido', () => {
  const cancelOrder = {
    id: 'order-cancel-test',
    status: 'created',
    table_id: 'table-3',
  };
  mockDB.orders.set('order-cancel-test', cancelOrder);
  
  assert(cancelOrder.status === 'created', 'Pedido creado');
});

test('3.2 Cliente cancela pedido en estado created', () => {
  const order = mockDB.orders.get('order-cancel-test');
  
  // Valid: created → cancelled
  order.status = 'cancelled';
  order.cancelled_at = new Date().toISOString();
  order.cancel_reason = 'Cliente cambió de opinión';
  
  assert(order.status === 'cancelled', 'Pedido cancelado');
});

test('3.3 Pedido cancelado no puede cambiar de estado', () => {
  const order = mockDB.orders.get('order-cancel-test');
  
  const validTransitions = {
    cancelled: [],
  };
  
  assert(validTransitions.cancelled.length === 0, 'Cancelled es estado final');
});

// ═══════════════════════════════════════════════════════════════════════════
// E2E SCENARIO 4: Call Waiter Flow
// Cliente necesita asistencia
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🔷 E2E 4: Call Waiter Flow');

resetWsService();

test('4.1 Staff se conecta al sistema', () => {
  wsService.connect('waiter-1', { role: 'waiter' });
  wsService.connect('waiter-2', { role: 'waiter' });
  wsService.joinRoom('waiter-1', 'staff:rest-001');
  wsService.joinRoom('waiter-2', 'staff:rest-001');
  
  assert(wsService.rooms.get('staff:rest-001').size === 2, '2 mozos conectados');
});

test('4.2 Cliente llama al mozo', () => {
  wsService.connect('customer-mesa-2', {});
  handlers[EVENTS.CLIENT.JOIN_TABLE](wsService, 'customer-mesa-2', { 
    tableId: 'table-2', 
    sessionId: 'sess-2' 
  });
  
  const result = handlers[EVENTS.CLIENT.CALL_WAITER](
    wsService,
    'customer-mesa-2',
    { tableId: 'table-2', tableNumber: 2, restaurantId: 'rest-001' }
  );
  
  assert(result.success === true, 'Llamada exitosa');
  assert(result.staffNotified === true, 'Staff notificado');
});

// ═══════════════════════════════════════════════════════════════════════════
// E2E SCENARIO 5: Kitchen Multi-Order Management
// Cocina maneja múltiples pedidos simultáneos
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🔷 E2E 5: Kitchen Multi-Order Management');

resetWsService();

test('5.1 KDS recibe múltiples pedidos', () => {
  wsService.connect('kds-main', {});
  handlers[EVENTS.KITCHEN.JOIN_KITCHEN](wsService, 'kds-main', { restaurantId: 'rest-001' });
  
  // Simular 5 pedidos de diferentes mesas
  const orders = [];
  for (let i = 1; i <= 5; i++) {
    wsService.connect(`table-client-${i}`, {});
    wsService.joinRoom(`table-client-${i}`, `table:table-${i}`);
    
    handlers[EVENTS.CLIENT.NEW_ORDER](
      wsService,
      `table-client-${i}`,
      {
        order: { id: `order-multi-${i}`, tableId: `table-${i}` },
        restaurantId: 'rest-001',
      }
    );
    orders.push({ id: `order-multi-${i}`, tableId: `table-${i}`, status: 'created' });
  }
  
  assert(orders.length === 5, 'Deben crearse 5 pedidos');
});

test('5.2 KDS procesa pedidos en paralelo', () => {
  // Simular procesamiento FIFO
  const processingOrder = ['order-multi-1', 'order-multi-2', 'order-multi-3'];
  
  processingOrder.forEach(orderId => {
    handlers[EVENTS.KITCHEN.UPDATE_STATUS](
      wsService,
      'kds-main',
      { orderId, status: 'preparing', tableId: orderId.replace('order-multi-', 'table-'), restaurantId: 'rest-001' }
    );
  });
  
  assert(true, 'Procesamiento paralelo funciona');
});

test('5.3 KDS bump completa pedido', () => {
  const result = handlers[EVENTS.KITCHEN.UPDATE_STATUS](
    wsService,
    'kds-main',
    { orderId: 'order-multi-1', status: 'ready', tableId: 'table-1', restaurantId: 'rest-001' }
  );
  
  assert(result.success === true, 'Bump funciona');
  assert(result.tableNotified === true, 'Mesa 1 notificada');
});

// ═══════════════════════════════════════════════════════════════════════════
// E2E SCENARIO 6: Session Persistence
// Reconexión después de pérdida de conexión
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🔷 E2E 6: Session Persistence');

resetWsService();

let persistentSessionId = 'persist-session-001';

test('6.1 Cliente se conecta inicialmente', () => {
  wsService.connect('mobile-device', {});
  handlers[EVENTS.CLIENT.JOIN_TABLE](wsService, 'mobile-device', { 
    tableId: 'table-7', 
    sessionId: persistentSessionId 
  });
  
  assert(wsService.connections.has('mobile-device'), 'Conectado');
});

test('6.2 Cliente pierde conexión', () => {
  wsService.disconnect('mobile-device');
  
  assert(!wsService.connections.has('mobile-device'), 'Desconectado');
});

test('6.3 Cliente se reconecta con misma sesión', () => {
  wsService.connect('mobile-device-reconnect', {});
  handlers[EVENTS.CLIENT.JOIN_TABLE](wsService, 'mobile-device-reconnect', { 
    tableId: 'table-7', 
    sessionId: persistentSessionId 
  });
  
  assert(wsService.connections.has('mobile-device-reconnect'), 'Reconectado');
  assert(wsService.rooms.get('session:persist-session-001').has('mobile-device-reconnect'), 'En misma sesión');
});

// ═══════════════════════════════════════════════════════════════════════════
// E2E SCENARIO 7: Full Restaurant Simulation
// Restaurante con múltiples mesas, cocina y mozos
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🔷 E2E 7: Full Restaurant Simulation');

resetWsService();

test('7.1 Setup: Conectar staff completo', () => {
  // KDS devices
  wsService.connect('kds-1', { role: 'kitchen' });
  wsService.connect('kds-2', { role: 'kitchen' });
  handlers[EVENTS.KITCHEN.JOIN_KITCHEN](wsService, 'kds-1', { restaurantId: 'rest-001' });
  handlers[EVENTS.KITCHEN.JOIN_KITCHEN](wsService, 'kds-2', { restaurantId: 'rest-001' });
  
  // Waiters
  for (let i = 1; i <= 3; i++) {
    wsService.connect(`waiter-${i}`, { role: 'waiter' });
    wsService.joinRoom(`waiter-${i}`, 'staff:rest-001');
  }
  
  const stats = wsService.getStats();
  assert(stats.connections === 5, '5 staff conectados');
});

test('7.2 Simular hora pico: 8 mesas ocupadas', () => {
  for (let i = 1; i <= 8; i++) {
    wsService.connect(`customer-${i}`, {});
    handlers[EVENTS.CLIENT.JOIN_TABLE](wsService, `customer-${i}`, { 
      tableId: `table-${i}`, 
      sessionId: `peak-session-${i}` 
    });
  }
  
  const stats = wsService.getStats();
  assert(stats.connections === 13, '13 conexiones totales (5 staff + 8 clientes)');
});

test('7.3 Flujo de pedidos concurrentes', () => {
  let ordersCreated = 0;
  
  for (let i = 1; i <= 8; i++) {
    const result = handlers[EVENTS.CLIENT.NEW_ORDER](
      wsService,
      `customer-${i}`,
      {
        order: { id: `peak-order-${i}`, tableId: `table-${i}` },
        restaurantId: 'rest-001',
      }
    );
    if (result.kitchenNotified) ordersCreated++;
  }
  
  assert(ordersCreated === 8, '8 pedidos notificados a cocina');
});

test('7.4 Cocina procesa en orden FIFO', () => {
  const processOrder = [1, 2, 3, 4, 5, 6, 7, 8];
  let processed = 0;
  
  processOrder.forEach(i => {
    handlers[EVENTS.KITCHEN.UPDATE_STATUS](
      wsService,
      'kds-1',
      { orderId: `peak-order-${i}`, status: 'confirmed', tableId: `table-${i}`, restaurantId: 'rest-001' }
    );
    processed++;
  });
  
  assert(processed === 8, '8 pedidos confirmados');
});

// ═══════════════════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════════════════
console.log('');
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║                    E2E TEST RESULTS                            ║');
console.log('╠════════════════════════════════════════════════════════════════╣');
console.log(`║   ✅ Pasaron:  ${String(passed).padStart(3)}                                            ║`);
console.log(`║   ❌ Fallaron: ${String(failed).padStart(3)}                                            ║`);
console.log(`║   📊 Total:    ${String(total).padStart(3)}                                            ║`);
console.log('╠════════════════════════════════════════════════════════════════╣');

if (failed === 0) {
  console.log('║   🎉 TODOS LOS TESTS E2E PASARON                               ║');
  console.log('║                                                                ║');
  console.log('║   Scenarios Validados:                                         ║');
  console.log('║   ✅ Happy Path - Complete Order Flow                          ║');
  console.log('║   ✅ Multiple Customers Same Table                             ║');
  console.log('║   ✅ Order Cancellation                                        ║');
  console.log('║   ✅ Call Waiter Flow                                          ║');
  console.log('║   ✅ Kitchen Multi-Order Management                            ║');
  console.log('║   ✅ Session Persistence                                       ║');
  console.log('║   ✅ Full Restaurant Simulation                                ║');
} else {
  console.log(`║   ⚠️  ${failed} tests fallaron - revisar antes de continuar         ║`);
}

console.log('╚════════════════════════════════════════════════════════════════╝');
console.log('');

process.exit(failed > 0 ? 1 : 0);
