/**
 * GASTROGO - Menu API Routes
 * Endpoints para obtener categorías y platos del menú
 */

const express = require('express');
const router = express.Router();
const { authenticate, validateRestaurant } = require('../middleware/auth');

// Simular pool de PostgreSQL (en producción usar pg)
const mockCategories = [
  { id: 'cat-1', restaurant_id: 'rest-001', name: 'Entradas', icon: '🥗', display_order: 1, active: true },
  { id: 'cat-2', restaurant_id: 'rest-001', name: 'Parrilla', icon: '🥩', display_order: 2, active: true },
  { id: 'cat-3', restaurant_id: 'rest-001', name: 'Pastas', icon: '🍝', display_order: 3, active: true },
  { id: 'cat-4', restaurant_id: 'rest-001', name: 'Pescados', icon: '🐟', display_order: 4, active: true },
  { id: 'cat-5', restaurant_id: 'rest-001', name: 'Guarniciones', icon: '🥔', display_order: 5, active: true },
  { id: 'cat-6', restaurant_id: 'rest-001', name: 'Postres', icon: '🍰', display_order: 6, active: true },
  { id: 'cat-7', restaurant_id: 'rest-001', name: 'Bebidas', icon: '🍷', display_order: 7, active: true },
];

const mockDishes = [
  {
    id: 'dish-1',
    restaurant_id: 'rest-001',
    category_id: 'cat-1',
    name: 'Provoleta',
    description: 'Queso provolone a la parrilla con orégano y aceite de oliva.',
    price: 3500,
    image_url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800',
    available: true,
    preparation_time: 10,
    allergens: ['lactosa'],
  },
  {
    id: 'dish-2',
    restaurant_id: 'rest-001',
    category_id: 'cat-1',
    name: 'Empanadas Criollas',
    description: 'Empanadas caseras de carne cortada a cuchillo. Pack de 3.',
    price: 2800,
    image_url: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800',
    available: true,
    preparation_time: 15,
    allergens: ['gluten', 'huevo'],
  },
  {
    id: 'dish-3',
    restaurant_id: 'rest-001',
    category_id: 'cat-2',
    name: 'Bife de Chorizo',
    description: 'Corte premium de 400g, madurado 21 días.',
    price: 12500,
    image_url: 'https://images.unsplash.com/photo-1558030006-450675393462?w=800',
    available: true,
    preparation_time: 25,
    allergens: [],
  },
  {
    id: 'dish-4',
    restaurant_id: 'rest-001',
    category_id: 'cat-2',
    name: 'Entraña',
    description: 'Corte clásico argentino de 350g, tierno y sabroso.',
    price: 10800,
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    available: true,
    preparation_time: 20,
    allergens: [],
  },
  {
    id: 'dish-5',
    restaurant_id: 'rest-001',
    category_id: 'cat-3',
    name: 'Ñoquis de Papa',
    description: 'Ñoquis caseros con salsa a elección.',
    price: 7200,
    image_url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800',
    available: true,
    preparation_time: 15,
    allergens: ['gluten', 'huevo', 'lactosa'],
  },
  {
    id: 'dish-6',
    restaurant_id: 'rest-001',
    category_id: 'cat-6',
    name: 'Tiramisú',
    description: 'Postre italiano con mascarpone y café espresso.',
    price: 4200,
    image_url: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800',
    available: true,
    preparation_time: 5,
    allergens: ['lactosa', 'huevo', 'gluten'],
  },
];

const mockModifiers = [
  {
    id: 'mod-1',
    dish_id: 'dish-1',
    name: 'Tamaño',
    required: false,
    max_selections: 1,
    options: [
      { name: 'Individual', price_adjustment: 0 },
      { name: 'Para compartir', price_adjustment: 1500 },
    ],
  },
  {
    id: 'mod-2',
    dish_id: 'dish-3',
    name: 'Punto de cocción',
    required: true,
    max_selections: 1,
    options: [
      { name: 'Jugoso', price_adjustment: 0 },
      { name: 'A punto', price_adjustment: 0 },
      { name: 'Cocido', price_adjustment: 0 },
    ],
  },
  {
    id: 'mod-3',
    dish_id: 'dish-3',
    name: 'Guarnición',
    required: false,
    max_selections: 1,
    options: [
      { name: 'Papas fritas', price_adjustment: 0 },
      { name: 'Puré', price_adjustment: 0 },
      { name: 'Ensalada mixta', price_adjustment: 0 },
      { name: 'Verduras grilladas', price_adjustment: 500 },
    ],
  },
  {
    id: 'mod-4',
    dish_id: 'dish-5',
    name: 'Salsa',
    required: true,
    max_selections: 1,
    options: [
      { name: 'Bolognesa', price_adjustment: 0 },
      { name: 'Filetto', price_adjustment: 0 },
      { name: 'Cuatro quesos', price_adjustment: 800 },
      { name: 'Pesto', price_adjustment: 600 },
    ],
  },
];

