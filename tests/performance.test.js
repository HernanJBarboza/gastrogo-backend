/**
 * GASTROGO - Performance Test Suite
 * Pruebas de rendimiento y carga
 */

const { generateTableQR, validateQRCode, generateBulkQRCodes } = require('../services/qr-engine');
const { wsService, handlers, EVENTS } = require('../services/websocket');

// ═══════════════════════════════════════════════════════════════════════════
// PERFORMANCE METRICS
// ═══════════════════════════════════════════════════════════════════════════

const metrics = {
  qrGeneration: [],
  qrValidation: [],
  wsConnect: [],
  wsJoinRoom: [],
  wsEmit: [],
  wsBroadcast: [],
  bulkQR: [],
  orderFlow: [],
};

function measure(name, fn, iterations = 100) {
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    fn(i);
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / 1e6); // Convert to ms
  }
  
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
  const p99 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.99)];
  
  return { avg, min, max, p95, p99, iterations };
}

function resetWs() {
  wsService.rooms.clear();
  wsService.connections.clear();
  wsService.eventLog = [];
}

function formatMs(ms) {
  if (ms < 0.001) return `${(ms * 1000).toFixed(2)}µs`;
  if (ms < 1) return `${ms.toFixed(3)}ms`;
  return `${ms.toFixed(2)}ms`;
}

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARK TESTS
// ═══════════════════════════════════════════════════════════════════════════

console.log('');
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║           GASTROGO - PERFORMANCE TEST SUITE                    ║');
console.log('║           Benchmarks & Load Testing                            ║');
console.log('╚════════════════════════════════════════════════════════════════╝');
console.log('');

// ───────────────────────────────────────────────────────────────────────────
// BENCHMARK 1: QR Code Generation
// ───────────────────────────────────────────────────────────────────────────
console.log('🔷 BENCHMARK 1: QR Code Generation');

const qrGenResult = measure('QR Generation', (i) => {
  generateTableQR(`rest-${i}`, i + 1);
}, 1000);

console.log(`   Iterations: ${qrGenResult.iterations}`);
console.log(`   Average:    ${formatMs(qrGenResult.avg)}`);
console.log(`   Min:        ${formatMs(qrGenResult.min)}`);
console.log(`   Max:        ${formatMs(qrGenResult.max)}`);
console.log(`   P95:        ${formatMs(qrGenResult.p95)}`);
console.log(`   P99:        ${formatMs(qrGenResult.p99)}`);
console.log(`   Throughput: ${Math.floor(1000 / qrGenResult.avg)} ops/sec`);
console.log('');

// ───────────────────────────────────────────────────────────────────────────
// BENCHMARK 2: QR Code Validation
// ───────────────────────────────────────────────────────────────────────────
console.log('🔷 BENCHMARK 2: QR Code Validation');

// Pre-generate QR codes for validation
const qrCodes = [];
for (let i = 0; i < 1000; i++) {
  qrCodes.push(generateTableQR('rest-bench', i + 1).qrCode);
}

const qrValResult = measure('QR Validation', (i) => {
  validateQRCode(qrCodes[i]);
}, 1000);

console.log(`   Iterations: ${qrValResult.iterations}`);
console.log(`   Average:    ${formatMs(qrValResult.avg)}`);
console.log(`   Min:        ${formatMs(qrValResult.min)}`);
console.log(`   Max:        ${formatMs(qrValResult.max)}`);
console.log(`   P95:        ${formatMs(qrValResult.p95)}`);
console.log(`   P99:        ${formatMs(qrValResult.p99)}`);
console.log(`   Throughput: ${Math.floor(1000 / qrValResult.avg)} ops/sec`);
console.log('');

// ───────────────────────────────────────────────────────────────────────────
// BENCHMARK 3: Bulk QR Generation
// ───────────────────────────────────────────────────────────────────────────
console.log('🔷 BENCHMARK 3: Bulk QR Generation (50 tables)');

const tables50 = Array.from({ length: 50 }, (_, i) => ({ tableNumber: i + 1 }));

const bulkResult = measure('Bulk QR (50)', () => {
  generateBulkQRCodes('rest-bulk', tables50);
}, 100);

console.log(`   Iterations: ${bulkResult.iterations}`);
console.log(`   Average:    ${formatMs(bulkResult.avg)}`);
console.log(`   Min:        ${formatMs(bulkResult.min)}`);
console.log(`   Max:        ${formatMs(bulkResult.max)}`);
console.log(`   P95:        ${formatMs(bulkResult.p95)}`);
console.log(`   Per QR:     ${formatMs(bulkResult.avg / 50)}`);
console.log('');

