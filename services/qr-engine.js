/**
 * GASTROGO - QR Engine
 * Generador de códigos QR dinámicos vinculados a mesas
 */

const { v4: uuidv4 } = require('uuid');

// Configuración
const QR_CONFIG = {
  baseUrl: process.env.APP_URL || 'https://gastrogo-web.herokuapp.com',
  defaultSize: 300,
  errorCorrectionLevel: 'M', // L, M, Q, H
  margin: 2,
};

/**
 * Genera un código QR único para una mesa
 * @param {string} restaurantId - ID del restaurante
 * @param {number|string} tableNumber - Número de mesa
 * @param {Object} options - Opciones adicionales (tableId, etc)
 * @returns {Object} Datos del QR generado
 */
function generateTableQR(restaurantId, tableNumber, options = {}) {
  // Validar parámetros
  if (!restaurantId || tableNumber === undefined || tableNumber === null) {
    return {
      success: false,
      error: 'restaurantId y tableNumber son requeridos',
    };
  }

  // Generar código único para el QR
  const uniqueId = uuidv4().slice(0, 8).toUpperCase();
  const qrCode = `QR-${restaurantId}-${tableNumber}-${uniqueId}`;
  
  // URL que abrirá el menú con la mesa
  const menuUrl = `${QR_CONFIG.baseUrl}/menu?table=${tableNumber}&qr=${qrCode}`;
  
  return {
    success: true,
    qrCode,
    menuUrl,
    tableNumber: Number(tableNumber),
    restaurantId,
    tableId: options.tableId || `table-${tableNumber}`,
    createdAt: new Date().toISOString(),
    // Metadatos para el código QR
    qrData: {
      content: menuUrl,
      size: QR_CONFIG.defaultSize,
      errorCorrectionLevel: QR_CONFIG.errorCorrectionLevel,
      margin: QR_CONFIG.margin,
    },
  };
}

/**
 * Valida un código QR y extrae sus datos
 * @param {string} qrCode - Código QR a validar
 * @returns {Object} Resultado de validación
 */
function validateQRCode(qrCode) {
  if (!qrCode || typeof qrCode !== 'string') {
    return {
      valid: false,
      error: 'Código QR inválido o vacío',
    };
  }

  // Validar formato: QR-{restaurantId}-{tableNumber}-{uniqueId}
  // restaurantId puede contener guiones (ej: rest-001)
  // El formato es: QR-<cualquier-cosa>-<numero>-<UUID8chars>
  const pattern = /^QR-(.+)-(\d+)-([A-Z0-9]{8})$/i;
  const match = qrCode.match(pattern);

  if (!match) {
    return {
      valid: false,
      error: 'Formato de código QR inválido',
    };
  }

  const [, restaurantId, tableNumber, uniqueId] = match;

  return {
    valid: true,
    qrCode,
    restaurantId,
    tableNumber: Number(tableNumber),
    uniqueId,
    // En producción, verificar contra DB
    verifiedAt: new Date().toISOString(),
  };
}

/**
 * Genera QR codes en bulk para múltiples mesas
 * @param {string} restaurantId - ID del restaurante
 * @param {Array} tables - Lista de mesas [{tableNumber: n}, ...]
 * @returns {Object} Resultado con todos los QRs generados
 */
function generateBulkQRCodes(restaurantId, tables) {
  if (!restaurantId || !Array.isArray(tables) || tables.length === 0) {
    return {
      success: false,
      error: 'restaurantId y lista de mesas son requeridos',
    };
  }

  const qrCodes = [];
  const errors = [];

  for (const table of tables) {
    const tableNumber = table.tableNumber || table.number;
    
    if (tableNumber === undefined || tableNumber === null) {
      errors.push({ table, error: 'tableNumber no definido' });
      continue;
    }

    const result = generateTableQR(restaurantId, tableNumber, table);
    
    if (result.success) {
      qrCodes.push({
        tableNumber,
        code: result.qrCode,
        menuUrl: result.menuUrl,
        qrData: result.qrData,
        tableId: table.id || `table-${tableNumber}`,
      });
    } else {
      errors.push({ tableNumber, error: result.error });
    }
  }

  return {
    success: errors.length === 0,
    qrCodes,
    errors: errors.length > 0 ? errors : undefined,
    summary: {
      total: tables.length,
      successful: qrCodes.length,
      failed: errors.length,
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Genera URL para descargar imagen del QR
 * @param {string} content - Contenido a codificar
 * @param {Object} options - Opciones de generación
 * @returns {string} URL de la imagen QR
 */
function getQRImageUrl(content, options = {}) {
  const {
    size = QR_CONFIG.defaultSize,
    format = 'png',
    errorCorrection = QR_CONFIG.errorCorrectionLevel,
  } = options;
  
  const encodedContent = encodeURIComponent(content);
  
  // API pública de QR (en producción usar librería local como 'qrcode')
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedContent}&ecc=${errorCorrection}&format=${format}`;
}

/**
 * Datos para imprimir etiquetas con QR
 * @param {string} qrCode - Código QR
 * @param {number} tableNumber - Número de mesa
 * @param {string} restaurantName - Nombre del restaurante
 * @returns {Object} Datos formateados para impresión
 */
function formatForPrinting(qrCode, tableNumber, restaurantName) {
  const menuUrl = `${QR_CONFIG.baseUrl}/menu?table=${tableNumber}&qr=${qrCode}`;
  
  return {
    tableNumber,
    restaurantName,
    qrCode,
    menuUrl,
    qrImageUrl: getQRImageUrl(menuUrl),
    instructions: [
      '1. Escanea el código QR con tu celular',
      '2. Explora nuestro menú digital',
      '3. Realiza tu pedido desde tu mesa',
      '4. ¡Disfruta tu comida!',
    ],
    footer: 'Powered by GastroGO',
    printedAt: new Date().toISOString(),
  };
}

/**
 * Regenera el código QR de una mesa (por seguridad o pérdida)
 * @param {string} restaurantId - ID del restaurante
 * @param {number} tableNumber - Número de mesa
 * @param {Object} options - Opciones adicionales
 * @returns {Object} Nuevo QR generado
 */
function regenerateTableQR(restaurantId, tableNumber, options = {}) {
  return generateTableQR(restaurantId, tableNumber, {
    ...options,
    regenerated: true,
    regeneratedAt: new Date().toISOString(),
  });
}

/**
 * Valida QR contra base de datos de mesas (para uso con DB real)
 * @param {string} qrCode - Código QR
 * @param {Array} tables - Lista de mesas del restaurante
 * @returns {Object} Resultado de validación con datos de mesa
 */
function validateQRCodeWithDB(qrCode, tables) {
  // Primero validar formato
  const formatValidation = validateQRCode(qrCode);
  if (!formatValidation.valid) {
    return formatValidation;
  }

  // Buscar mesa con ese código QR
  const table = tables.find(t => t.qr_code === qrCode);

  if (!table) {
    return {
      valid: false,
      error: 'Código QR no registrado en el sistema',
      formatValid: true,
    };
  }

  return {
    valid: true,
    tableId: table.id,
    tableNumber: table.number,
    restaurantId: table.restaurant_id,
    capacity: table.capacity,
    status: table.status,
    qrCode,
  };
}

module.exports = {
  generateTableQR,
  validateQRCode,
  validateQRCodeWithDB,
  generateBulkQRCodes,
  getQRImageUrl,
  formatForPrinting,
  regenerateTableQR,
  QR_CONFIG,
};
