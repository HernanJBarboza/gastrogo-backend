/**
 * GASTROGO - QR API Routes
 * Endpoints para gestión de códigos QR
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const qrEngine = require('../services/qr-engine');

// Mock data de mesas (en producción vendría de DB)
let tables = [
  { id: 'table-1', restaurant_id: 'rest-001', number: 1, capacity: 2, status: 'available', qr_code: 'QR-0001-1-ABC12345' },
  { id: 'table-2', restaurant_id: 'rest-001', number: 2, capacity: 4, status: 'available', qr_code: 'QR-0001-2-DEF67890' },
  { id: 'table-3', restaurant_id: 'rest-001', number: 3, capacity: 4, status: 'occupied', qr_code: 'QR-0001-3-GHI11223' },
  { id: 'table-4', restaurant_id: 'rest-001', number: 4, capacity: 6, status: 'available', qr_code: 'QR-0001-4-JKL44556' },
  { id: 'table-5', restaurant_id: 'rest-001', number: 5, capacity: 4, status: 'available', qr_code: 'QR-0001-5-MNO77889' },
];

const restaurants = [
  { 
    id: 'rest-001', 
    name: 'La Parrilla del Puerto', 
    wifi_network: 'LaParrilla_Guest',
    wifi_password: 'bienvenido2024',
  },
];

/**
 * POST /api/qr/generate
 * Generar QR para una mesa específica
 */
router.post('/generate', authenticate, authorize(['staff', 'admin']), async (req, res) => {
  try {
    const { table_id } = req.body;
    const { user } = req;
    
    if (!table_id) {
      return res.status(400).json({
        success: false,
        error: 'ID de mesa requerido',
      });
    }
    
    const table = tables.find(t => t.id === table_id);
    
    if (!table) {
      return res.status(404).json({
        success: false,
        error: 'Mesa no encontrada',
      });
    }
    
    // Validar acceso al restaurante
    if (user.role === 'staff' && table.restaurant_id !== user.restaurant_id) {
      return res.status(403).json({
        success: false,
        error: 'No tiene acceso a esta mesa',
      });
    }
    
    // Generar nuevo QR
    const qrData = qrEngine.generateTableQR({
      restaurantId: table.restaurant_id,
      tableId: table.id,
      tableNumber: table.number,
    });
    
    // Actualizar mesa con nuevo código
    const tableIndex = tables.findIndex(t => t.id === table_id);
    tables[tableIndex].qr_code = qrData.qrCode;
    
    res.json({
      success: true,
      data: {
        ...qrData,
        imageUrl: qrEngine.getQRImageUrl(qrData.menuUrl),
      },
      message: 'QR generado exitosamente',
    });
  } catch (error) {
    console.error('Error generating QR:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar QR',
    });
  }
});

/**
 * POST /api/qr/generate-bulk
 * Generar QR para todas las mesas de un restaurante
 */
router.post('/generate-bulk', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { restaurant_id } = req.body;
    
    if (!restaurant_id) {
      return res.status(400).json({
        success: false,
        error: 'ID de restaurante requerido',
      });
    }
    
    const restaurantTables = tables.filter(t => t.restaurant_id === restaurant_id);
    
    if (restaurantTables.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No hay mesas para este restaurante',
      });
    }
    
    // Generar QR para cada mesa
    const qrCodes = qrEngine.generateBulkQRCodes(restaurant_id, restaurantTables);
    
    // Actualizar mesas con nuevos códigos
    qrCodes.forEach(qr => {
      const tableIndex = tables.findIndex(t => t.id === qr.tableId);
      if (tableIndex !== -1) {
        tables[tableIndex].qr_code = qr.qrCode;
      }
    });
    
    // Agregar URLs de imagen
    const qrCodesWithImages = qrCodes.map(qr => ({
      ...qr,
      imageUrl: qrEngine.getQRImageUrl(qr.menuUrl),
    }));
    
    res.json({
      success: true,
      data: qrCodesWithImages,
      count: qrCodesWithImages.length,
      message: `${qrCodesWithImages.length} códigos QR generados`,
    });
  } catch (error) {
    console.error('Error generating bulk QR:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar QRs',
    });
  }
});

/**
 * GET /api/qr/validate/:code
 * Validar un código QR (público)
 */
router.get('/validate/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    const result = qrEngine.validateQRCode(code, tables);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Código QR inválido',
      });
    }
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error validating QR:', error);
    res.status(500).json({
      success: false,
      error: 'Error al validar QR',
    });
  }
});

/**
 * GET /api/qr/table/:tableId/print
 * Obtener datos para imprimir etiqueta con QR
 */
router.get('/table/:tableId/print', authenticate, authorize(['staff', 'admin']), async (req, res) => {
  try {
    const { tableId } = req.params;
    const { user } = req;
    
    const table = tables.find(t => t.id === tableId);
    
    if (!table) {
      return res.status(404).json({
        success: false,
        error: 'Mesa no encontrada',
      });
    }
    
    // Validar acceso
    if (user.role === 'staff' && table.restaurant_id !== user.restaurant_id) {
      return res.status(403).json({
        success: false,
        error: 'No tiene acceso a esta mesa',
      });
    }
    
    const restaurant = restaurants.find(r => r.id === table.restaurant_id);
    
    // Generar QR si no existe
    let qrData;
    if (!table.qr_code) {
      qrData = qrEngine.generateTableQR({
        restaurantId: table.restaurant_id,
        tableId: table.id,
        tableNumber: table.number,
      });
      
      // Actualizar mesa
      const tableIndex = tables.findIndex(t => t.id === tableId);
      tables[tableIndex].qr_code = qrData.qrCode;
    } else {
      qrData = {
        qrCode: table.qr_code,
        menuUrl: `${qrEngine.QR_CONFIG.baseUrl}/menu?table=${table.number}&qr=${table.qr_code}`,
        tableNumber: table.number,
      };
    }
    
    const printData = qrEngine.formatForPrinting(qrData, restaurant);
    
    res.json({
      success: true,
      data: printData,
    });
  } catch (error) {
    console.error('Error getting print data:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener datos de impresión',
    });
  }
});

/**
 * POST /api/qr/table/:tableId/regenerate
 * Regenerar QR de una mesa (por seguridad)
 */
router.post('/table/:tableId/regenerate', authenticate, authorize(['staff', 'admin']), async (req, res) => {
  try {
    const { tableId } = req.params;
    const { user } = req;
    
    const table = tables.find(t => t.id === tableId);
    
    if (!table) {
      return res.status(404).json({
        success: false,
        error: 'Mesa no encontrada',
      });
    }
    
    // Validar acceso
    if (user.role === 'staff' && table.restaurant_id !== user.restaurant_id) {
      return res.status(403).json({
        success: false,
        error: 'No tiene acceso a esta mesa',
      });
    }
    
    const oldQrCode = table.qr_code;
    
    // Regenerar
    const newQr = qrEngine.regenerateTableQR(table);
    
    // Actualizar mesa
    const tableIndex = tables.findIndex(t => t.id === tableId);
    tables[tableIndex].qr_code = newQr.qrCode;
    
    res.json({
      success: true,
      data: {
        ...newQr,
        imageUrl: qrEngine.getQRImageUrl(newQr.menuUrl),
        previousQrCode: oldQrCode,
      },
      message: 'QR regenerado exitosamente. El código anterior ya no será válido.',
    });
  } catch (error) {
    console.error('Error regenerating QR:', error);
    res.status(500).json({
      success: false,
      error: 'Error al regenerar QR',
    });
  }
});

module.exports = router;