// ───────────────────────────────────────────────────────────────────────────
// BENCHMARK 4: WebSocket Connection
// ───────────────────────────────────────────────────────────────────────────
console.log('🔷 BENCHMARK 4: WebSocket Connection');

resetWs();

const wsConnectResult = measure('WS Connect', (i) => {
  wsService.connect(`client-${i}`, { index: i });
}, 1000);

console.log(`   Iterations: ${wsConnectResult.iterations}`);
console.log(`   Average:    ${formatMs(wsConnectResult.avg)}`);
console.log(`   Min:        ${formatMs(wsConnectResult.min)}`);
console.log(`   Max:        ${formatMs(wsConnectResult.max)}`);
console.log(`   P95:        ${formatMs(wsConnectResult.p95)}`);
console.log(`   Throughput: ${Math.floor(1000 / wsConnectResult.avg)} connections/sec`);
console.log('');

// ───────────────────────────────────────────────────────────────────────────
// BENCHMARK 5: Room Join/Leave
// ───────────────────────────────────────────────────────────────────────────
console.log('🔷 BENCHMARK 5: Room Join/Leave');

resetWs();
// Pre-connect clients
for (let i = 0; i < 100; i++) {
  wsService.connect(`room-client-${i}`, {});
}

const joinResult = measure('Join Room', (i) => {
  wsService.joinRoom(`room-client-${i % 100}`, `room-${i % 10}`);
}, 1000);

console.log(`   Join Average:  ${formatMs(joinResult.avg)}`);
console.log(`   Join P95:      ${formatMs(joinResult.p95)}`);

const leaveResult = measure('Leave Room', (i) => {
  wsService.leaveRoom(`room-client-${i % 100}`, `room-${i % 10}`);
}, 1000);

console.log(`   Leave Average: ${formatMs(leaveResult.avg)}`);
console.log(`   Leave P95:     ${formatMs(leaveResult.p95)}`);
console.log('');

// ───────────────────────────────────────────────────────────────────────────
// BENCHMARK 6: Event Emission
// ───────────────────────────────────────────────────────────────────────────
console.log('🔷 BENCHMARK 6: Event Emission');

resetWs();
// Setup: 10 rooms with 50 clients each = 500 clients
for (let r = 0; r < 10; r++) {
  for (let c = 0; c < 50; c++) {
    const clientId = `emit-client-${r}-${c}`;
    wsService.connect(clientId, {});
    wsService.joinRoom(clientId, `emit-room-${r}`);
  }
}

const emitResult = measure('Emit to Room', (i) => {
  wsService.emitToRoom(`emit-room-${i % 10}`, 'test_event', { data: i });
}, 1000);

console.log(`   Room Size:  50 clients`);
console.log(`   Average:    ${formatMs(emitResult.avg)}`);
console.log(`   Min:        ${formatMs(emitResult.min)}`);
console.log(`   Max:        ${formatMs(emitResult.max)}`);
console.log(`   P95:        ${formatMs(emitResult.p95)}`);
console.log(`   Throughput: ${Math.floor(1000 / emitResult.avg)} emits/sec`);
console.log('');

// ───────────────────────────────────────────────────────────────────────────
// BENCHMARK 7: Broadcast
// ───────────────────────────────────────────────────────────────────────────
console.log('🔷 BENCHMARK 7: Broadcast to All (500 clients)');

const broadcastResult = measure('Broadcast', () => {
  wsService.broadcast('global_event', { timestamp: Date.now() });
}, 100);

console.log(`   Clients:    500`);
console.log(`   Average:    ${formatMs(broadcastResult.avg)}`);
console.log(`   Min:        ${formatMs(broadcastResult.min)}`);
console.log(`   Max:        ${formatMs(broadcastResult.max)}`);
console.log(`   P95:        ${formatMs(broadcastResult.p95)}`);
console.log(`   Per Client: ${formatMs(broadcastResult.avg / 500)}`);
console.log('');

// ───────────────────────────────────────────────────────────────────────────
// BENCHMARK 8: Order Flow Handler
// ───────────────────────────────────────────────────────────────────────────
console.log('🔷 BENCHMARK 8: Complete Order Handler Flow');

resetWs();
// Setup kitchen
wsService.connect('benchmark-kds', {});
handlers[EVENTS.KITCHEN.JOIN_KITCHEN](wsService, 'benchmark-kds', { restaurantId: 'bench-rest' });

// Setup tables
for (let i = 0; i < 100; i++) {
  wsService.connect(`bench-table-${i}`, {});
  handlers[EVENTS.CLIENT.JOIN_TABLE](wsService, `bench-table-${i}`, { 
    tableId: `table-${i}`, 
    sessionId: `session-${i}` 
  });
}