/**
 * GET /api/menu/categories
 * Obtener todas las categorías activas del restaurante
 */
router.get('/categories', async (req, res) => {
  try {
    const { restaurant_id } = req.query;
    
    let categories = mockCategories;
    if (restaurant_id) {
      categories = categories.filter(c => c.restaurant_id === restaurant_id);
    }
    
    // Contar platos por categoría
    const categoriesWithCount = categories
      .filter(c => c.active)
      .map(cat => ({
        ...cat,
        dish_count: mockDishes.filter(d => d.category_id === cat.id && d.available).length,
      }))
      .sort((a, b) => a.display_order - b.display_order);
    
    res.json({
      success: true,
      data: categoriesWithCount,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener categorías',
    });
  }
});

/**
 * GET /api/menu/dishes
 * Obtener todos los platos, opcionalmente filtrados por categoría
 */
router.get('/dishes', async (req, res) => {
  try {
    const { restaurant_id, category_id, available_only } = req.query;
    
    let dishes = mockDishes;
    
    if (restaurant_id) {
      dishes = dishes.filter(d => d.restaurant_id === restaurant_id);
    }
    
    if (category_id) {
      dishes = dishes.filter(d => d.category_id === category_id);
    }
    
    if (available_only === 'true') {
      dishes = dishes.filter(d => d.available);
    }
    
    // Agregar modificadores a cada plato
    const dishesWithModifiers = dishes.map(dish => ({
      ...dish,
      modifiers: mockModifiers.filter(m => m.dish_id === dish.id),
    }));
    
    res.json({
      success: true,
      data: dishesWithModifiers,
    });
  } catch (error) {
    console.error('Error fetching dishes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener platos',
    });
  }
});

/**
 * GET /api/menu/dishes/:id
 * Obtener detalle de un plato específico
 */
router.get('/dishes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const dish = mockDishes.find(d => d.id === id);
    
    if (!dish) {
      return res.status(404).json({
        success: false,
        error: 'Plato no encontrado',
      });
    }
    
    const dishWithModifiers = {
      ...dish,
      modifiers: mockModifiers.filter(m => m.dish_id === dish.id),
    };
    
    res.json({
      success: true,
      data: dishWithModifiers,
    });
  } catch (error) {
    console.error('Error fetching dish:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener plato',
    });
  }
});

/**
 * GET /api/menu/full
 * Obtener menú completo (categorías + platos) en una sola llamada
 */
router.get('/full', async (req, res) => {
  try {
    const { restaurant_id } = req.query;
    
    let categories = mockCategories;
    let dishes = mockDishes;
    
    if (restaurant_id) {
      categories = categories.filter(c => c.restaurant_id === restaurant_id);
      dishes = dishes.filter(d => d.restaurant_id === restaurant_id);
    }
    
    // Agregar modificadores a platos
    const dishesWithModifiers = dishes.map(dish => ({
      ...dish,
      modifiers: mockModifiers.filter(m => m.dish_id === dish.id),
    }));
    
    // Estructurar por categoría
    const menu = categories
      .filter(c => c.active)
      .sort((a, b) => a.display_order - b.display_order)
      .map(cat => ({
        ...cat,
        dishes: dishesWithModifiers.filter(d => d.category_id === cat.id),
      }));
    
    res.json({
      success: true,
      data: {
        categories: menu,
        total_dishes: dishes.length,
        available_dishes: dishes.filter(d => d.available).length,
      },
    });
  } catch (error) {
    console.error('Error fetching full menu:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener menú',
    });
  }
});

module.exports = router;
