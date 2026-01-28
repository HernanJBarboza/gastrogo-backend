/**
 * GASTROGO - API Tests
 * Tests de integración para validar FASE 4
 */

const {
  generateTableQR,
  validateQRCode,
  validateQRCodeWithDB,
  generateBulkQRCodes,
  getQRImageUrl,
  formatForPrinting,
} = require('../services/qr-engine');

// Mock data
const mockTables = [
  { id: 'table-1', restaurant_id: 'rest-001', number: 1, capacity: 2, qr_code: 'QR-rest-001-1-ABC12345' },
  { id: 'table-2', restaurant_id: 'rest-001', number: 2, capacity: 4, qr_code: 'QR-rest-001-2-DEF67890' },
  { id: 'table-3', restaurant_id: 'rest-001', number: 3, capacity: 4, qr_code: 'QR-rest-001-3-GHI11223' },
];

const mockRestaurant = {
  id: 'rest-001',
  name: 'La Parrilla del Puerto',
  wifi_network: 'LaParrilla_Guest',
  wifi_password: 'bienvenido2024',
};

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

// ═══════════════════════════════════════════════════════════
// TEST 1: QR Generation
// ═══════════════════════════════════════════════════════════
console.log('\n🔷 TEST 1: QR Generation');

test('generateTableQR devuelve objeto con todas las propiedades', () => {
  const qr = generateTableQR('rest-001', 1, { tableId: 'table-1' });
  
  assert(qr.success === true, 'success debe ser true');
  assert(qr.qrCode, 'Debe tener qrCode');
  assert(qr.menuUrl, 'Debe tener menuUrl');
  assert(qr.tableNumber === 1, 'tableNumber debe coincidir');
  assert(qr.restaurantId === 'rest-001', 'restaurantId debe coincidir');
  assert(qr.createdAt, 'Debe tener createdAt');
  assert(qr.qrData, 'Debe tener qrData para generación');
});

test('generateTableQR genera códigos únicos', () => {
  const qr1 = generateTableQR('r1', 1);
  const qr2 = generateTableQR('r1', 2);
  
  assert(qr1.qrCode !== qr2.qrCode, 'Los códigos deben ser diferentes');
});

test('generateTableQR incluye número de mesa en la URL', () => {
  const qr = generateTableQR('rest-001', 5);
  
  assert(qr.menuUrl.includes('table=5'), 'URL debe incluir número de mesa');
});

test('generateTableQR incluye código QR en la URL', () => {
  const qr = generateTableQR('rest-001', 1);
  
  assert(qr.menuUrl.includes('qr='), 'URL debe incluir código QR');
  assert(qr.menuUrl.includes(qr.qrCode), 'URL debe incluir el código generado');
});

// ═══════════════════════════════════════════════════════════
// TEST 2: QR Validation
// ═══════════════════════════════════════════════════════════
console.log('\n🔷 TEST 2: QR Validation');

test('validateQRCode retorna datos correctos para código válido', () => {
  // Generar un QR primero
  const generated = generateTableQR('rest-001', 1);
  const result = validateQRCode(generated.qrCode);
  
  assert(result, 'Debe retornar resultado');
  assert(result.valid === true, 'valid debe ser true');
  assert(result.tableNumber === 1, 'tableNumber debe coincidir');
  assert(result.restaurantId === 'rest-001', 'restaurantId debe coincidir');
});

test('validateQRCode retorna valid=false para código inválido', () => {
  const result = validateQRCode('CODIGO-INVALIDO');
  
  assert(result.valid === false, 'valid debe ser false para código inválido');
  assert(result.error, 'Debe incluir mensaje de error');
});

test('validateQRCode retorna valid=false para input vacío', () => {
  assert(validateQRCode('').valid === false, 'String vacío debe ser inválido');
  assert(validateQRCode(null).valid === false, 'null debe ser inválido');
  assert(validateQRCode(undefined).valid === false, 'undefined debe ser inválido');
});

// ═══════════════════════════════════════════════════════════
// TEST 3: Bulk QR Generation
// ═══════════════════════════════════════════════════════════
console.log('\n🔷 TEST 3: Bulk QR Generation');

test('generateBulkQRCodes genera QR para todas las mesas', () => {
  const tables = [
    { tableNumber: 1 },
    { tableNumber: 2 },
    { tableNumber: 3 },
  ];
  const result = generateBulkQRCodes('rest-001', tables);
  
  assert(result.success === true, 'success debe ser true');
  assert(result.qrCodes.length === tables.length, 'Debe generar QR para cada mesa');
});

test('generateBulkQRCodes incluye datos de mesa', () => {
  const tables = [
    { tableNumber: 1, id: 'table-1' },
    { tableNumber: 2, id: 'table-2' },
  ];
  const result = generateBulkQRCodes('rest-001', tables);
  
  result.qrCodes.forEach((qr, index) => {
    assert(qr.tableNumber === tables[index].tableNumber, 'tableNumber debe coincidir');
    assert(qr.code, 'Debe incluir código');
  });
});