const orderFlowResult = measure('Order Flow', (i) => {
  // New order
  handlers[EVENTS.CLIENT.NEW_ORDER](
    wsService,
    `bench-table-${i % 100}`,
    { order: { id: `bench-order-${i}`, tableId: `table-${i % 100}` }, restaurantId: 'bench-rest' }
  );
  
  // Confirm
  handlers[EVENTS.KITCHEN.UPDATE_STATUS](
    wsService,
    'benchmark-kds',
    { orderId: `bench-order-${i}`, status: 'confirmed', tableId: `table-${i % 100}`, restaurantId: 'bench-rest' }
  );
  
  // Preparing
  handlers[EVENTS.KITCHEN.UPDATE_STATUS](
    wsService,
    'benchmark-kds',
    { orderId: `bench-order-${i}`, status: 'preparing', tableId: `table-${i % 100}`, restaurantId: 'bench-rest' }
  );
  
  // Ready
  handlers[EVENTS.KITCHEN.UPDATE_STATUS](
    wsService,
    'benchmark-kds',
    { orderId: `bench-order-${i}`, status: 'ready', tableId: `table-${i % 100}`, restaurantId: 'bench-rest' }
  );
}, 500);

console.log(`   Flow: new → confirmed → preparing → ready`);
console.log(`   Iterations: ${orderFlowResult.iterations}`);
console.log(`   Average:    ${formatMs(orderFlowResult.avg)}`);
console.log(`   Min:        ${formatMs(orderFlowResult.min)}`);
console.log(`   Max:        ${formatMs(orderFlowResult.max)}`);
console.log(`   P95:        ${formatMs(orderFlowResult.p95)}`);
console.log(`   P99:        ${formatMs(orderFlowResult.p99)}`);
console.log(`   Throughput: ${Math.floor(1000 / orderFlowResult.avg)} orders/sec`);
console.log('');

// ───────────────────────────────────────────────────────────────────────────
// LOAD TEST: Sustained Load
// ───────────────────────────────────────────────────────────────────────────
console.log('🔷 LOAD TEST: Sustained Load (5 seconds)');

resetWs();
wsService.connect('load-kds', {});
handlers[EVENTS.KITCHEN.JOIN_KITCHEN](wsService, 'load-kds', { restaurantId: 'load-rest' });

for (let i = 0; i < 50; i++) {
  wsService.connect(`load-table-${i}`, {});
  handlers[EVENTS.CLIENT.JOIN_TABLE](wsService, `load-table-${i}`, { 
    tableId: `table-${i}`, 
    sessionId: `load-session-${i}` 
  });
}

const loadStart = Date.now();
let operations = 0;
const loadDuration = 5000; // 5 seconds

while (Date.now() - loadStart < loadDuration) {
  const tableNum = operations % 50;
  
  handlers[EVENTS.CLIENT.NEW_ORDER](
    wsService,
    `load-table-${tableNum}`,
    { order: { id: `load-order-${operations}`, tableId: `table-${tableNum}` }, restaurantId: 'load-rest' }
  );
  
  operations++;
}

const loadElapsed = (Date.now() - loadStart) / 1000;
const opsPerSec = Math.floor(operations / loadElapsed);

console.log(`   Duration:   ${loadElapsed.toFixed(2)}s`);
console.log(`   Operations: ${operations}`);
console.log(`   Ops/sec:    ${opsPerSec}`);
console.log('');

// ───────────────────────────────────────────────────────────────────────────
// MEMORY TEST
// ───────────────────────────────────────────────────────────────────────────
console.log('🔷 MEMORY TEST: High Connection Count');

resetWs();
const memBefore = process.memoryUsage().heapUsed;

// Connect 5000 clients
for (let i = 0; i < 5000; i++) {
  wsService.connect(`mem-client-${i}`, { index: i, timestamp: Date.now() });
  wsService.joinRoom(`mem-client-${i}`, `mem-room-${i % 100}`);
}

const memAfter = process.memoryUsage().heapUsed;
const memUsed = (memAfter - memBefore) / 1024 / 1024;
const memPerClient = (memAfter - memBefore) / 5000 / 1024;

console.log(`   Clients:      5,000`);
console.log(`   Rooms:        100`);
console.log(`   Memory Used:  ${memUsed.toFixed(2)} MB`);
console.log(`   Per Client:   ${memPerClient.toFixed(2)} KB`);
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// RESULTS SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

