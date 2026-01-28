/**
 * GASTROGO - Display/Digital Signage API Routes
 * Endpoints para gestionar contenido de pantallas TV
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// In-memory storage (en producción usar PostgreSQL)
let displayConfigs = new Map();
let displaySlides = new Map();

// Default slides for new restaurants
const defaultSlides = [
  {
    id: 'welcome-default',
    type: 'welcome',
    title: 'Bienvenidos',
    subtitle: 'Pedí desde tu mesa, sin esperas',
    description: 'features',
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    duration: 10,
    active: true,
    order: 0
  },
  {
    id: 'promo-default',
    type: 'promo',
    title: 'Promoción del Día',
    subtitle: 'Consulta con el mozo',
    badge: '🎉 HOY',
    backgroundColor: '#ff6b35',
    duration: 8,
    active: true,
    order: 1
  },
  {
    id: 'menu-default',
    type: 'menu',
    title: '📋 Nuestro Menú',
    duration: 12,
    active: true,
    order: 2
  }
];

const defaultConfig = {
  restaurantName: 'Mi Restaurante',
  logo: '🍴',
  theme: 'dark',
  slideInterval: 8,
  showClock: true,
  showWeather: true,
  weatherCity: 'Buenos Aires',
  tickerMessages: [
    '📶 WiFi Gratis disponible',
    '📱 Pedí desde tu mesa escaneando el QR',
    '💳 Aceptamos todas las tarjetas'
  ]
};

/**
 * GET /api/display/:restaurantId
 * Obtener configuración completa del display para un restaurante
 */
router.get('/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    // Get or create config
    let config = displayConfigs.get(restaurantId);
    if (!config) {
      config = { ...defaultConfig, restaurantId };
      displayConfigs.set(restaurantId, config);
    }
    
    // Get or create slides
    let slides = displaySlides.get(restaurantId);
    if (!slides) {
      slides = defaultSlides.map(s => ({ ...s, restaurantId }));
      displaySlides.set(restaurantId, slides);
    }
    
    res.json({
      success: true,
      data: {
        config,
        slides: slides.filter(s => s.active).sort((a, b) => a.order - b.order)
      }
    });
  } catch (error) {
    console.error('Error fetching display config:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener configuración del display'
    });
  }
});

/**
 * PUT /api/display/:restaurantId/config
 * Actualizar configuración del display
 */
router.put('/:restaurantId/config', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const updates = req.body;
    
    let config = displayConfigs.get(restaurantId) || { ...defaultConfig };
    config = { ...config, ...updates, restaurantId, updatedAt: new Date().toISOString() };
    displayConfigs.set(restaurantId, config);
    
    // Emit WebSocket event for live update
    const io = req.app.get('io');
    if (io) {
      io.to(`display:${restaurantId}`).emit('display:config_updated', config);
    }
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error updating display config:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar configuración'
    });
  }
});

/**
 * GET /api/display/:restaurantId/slides
 * Obtener todos los slides (incluyendo inactivos)
 */
router.get('/:restaurantId/slides', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { active } = req.query;
    
    let slides = displaySlides.get(restaurantId);
    if (!slides) {
      slides = defaultSlides.map(s => ({ ...s, restaurantId }));
      displaySlides.set(restaurantId, slides);
    }
    
    if (active === 'true') {
      slides = slides.filter(s => s.active);
    }
    
    res.json({
      success: true,
      data: slides.sort((a, b) => a.order - b.order)
    });
  } catch (error) {
    console.error('Error fetching slides:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener slides'
    });
  }
});

/**
 * POST /api/display/:restaurantId/slides
 * Crear nuevo slide
 */
router.post('/:restaurantId/slides', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const slideData = req.body;
    
    let slides = displaySlides.get(restaurantId) || [];
    
    const newSlide = {
      id: uuidv4(),
      ...slideData,
      restaurantId,
      order: slides.length,
      active: true,
      createdAt: new Date().toISOString()
    };
    
    slides.push(newSlide);
    displaySlides.set(restaurantId, slides);
    
    // Emit WebSocket event
    const io = req.app.get('io');
    if (io) {
      io.to(`display:${restaurantId}`).emit('display:slide_added', newSlide);
    }
    
    res.status(201).json({
      success: true,
      data: newSlide
    });
  } catch (error) {
    console.error('Error creating slide:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear slide'
    });
  }
});

/**
 * PUT /api/display/:restaurantId/slides/:slideId
 * Actualizar slide existente
 */
