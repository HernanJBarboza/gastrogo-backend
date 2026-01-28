/**
 * GASTROGO - Mercado Pago Integration Service
 * Pasarela de pagos para cobro directo desde QR
 */

const { v4: uuidv4 } = require('uuid');

// Configuración (en producción usar variables de entorno)
const config = {
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || 'TEST-ACCESS-TOKEN',
  publicKey: process.env.MERCADOPAGO_PUBLIC_KEY || 'TEST-PUBLIC-KEY',
  webhookUrl: process.env.MERCADOPAGO_WEBHOOK_URL || 'https://gastrogo-backend.herokuapp.com/api/payments/webhook',
  successUrl: process.env.MERCADOPAGO_SUCCESS_URL || 'https://gastrogo-web.herokuapp.com/payment/success',
  failureUrl: process.env.MERCADOPAGO_FAILURE_URL || 'https://gastrogo-web.herokuapp.com/payment/failure',
  pendingUrl: process.env.MERCADOPAGO_PENDING_URL || 'https://gastrogo-web.herokuapp.com/payment/pending',
};

// Store de pagos en memoria (en producción usar PostgreSQL)
const payments = new Map();
const paymentPreferences = new Map();

/**
 * Estados de pago
 */
const PaymentStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled',
  IN_PROCESS: 'in_process',
};

/**
 * Métodos de pago soportados
 */
const PaymentMethods = {
  CREDIT_CARD: 'credit_card',
  DEBIT_CARD: 'debit_card',
  MERCADO_PAGO: 'account_money',
  QR: 'qr',
  CASH: 'cash',
};

/**
 * Crear preferencia de pago (checkout)
 */