const results = {
  qrGeneration: qrGenResult,
  qrValidation: qrValResult,
  bulkQR: bulkResult,
  wsConnect: wsConnectResult,
  roomJoin: joinResult,
  emit: emitResult,
  broadcast: broadcastResult,
  orderFlow: orderFlowResult,
  loadTest: { opsPerSec, duration: loadElapsed },
  memory: { clients: 5000, usedMB: memUsed, perClientKB: memPerClient },
};

// Performance thresholds
const thresholds = {
  qrGeneration: { maxAvg: 1, maxP95: 2 },      // ms
  qrValidation: { maxAvg: 0.5, maxP95: 1 },    // ms
  wsConnect: { maxAvg: 0.5, maxP95: 1 },       // ms
  emit: { maxAvg: 1, maxP95: 2 },              // ms
  orderFlow: { maxAvg: 5, maxP95: 10 },        // ms
  loadTest: { minOps: 1000 },                  // ops/sec
  memory: { maxPerClient: 10 },                // KB
};

let allPassed = true;
const checks = [];

// Check QR Generation
if (qrGenResult.avg <= thresholds.qrGeneration.maxAvg && qrGenResult.p95 <= thresholds.qrGeneration.maxP95) {
  checks.push({ name: 'QR Generation', passed: true });
} else {
  checks.push({ name: 'QR Generation', passed: false });
  allPassed = false;
}

// Check QR Validation
if (qrValResult.avg <= thresholds.qrValidation.maxAvg && qrValResult.p95 <= thresholds.qrValidation.maxP95) {
  checks.push({ name: 'QR Validation', passed: true });
} else {
  checks.push({ name: 'QR Validation', passed: false });
  allPassed = false;
}

// Check WS Connect
if (wsConnectResult.avg <= thresholds.wsConnect.maxAvg && wsConnectResult.p95 <= thresholds.wsConnect.maxP95) {
  checks.push({ name: 'WS Connection', passed: true });
} else {
  checks.push({ name: 'WS Connection', passed: false });
  allPassed = false;
}

// Check Emit
if (emitResult.avg <= thresholds.emit.maxAvg && emitResult.p95 <= thresholds.emit.maxP95) {
  checks.push({ name: 'Event Emission', passed: true });
} else {
  checks.push({ name: 'Event Emission', passed: false });
  allPassed = false;
}

// Check Order Flow
if (orderFlowResult.avg <= thresholds.orderFlow.maxAvg && orderFlowResult.p95 <= thresholds.orderFlow.maxP95) {
  checks.push({ name: 'Order Flow', passed: true });
} else {
  checks.push({ name: 'Order Flow', passed: false });
  allPassed = false;
}

// Check Load Test
if (opsPerSec >= thresholds.loadTest.minOps) {
  checks.push({ name: 'Load Test', passed: true });
} else {
  checks.push({ name: 'Load Test', passed: false });
  allPassed = false;
}

// Check Memory
if (memPerClient <= thresholds.memory.maxPerClient) {
  checks.push({ name: 'Memory Usage', passed: true });
} else {
  checks.push({ name: 'Memory Usage', passed: false });
  allPassed = false;
}

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║                 PERFORMANCE TEST RESULTS                       ║');
console.log('╠════════════════════════════════════════════════════════════════╣');

checks.forEach(check => {
  const status = check.passed ? '✅' : '❌';
  console.log(`║   ${status} ${check.name.padEnd(20)} ${check.passed ? 'PASSED' : 'FAILED'}                       ║`);
});

console.log('╠════════════════════════════════════════════════════════════════╣');

if (allPassed) {
  console.log('║   🎉 ALL PERFORMANCE THRESHOLDS MET                            ║');
  console.log('║                                                                ║');
  console.log('║   Key Metrics:                                                 ║');
  console.log(`║   • QR Generation:     ${Math.floor(1000 / qrGenResult.avg).toString().padStart(6)} ops/sec                    ║`);
  console.log(`║   • QR Validation:     ${Math.floor(1000 / qrValResult.avg).toString().padStart(6)} ops/sec                    ║`);
  console.log(`║   • WS Connections:    ${Math.floor(1000 / wsConnectResult.avg).toString().padStart(6)} /sec                       ║`);
  console.log(`║   • Order Processing:  ${Math.floor(1000 / orderFlowResult.avg).toString().padStart(6)} orders/sec                ║`);
  console.log(`║   • Sustained Load:    ${opsPerSec.toString().padStart(6)} ops/sec                    ║`);
  console.log(`║   • Memory/Client:     ${memPerClient.toFixed(2).padStart(6)} KB                         ║`);
} else {
  console.log('║   ⚠️  Some thresholds not met - review before production        ║');
}

console.log('╚════════════════════════════════════════════════════════════════╝');
console.log('');

process.exit(allPassed ? 0 : 1);