router.put('/:restaurantId/slides/:slideId', async (req, res) => {
  try {
    const { restaurantId, slideId } = req.params;
    const updates = req.body;
    
    let slides = displaySlides.get(restaurantId);
    if (!slides) {
      return res.status(404).json({
        success: false,
        error: 'Slides no encontrados'
      });
    }
    
    const index = slides.findIndex(s => s.id === slideId);
    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Slide no encontrado'
      });
    }
    
    slides[index] = { ...slides[index], ...updates, updatedAt: new Date().toISOString() };
    displaySlides.set(restaurantId, slides);
    
    // Emit WebSocket event
    const io = req.app.get('io');
    if (io) {
      io.to(`display:${restaurantId}`).emit('display:slide_updated', slides[index]);
    }
    
    res.json({
      success: true,
      data: slides[index]
    });
  } catch (error) {
    console.error('Error updating slide:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar slide'
    });
  }
});

/**
 * DELETE /api/display/:restaurantId/slides/:slideId
 * Eliminar slide
 */
router.delete('/:restaurantId/slides/:slideId', async (req, res) => {
  try {
    const { restaurantId, slideId } = req.params;
    
    let slides = displaySlides.get(restaurantId);
    if (!slides) {
      return res.status(404).json({
        success: false,
        error: 'Slides no encontrados'
      });
    }
    
    const index = slides.findIndex(s => s.id === slideId);
    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Slide no encontrado'
      });
    }
    
    slides.splice(index, 1);
    displaySlides.set(restaurantId, slides);
    
    // Emit WebSocket event
    const io = req.app.get('io');
    if (io) {
      io.to(`display:${restaurantId}`).emit('display:slide_removed', { slideId });
    }
    
    res.json({
      success: true,
      message: 'Slide eliminado'
    });
  } catch (error) {
    console.error('Error deleting slide:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar slide'
    });
  }
});

/**
 * PUT /api/display/:restaurantId/slides/reorder
 * Reordenar slides
 */
router.put('/:restaurantId/slides/reorder', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { slideIds } = req.body; // Array of slide IDs in new order
    
    let slides = displaySlides.get(restaurantId);
    if (!slides) {
      return res.status(404).json({
        success: false,
        error: 'Slides no encontrados'
      });
    }
    
    // Reorder slides based on provided order
    slideIds.forEach((id, index) => {
      const slide = slides.find(s => s.id === id);
      if (slide) {
        slide.order = index;
      }
    });
    
    displaySlides.set(restaurantId, slides);
    
    // Emit WebSocket event
    const io = req.app.get('io');
    if (io) {
      io.to(`display:${restaurantId}`).emit('display:slides_reordered', { slideIds });
    }
    
    res.json({
      success: true,
      data: slides.sort((a, b) => a.order - b.order)
    });
  } catch (error) {
    console.error('Error reordering slides:', error);
    res.status(500).json({
      success: false,
      error: 'Error al reordenar slides'
    });
  }
});

/**
 * PUT /api/display/:restaurantId/ticker
 * Actualizar mensajes del ticker
 */
router.put('/:restaurantId/ticker', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { messages } = req.body;
    
    let config = displayConfigs.get(restaurantId) || { ...defaultConfig };
    config.tickerMessages = messages;
    config.updatedAt = new Date().toISOString();
    displayConfigs.set(restaurantId, config);
    
    // Emit WebSocket event
    const io = req.app.get('io');
    if (io) {
      io.to(`display:${restaurantId}`).emit('display:ticker_updated', { messages });
    }
    
    res.json({
      success: true,
      data: config.tickerMessages
    });
  } catch (error) {
    console.error('Error updating ticker:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar ticker'
    });
  }
});

/**
 * POST /api/display/:restaurantId/announcement
 * Enviar anuncio instantáneo (interrumpe slides actuales)
 */
router.post('/:restaurantId/announcement', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { title, message, duration = 10, type = 'info' } = req.body;
    
    const announcement = {
      id: uuidv4(),
      title,
      message,
      duration,
      type, // info, warning, promo
      createdAt: new Date().toISOString()
    };
    
    // Emit WebSocket event for instant display
    const io = req.app.get('io');
    if (io) {
      io.to(`display:${restaurantId}`).emit('display:instant_announcement', announcement);
    }
    
    res.json({
      success: true,
      data: announcement,
      message: 'Anuncio enviado a pantallas'
    });
  } catch (error) {
    console.error('Error sending announcement:', error);
    res.status(500).json({
      success: false,
      error: 'Error al enviar anuncio'
    });
  }
});

module.exports = router;