async function createPreference(orderData) {
  const { orderId, tableNumber, items, total, customerEmail, restaurantId } = orderData;

  const preferenceId = `pref_${uuidv4()}`;
  
  // Construir items para Mercado Pago
  const mpItems = items.map(item => ({
    id: item.id,
    title: item.name,
    description: item.notes || `Mesa ${tableNumber}`,
    quantity: item.quantity,
    currency_id: 'ARS',
    unit_price: item.price,
  }));

  const preference = {
    id: preferenceId,
    order_id: orderId,
    restaurant_id: restaurantId,
    table_number: tableNumber,
    items: mpItems,
    payer: {
      email: customerEmail || 'guest@gastrogo.com',
    },
    back_urls: {
      success: `${config.successUrl}?order=${orderId}`,
      failure: `${config.failureUrl}?order=${orderId}`,
      pending: `${config.pendingUrl}?order=${orderId}`,
    },
    auto_return: 'approved',
    notification_url: config.webhookUrl,
    external_reference: orderId,
    statement_descriptor: 'GASTROGO',
    total_amount: total,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
    init_point: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${preferenceId}`,
    sandbox_init_point: `https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=${preferenceId}`,
  };

  paymentPreferences.set(preferenceId, preference);

  return {
    preference_id: preferenceId,
    init_point: preference.init_point,
    sandbox_init_point: preference.sandbox_init_point,
    qr_data: generateQRPaymentData(preference),
  };
}

/**
 * Generar datos para QR de pago
 */
function generateQRPaymentData(preference) {
  return {
    qr_type: 'dynamic',
    amount: preference.total_amount,
    external_reference: preference.external_reference,
    description: `Mesa ${preference.table_number} - GastroGO`,
    expiration_date: preference.expires_at,
  };
}

/**
 * Procesar pago (simulación - en producción usar SDK de MP)
 */
async function processPayment(paymentData) {
  const { preferenceId, paymentMethodId, cardToken, installments = 1, payerEmail } = paymentData;

  const preference = paymentPreferences.get(preferenceId);
  if (!preference) {
    throw new Error('Preferencia de pago no encontrada');
  }

  const paymentId = `pay_${uuidv4()}`;
  
  // Simular procesamiento (en producción llamar a MP API)
  const payment = {
    id: paymentId,
    preference_id: preferenceId,
    order_id: preference.order_id,
    restaurant_id: preference.restaurant_id,
    table_number: preference.table_number,
    status: PaymentStatus.APPROVED, // Simulado
    status_detail: 'accredited',
    payment_method_id: paymentMethodId || PaymentMethods.CREDIT_CARD,
    payment_type_id: 'credit_card',
    installments,
    transaction_amount: preference.total_amount,
    currency_id: 'ARS',
    payer: {
      email: payerEmail || preference.payer.email,
    },
    fee_details: [
      { type: 'mercadopago_fee', amount: preference.total_amount * 0.0399, fee_payer: 'collector' }
    ],
    net_received_amount: preference.total_amount * 0.9601,
    date_created: new Date().toISOString(),
    date_approved: new Date().toISOString(),
  };

  payments.set(paymentId, payment);

  return payment;
}

/**
 * Procesar webhook de Mercado Pago
 */
async function handleWebhook(webhookData) {
  const { type, data } = webhookData;

  if (type === 'payment') {
    const paymentId = data.id;
    const payment = payments.get(paymentId);
    
    if (payment) {
      // Actualizar estado del pago
      payment.status = data.status || payment.status;
      payment.status_detail = data.status_detail || payment.status_detail;
      payment.updated_at = new Date().toISOString();
      
      payments.set(paymentId, payment);
      
      return {
        processed: true,
        payment_id: paymentId,
        order_id: payment.order_id,
        status: payment.status,
      };
    }
  }

  return { processed: false, reason: 'unknown_event' };
}

/**
 * Obtener estado de pago
 */
function getPaymentStatus(paymentId) {
  return payments.get(paymentId) || null;
}

/**
 * Obtener pagos por orden
 */
function getPaymentsByOrder(orderId) {
  return Array.from(payments.values()).filter(p => p.order_id === orderId);
}

/**
 * Reembolsar pago
 */
async function refundPayment(paymentId, amount = null) {
  const payment = payments.get(paymentId);
  if (!payment) {
    throw new Error('Pago no encontrado');
  }

  if (payment.status !== PaymentStatus.APPROVED) {
    throw new Error('Solo se pueden reembolsar pagos aprobados');
  }

  const refundAmount = amount || payment.transaction_amount;
  
  payment.status = refundAmount === payment.transaction_amount 
    ? PaymentStatus.REFUNDED 
    : PaymentStatus.APPROVED;
  payment.refund_amount = refundAmount;
  payment.refund_date = new Date().toISOString();

  payments.set(paymentId, payment);

  return {
    payment_id: paymentId,
    refund_amount: refundAmount,
    status: payment.status,
  };
}

/**
 * Generar reporte de pagos
 */
function generateReport(filters = {}) {
  let filteredPayments = Array.from(payments.values());

  if (filters.restaurantId) {
    filteredPayments = filteredPayments.filter(p => p.restaurant_id === filters.restaurantId);
  }

  if (filters.status) {
    filteredPayments = filteredPayments.filter(p => p.status === filters.status);
  }

  if (filters.fromDate) {
    filteredPayments = filteredPayments.filter(p => 
      new Date(p.date_created) >= new Date(filters.fromDate)
    );
  }

  if (filters.toDate) {
    filteredPayments = filteredPayments.filter(p => 
      new Date(p.date_created) <= new Date(filters.toDate)
    );
  }

  const totalAmount = filteredPayments.reduce((sum, p) => sum + p.transaction_amount, 0);
  const totalFees = filteredPayments.reduce((sum, p) => 
    sum + (p.fee_details?.[0]?.amount || 0), 0
  );
  const netAmount = filteredPayments.reduce((sum, p) => sum + (p.net_received_amount || 0), 0);

  return {
    payments: filteredPayments,
    summary: {
      count: filteredPayments.length,
      total_amount: totalAmount,
      total_fees: totalFees,
      net_amount: netAmount,
      by_status: {
        approved: filteredPayments.filter(p => p.status === PaymentStatus.APPROVED).length,
        pending: filteredPayments.filter(p => p.status === PaymentStatus.PENDING).length,
        rejected: filteredPayments.filter(p => p.status === PaymentStatus.REJECTED).length,
        refunded: filteredPayments.filter(p => p.status === PaymentStatus.REFUNDED).length,
      },
    },
  };
}

module.exports = {
  config,
  PaymentStatus,
  PaymentMethods,
  createPreference,
  processPayment,
  handleWebhook,
  getPaymentStatus,
  getPaymentsByOrder,
  refundPayment,
  generateReport,
  // Exponer stores para testing
  _payments: payments,
  _preferences: paymentPreferences,
};