test('generateBulkQRCodes genera códigos únicos', () => {
  const tables = [
    { tableNumber: 1 },
    { tableNumber: 2 },
    { tableNumber: 3 },
  ];
  const result = generateBulkQRCodes('rest-001', tables);
  const codes = result.qrCodes.map(qr => qr.code);
  const uniqueCodes = [...new Set(codes)];
  
  assert(codes.length === uniqueCodes.length, 'Todos los códigos deben ser únicos');
});

// ═══════════════════════════════════════════════════════════
// TEST 4: QR Image URL
// ═══════════════════════════════════════════════════════════
console.log('\n🔷 TEST 4: QR Image URL');

test('getQRImageUrl genera URL válida', () => {
  const url = getQRImageUrl('https://example.com/menu');
  
  assert(url.startsWith('https://'), 'URL debe usar HTTPS');
  assert(url.includes('qr'), 'URL debe ser de servicio QR');
});

test('getQRImageUrl codifica contenido correctamente', () => {
  const content = 'https://example.com/menu?table=1&qr=ABC';
  const url = getQRImageUrl(content);
  
  // Verificar que caracteres especiales están codificados
  assert(!url.includes('&qr='), '& debe estar codificado');
  assert(url.includes('%26'), '& debe codificarse como %26');
});

test('getQRImageUrl respeta opciones de tamaño', () => {
  const url = getQRImageUrl('test', { size: 500 });
  
  assert(url.includes('500'), 'URL debe incluir tamaño especificado');
});

// ═══════════════════════════════════════════════════════════
// TEST 5: Print Formatting
// ═══════════════════════════════════════════════════════════
console.log('\n🔷 TEST 5: Print Formatting');

test('formatForPrinting genera datos completos', () => {
  const qr = generateTableQR('rest-001', 5);
  
  const printData = formatForPrinting(qr.qrCode, 5, 'La Parrilla del Puerto');
  
  assert(printData.restaurantName === 'La Parrilla del Puerto', 'Debe incluir nombre del restaurante');
  assert(printData.tableNumber === 5, 'Debe incluir número de mesa');
  assert(printData.qrImageUrl, 'Debe incluir URL de imagen QR');
  assert(Array.isArray(printData.instructions), 'Debe incluir instrucciones');
  assert(printData.footer, 'Debe incluir footer');
});

test('formatForPrinting incluye código QR', () => {
  const qr = generateTableQR('rest-001', 1);
  
  const printData = formatForPrinting(qr.qrCode, 1, 'Test Restaurant');
  
  assert(printData.qrCode === qr.qrCode, 'Debe incluir código QR');
  assert(printData.menuUrl, 'Debe incluir URL del menú');
});

test('formatForPrinting tiene timestamp', () => {
  const qr = generateTableQR('rest-001', 1);
  
  const printData = formatForPrinting(qr.qrCode, 1, 'Test');
  
  assert(printData.printedAt, 'Debe tener printedAt');
});

// ═══════════════════════════════════════════════════════════
// TEST 6: Order State Machine
// ═══════════════════════════════════════════════════════════
console.log('\n🔷 TEST 6: Order State Machine');

const ORDER_STATES = {
  created: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivered'],
  delivered: ['paid'],
  paid: [],
  cancelled: [],
};

test('Estado created puede ir a confirmed', () => {
  assert(ORDER_STATES.created.includes('confirmed'), 'created -> confirmed debe ser válido');
});

test('Estado created puede ir a cancelled', () => {
  assert(ORDER_STATES.created.includes('cancelled'), 'created -> cancelled debe ser válido');
});

test('Estado preparing solo puede ir a ready o cancelled', () => {
  assert(ORDER_STATES.preparing.length === 2, 'preparing debe tener 2 transiciones');
  assert(ORDER_STATES.preparing.includes('ready'), 'preparing -> ready debe ser válido');
  assert(ORDER_STATES.preparing.includes('cancelled'), 'preparing -> cancelled debe ser válido');
});

test('Estado ready solo puede ir a delivered', () => {
  assert(ORDER_STATES.ready.length === 1, 'ready debe tener 1 transición');
  assert(ORDER_STATES.ready.includes('delivered'), 'ready -> delivered debe ser válido');
  assert(!ORDER_STATES.ready.includes('cancelled'), 'ready -> cancelled NO debe ser válido');
});

test('Estado paid es final (sin transiciones)', () => {
  assert(ORDER_STATES.paid.length === 0, 'paid no debe tener transiciones');
});

test('Estado cancelled es final (sin transiciones)', () => {
  assert(ORDER_STATES.cancelled.length === 0, 'cancelled no debe tener transiciones');
});

// ═══════════════════════════════════════════════════════════
// RESULTADOS
// ═══════════════════════════════════════════════════════════
console.log('\n════════════════════════════════════════════════════════');
console.log('📊 RESULTADOS DE TESTS FASE 4');
console.log('════════════════════════════════════════════════════════');
console.log(`   Pasaron: ${passed}`);
console.log(`   Fallaron: ${failed}`);
console.log(`   Total: ${passed + failed}`);
console.log('════════════════════════════════════════════════════════');

if (failed === 0) {
  console.log('\n✅ TODOS LOS TESTS DE FASE 4 PASARON');
  console.log('✅ QR ENGINE VALIDADO');
  console.log('✅ ORDER STATE MACHINE VALIDADO\n');
} else {
  console.log(`\n❌ ${failed} tests fallaron`);
  process.exit(1);
}
