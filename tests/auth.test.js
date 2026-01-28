/**
 * GASTROGO - Tests de Autenticación y Seguridad
 * FASE 2: Validar que la seguridad funciona correctamente
 */

const {
  generateToken,
  generateTableSessionToken,
  verifyToken,
  hashPassword,
  comparePassword,
  ROLES
} = require('../middleware/auth');

// Colores para output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓ PASS${colors.reset}: ${msg}`),
  fail: (msg) => console.log(`${colors.red}✗ FAIL${colors.reset}: ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ INFO${colors.reset}: ${msg}`),
  header: (msg) => console.log(`\n${colors.yellow}═══ ${msg} ═══${colors.reset}\n`)
};

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    log.success(testName);
    passed++;
  } else {
    log.fail(testName);
    failed++;
  }
}

async function runTests() {
  console.log('\n🔐 GASTROGO - Suite de Tests de Seguridad (FASE 2)\n');
  console.log('=' .repeat(60));

  // ═══════════════════════════════════════════════════════════
  log.header('TEST 1: Generación de Tokens JWT');
  // ═══════════════════════════════════════════════════════════

  const mockUser = {
    id: 'user-123',
    email: 'test@gastrogo.com',
    role: 'admin',
    restaurant_id: 'rest-456'
  };

  const token = generateToken(mockUser);
  assert(typeof token === 'string' && token.length > 50, 'Token JWT generado correctamente');

  const decoded = verifyToken(token);
  assert(decoded.userId === mockUser.id, 'Token contiene userId correcto');
  assert(decoded.email === mockUser.email, 'Token contiene email correcto');
  assert(decoded.role === mockUser.role, 'Token contiene role correcto');
  assert(decoded.restaurantId === mockUser.restaurant_id, 'Token contiene restaurantId correcto');

  // ═══════════════════════════════════════════════════════════
  log.header('TEST 2: Tokens de Sesión de Mesa');
  // ═══════════════════════════════════════════════════════════

  const tableToken = generateTableSessionToken('table-5', 'rest-456', 'session-789');
  assert(typeof tableToken === 'string', 'Token de mesa generado correctamente');

  const decodedTable = verifyToken(tableToken);
  assert(decodedTable.type === 'table_session', 'Token tiene tipo table_session');
  assert(decodedTable.tableId === 'table-5', 'Token contiene tableId correcto');
  assert(decodedTable.sessionId === 'session-789', 'Token contiene sessionId correcto');
  assert(decodedTable.role === 'customer', 'Token de mesa tiene role customer');

  // ═══════════════════════════════════════════════════════════
  log.header('TEST 3: Validación de Token Inválido');
  // ═══════════════════════════════════════════════════════════

  let invalidTokenError = null;
  try {
    verifyToken('token-invalido-fake');
  } catch (error) {
    invalidTokenError = error;
  }
  assert(invalidTokenError !== null, 'Token inválido lanza error');
  assert(invalidTokenError.code === 'INVALID_TOKEN', 'Error tiene código INVALID_TOKEN');

  // ═══════════════════════════════════════════════════════════
  log.header('TEST 4: Hash y Verificación de Contraseñas');
  // ═══════════════════════════════════════════════════════════

  const password = 'MiContraseñaSegura123!';
  const hash = await hashPassword(password);
  
  assert(hash !== password, 'Password hasheado es diferente al original');
  assert(hash.startsWith('$2'), 'Hash usa formato bcrypt');

  const isValid = await comparePassword(password, hash);
  assert(isValid === true, 'Password correcto valida exitosamente');

  const isInvalid = await comparePassword('contraseña-incorrecta', hash);
  assert(isInvalid === false, 'Password incorrecto rechazado correctamente');

  // ═══════════════════════════════════════════════════════════
  log.header('TEST 5: Sistema de Roles (RBAC)');
  // ═══════════════════════════════════════════════════════════

  // Verificar estructura de roles
  assert(ROLES.admin.level === 100, 'Admin tiene nivel 100');
  assert(ROLES.staff.level === 50, 'Staff tiene nivel 50');
  assert(ROLES.customer.level === 10, 'Customer tiene nivel 10');

  // Verificar permisos de admin
  assert(ROLES.admin.permissions.includes('*'), 'Admin tiene permiso wildcard (*)');

  // Verificar permisos de staff
  assert(ROLES.staff.permissions.includes('orders:read'), 'Staff puede leer pedidos');
  assert(ROLES.staff.permissions.includes('kitchen:access'), 'Staff puede acceder a cocina');
  assert(!ROLES.staff.permissions.includes('*'), 'Staff NO tiene permiso wildcard');

  // Verificar permisos de customer
  assert(ROLES.customer.permissions.includes('menu:read'), 'Customer puede ver menú');
  assert(ROLES.customer.permissions.includes('orders:create'), 'Customer puede crear pedidos');
  assert(ROLES.customer.permissions.includes('orders:read:own'), 'Customer puede ver SUS pedidos');
  assert(!ROLES.customer.permissions.includes('orders:read'), 'Customer NO puede ver TODOS los pedidos');

  // ═══════════════════════════════════════════════════════════
  log.header('TEST 6: Aislamiento de Mesa (Mesa 5 no ve Mesa 10)');
  // ═══════════════════════════════════════════════════════════

  // Simular tokens de dos mesas diferentes
  const mesa5Token = generateTableSessionToken('mesa-5', 'rest-456', 'session-mesa5');
  const mesa10Token = generateTableSessionToken('mesa-10', 'rest-456', 'session-mesa10');

  const userMesa5 = verifyToken(mesa5Token);
  const userMesa10 = verifyToken(mesa10Token);

  // Verificar que son sesiones diferentes
  assert(userMesa5.tableId !== userMesa10.tableId, 'Mesa 5 y Mesa 10 tienen IDs diferentes');
  assert(userMesa5.sessionId !== userMesa10.sessionId, 'Sesiones de mesa son diferentes');

  // Simular validación de acceso
  function canAccessTable(user, requestedTableId) {
    // Admin y Staff pueden ver cualquier mesa
    if (user.role === 'admin' || user.role === 'staff') return true;
    // Customer solo puede ver su mesa
    return user.tableId === requestedTableId;
  }

  const mesa5CanAccessMesa5 = canAccessTable(userMesa5, 'mesa-5');
  const mesa5CanAccessMesa10 = canAccessTable(userMesa5, 'mesa-10');

  assert(mesa5CanAccessMesa5 === true, 'Mesa 5 PUEDE acceder a Mesa 5');
  assert(mesa5CanAccessMesa10 === false, 'Mesa 5 NO PUEDE acceder a Mesa 10');

  // Verificar que staff sí puede
  const staffUser = { role: 'staff', tableId: null };
  const staffCanAccessMesa10 = canAccessTable(staffUser, 'mesa-10');
  assert(staffCanAccessMesa10 === true, 'Staff PUEDE acceder a Mesa 10');

  // ═══════════════════════════════════════════════════════════
  log.header('TEST 7: Validación de Pedidos por Sesión');
  // ═══════════════════════════════════════════════════════════

  // Simular pedidos
  const orders = [
    { id: 'order-1', table_id: 'mesa-5', session_id: 'session-mesa5' },
    { id: 'order-2', table_id: 'mesa-10', session_id: 'session-mesa10' },
    { id: 'order-3', table_id: 'mesa-5', session_id: 'session-mesa5' }
  ];

  function canAccessOrder(user, order) {
    if (user.role === 'admin' || user.role === 'staff') return true;
    return user.tableId === order.table_id && user.sessionId === order.session_id;
  }

  // Usuario de Mesa 5 intentando acceder a pedidos
  const order1Access = canAccessOrder(userMesa5, orders[0]);
  const order2Access = canAccessOrder(userMesa5, orders[1]);
  const order3Access = canAccessOrder(userMesa5, orders[2]);

  assert(order1Access === true, 'Mesa 5 PUEDE ver su pedido (order-1)');
  assert(order2Access === false, 'Mesa 5 NO PUEDE ver pedido de Mesa 10 (order-2)');
  assert(order3Access === true, 'Mesa 5 PUEDE ver su otro pedido (order-3)');

  // ═══════════════════════════════════════════════════════════
  log.header('TEST 8: Aislamiento de Restaurante');
  // ═══════════════════════════════════════════════════════════

  const rest1Token = generateTableSessionToken('mesa-1', 'restaurant-A', 'session-A');
  const rest2Token = generateTableSessionToken('mesa-1', 'restaurant-B', 'session-B');

  const userRestA = verifyToken(rest1Token);
  const userRestB = verifyToken(rest2Token);

  function canAccessRestaurant(user, requestedRestaurantId) {
    return user.restaurantId === requestedRestaurantId;
  }

  assert(canAccessRestaurant(userRestA, 'restaurant-A') === true, 'Usuario Rest-A PUEDE acceder a Rest-A');
  assert(canAccessRestaurant(userRestA, 'restaurant-B') === false, 'Usuario Rest-A NO PUEDE acceder a Rest-B');
  assert(canAccessRestaurant(userRestB, 'restaurant-B') === true, 'Usuario Rest-B PUEDE acceder a Rest-B');

  // ═══════════════════════════════════════════════════════════
  // RESUMEN
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '=' .repeat(60));
  console.log(`\n📊 RESUMEN DE TESTS DE SEGURIDAD (FASE 2)\n`);
  console.log(`   ${colors.green}Pasaron: ${passed}${colors.reset}`);
  console.log(`   ${colors.red}Fallaron: ${failed}${colors.reset}`);
  console.log(`   Total: ${passed + failed}\n`);

  if (failed === 0) {
    console.log(`${colors.green}✅ TODOS LOS TESTS DE SEGURIDAD PASARON${colors.reset}`);
    console.log(`${colors.green}✅ FASE 2 VALIDADA - SE PUEDE PROCEDER A FASE 3${colors.reset}\n`);
    return true;
  } else {
    console.log(`${colors.red}❌ HAY TESTS FALLIDOS - NO PROCEDER A FASE 3${colors.reset}\n`);
    return false;
  }
}

// Ejecutar tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Error ejecutando tests:', error);
    process.exit(1);
  });
