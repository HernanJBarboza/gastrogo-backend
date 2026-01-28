-- =====================================================
-- GASTROGO: Datos de Prueba (Seed Data)
-- =====================================================

-- Limpiar datos existentes (en orden correcto por FK)
TRUNCATE order_items, order_status_history, orders, dish_modifiers, 
         dishes, categories, table_sessions, tables, users, notifications, 
         restaurants CASCADE;

-- =====================================================
-- RESTAURANTE DEMO
-- =====================================================
INSERT INTO restaurants (id, name, slug, description, logo_url, address, phone, email, currency, settings) VALUES 
(
    '11111111-1111-1111-1111-111111111111',
    'La Parrilla del Puerto',
    'parrilla-puerto',
    'Los mejores cortes de carne a la parrilla con vista al puerto',
    '/images/logo-parrilla.png',
    'Av. Costanera 1234, Puerto Madero',
    '+54 11 4567-8900',
    'contacto@parrillapuerto.com',
    'ARS',
    '{"tax_rate": 21, "service_charge": 10, "accept_reservations": true}'
);

-- =====================================================
-- USUARIOS
-- =====================================================
-- Password: admin123 (bcrypt hash)
INSERT INTO users (id, restaurant_id, email, password_hash, name, role, provider) VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin@parrilla.com', '$2b$10$rOzJqQZQKqK8qZJ8YqJ8q.8qZJ8qZJ8qZJ8qZJ8qZJ8qZJ8qZJ8qZJ', 'Carlos Administrador', 'admin', 'email'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'cocina@parrilla.com', '$2b$10$rOzJqQZQKqK8qZJ8YqJ8q.8qZJ8qZJ8qZJ8qZJ8qZJ8qZJ8qZJ8qZJ', 'Chef Mario', 'staff', 'email'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'mozo@parrilla.com', '$2b$10$rOzJqQZQKqK8qZJ8YqJ8q.8qZJ8qZJ8qZJ8qZJ8qZJ8qZJ8qZJ8qZJ', 'Pedro Mozo', 'staff', 'email');

-- =====================================================
-- MESAS CON QR CODES
-- =====================================================
INSERT INTO tables (id, restaurant_id, table_number, qr_code, capacity, location, is_active) VALUES 
    ('11110001-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', '1', 'qr-mesa-001-abc123', 4, 'interior', true),
    ('11110001-0001-0001-0001-000000000002', '11111111-1111-1111-1111-111111111111', '2', 'qr-mesa-002-def456', 4, 'interior', true),
    ('11110001-0001-0001-0001-000000000003', '11111111-1111-1111-1111-111111111111', '3', 'qr-mesa-003-ghi789', 6, 'interior', true),
    ('11110001-0001-0001-0001-000000000004', '11111111-1111-1111-1111-111111111111', '4', 'qr-mesa-004-jkl012', 2, 'terraza', true),
    ('11110001-0001-0001-0001-000000000005', '11111111-1111-1111-1111-111111111111', '5', 'qr-mesa-005-mno345', 2, 'terraza', true),
    ('11110001-0001-0001-0001-000000000006', '11111111-1111-1111-1111-111111111111', '6', 'qr-mesa-006-pqr678', 8, 'vip', true),
    ('11110001-0001-0001-0001-000000000007', '11111111-1111-1111-1111-111111111111', '7', 'qr-mesa-007-stu901', 4, 'interior', true),
    ('11110001-0001-0001-0001-000000000008', '11111111-1111-1111-1111-111111111111', '8', 'qr-mesa-008-vwx234', 4, 'interior', true),
    ('11110001-0001-0001-0001-000000000009', '11111111-1111-1111-1111-111111111111', '9', 'qr-mesa-009-yza567', 6, 'terraza', true),
    ('11110001-0001-0001-0001-000000000010', '11111111-1111-1111-1111-111111111111', '10', 'qr-mesa-010-bcd890', 10, 'salon_privado', true);

-- =====================================================
-- CATEGORÍAS
-- =====================================================
INSERT INTO categories (id, restaurant_id, name, slug, description, icon, display_order, is_active) VALUES 
    ('22220001-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'Entradas', 'entradas', 'Para comenzar la experiencia', '🥗', 1, true),
    ('22220001-0001-0001-0001-000000000002', '11111111-1111-1111-1111-111111111111', 'Parrilla', 'parrilla', 'Nuestros cortes a la parrilla', '🥩', 2, true),
    ('22220001-0001-0001-0001-000000000003', '11111111-1111-1111-1111-111111111111', 'Pastas', 'pastas', 'Pastas caseras', '🍝', 3, true),
    ('22220001-0001-0001-0001-000000000004', '11111111-1111-1111-1111-111111111111', 'Mariscos', 'mariscos', 'Frescos del día', '🦐', 4, true),
    ('22220001-0001-0001-0001-000000000005', '11111111-1111-1111-1111-111111111111', 'Postres', 'postres', 'Dulces tentaciones', '🍮', 5, true),
    ('22220001-0001-0001-0001-000000000006', '11111111-1111-1111-1111-111111111111', 'Bebidas', 'bebidas', 'Vinos, cervezas y más', '🍷', 6, true);

-- =====================================================
-- PLATOS
-- =====================================================

-- ENTRADAS
INSERT INTO dishes (id, restaurant_id, category_id, name, slug, description, price, image_url, preparation_time, tags, is_featured, is_available) VALUES 
    ('33330001-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000001', 'Provoleta', 'provoleta', 'Queso provolone a la parrilla con orégano y aceite de oliva', 2500.00, '/images/provoleta.jpg', 10, '["vegetariano", "popular"]', true, true),
    ('33330001-0001-0001-0001-000000000002', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000001', 'Empanadas (x3)', 'empanadas', 'Empanadas de carne cortada a cuchillo', 1800.00, '/images/empanadas.jpg', 8, '["popular"]', false, true),
    ('33330001-0001-0001-0001-000000000003', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000001', 'Tabla de Fiambres', 'tabla-fiambres', 'Jamón crudo, bondiola, quesos y aceitunas', 4500.00, '/images/tabla.jpg', 5, '[]', false, true),
    ('33330001-0001-0001-0001-000000000004', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000001', 'Ensalada Caesar', 'ensalada-caesar', 'Lechuga, parmesano, croutones y aderezo caesar', 2200.00, '/images/caesar.jpg', 7, '["vegetariano"]', false, true);

-- PARRILLA
INSERT INTO dishes (id, restaurant_id, category_id, name, slug, description, price, image_url, preparation_time, calories, tags, is_featured, is_available) VALUES 
    ('33330001-0001-0001-0001-000000000010', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000002', 'Bife de Chorizo 400g', 'bife-chorizo', 'Corte clásico argentino, jugoso y sabroso', 8500.00, '/images/bife-chorizo.jpg', 25, 650, '["popular", "recomendado"]', true, true),
    ('33330001-0001-0001-0001-000000000011', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000002', 'Ojo de Bife 350g', 'ojo-bife', 'Corte premium, tierno y con marmoleado perfecto', 9500.00, '/images/ojo-bife.jpg', 22, 580, '["premium"]', true, true),
    ('33330001-0001-0001-0001-000000000012', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000002', 'Entraña 300g', 'entrana', 'Corte jugoso con sabor intenso', 7200.00, '/images/entrana.jpg', 18, 420, '["popular"]', false, true),
    ('33330001-0001-0001-0001-000000000013', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000002', 'Asado de Tira 500g', 'asado-tira', 'Costillas a la cruz, sabor tradicional', 7800.00, '/images/asado-tira.jpg', 35, 720, '["tradicional"]', false, true),
    ('33330001-0001-0001-0001-000000000014', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000002', 'Vacío 400g', 'vacio', 'Corte tierno ideal para compartir', 7500.00, '/images/vacio.jpg', 28, 550, '[]', false, true),
    ('33330001-0001-0001-0001-000000000015', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000002', 'Parrillada para 2', 'parrillada-2', 'Bife, chorizo, morcilla, chinchulín y guarnición', 16500.00, '/images/parrillada.jpg', 40, 1800, '["para compartir", "popular"]', true, true);

-- PASTAS
INSERT INTO dishes (id, restaurant_id, category_id, name, slug, description, price, image_url, preparation_time, tags, is_featured, is_available) VALUES 
    ('33330001-0001-0001-0001-000000000020', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000003', 'Ñoquis de Papa', 'noquis-papa', 'Ñoquis caseros con salsa a elección', 4200.00, '/images/noquis.jpg', 15, '["vegetariano"]', false, true),
    ('33330001-0001-0001-0001-000000000021', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000003', 'Sorrentinos de Jamón y Queso', 'sorrentinos', 'Pasta rellena con salsa rosa', 4800.00, '/images/sorrentinos.jpg', 18, '[]', false, true),
    ('33330001-0001-0001-0001-000000000022', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000003', 'Ravioles de Ricota', 'ravioles-ricota', 'Con salsa fileto casera', 4500.00, '/images/ravioles.jpg', 15, '["vegetariano"]', false, true);

-- MARISCOS
INSERT INTO dishes (id, restaurant_id, category_id, name, slug, description, price, image_url, preparation_time, allergens, tags, is_featured, is_available) VALUES 
    ('33330001-0001-0001-0001-000000000030', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000004', 'Salmón Grillé', 'salmon-grille', 'Filete de salmón con vegetales salteados', 9200.00, '/images/salmon.jpg', 20, '["pescado"]', '["saludable"]', true, true),
    ('33330001-0001-0001-0001-000000000031', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000004', 'Langostinos al Ajillo', 'langostinos-ajillo', '8 langostinos en salsa de ajo y perejil', 8500.00, '/images/langostinos.jpg', 15, '["mariscos"]', '["popular"]', false, true),
    ('33330001-0001-0001-0001-000000000032', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000004', 'Paella Marinera', 'paella', 'Arroz con mariscos variados (2 personas)', 14500.00, '/images/paella.jpg', 35, '["mariscos", "gluten"]', '["para compartir"]', true, true);

-- POSTRES
INSERT INTO dishes (id, restaurant_id, category_id, name, slug, description, price, image_url, preparation_time, tags, is_featured, is_available) VALUES 
    ('33330001-0001-0001-0001-000000000040', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000005', 'Flan Casero', 'flan-casero', 'Con dulce de leche y crema', 1800.00, '/images/flan.jpg', 3, '["popular"]', false, true),
    ('33330001-0001-0001-0001-000000000041', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000005', 'Tiramisú', 'tiramisu', 'Receta italiana tradicional', 2200.00, '/images/tiramisu.jpg', 3, '[]', true, true),
    ('33330001-0001-0001-0001-000000000042', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000005', 'Volcán de Chocolate', 'volcan-chocolate', 'Con helado de vainilla', 2500.00, '/images/volcan.jpg', 12, '["popular"]', true, true),
    ('33330001-0001-0001-0001-000000000043', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000005', 'Panqueques con Dulce de Leche', 'panqueques', 'Dos panqueques con DDL y nueces', 1900.00, '/images/panqueques.jpg', 8, '[]', false, true);

-- BEBIDAS
INSERT INTO dishes (id, restaurant_id, category_id, name, slug, description, price, image_url, preparation_time, tags, is_featured, is_available) VALUES 
    ('33330001-0001-0001-0001-000000000050', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000006', 'Vino Malbec (Botella)', 'malbec-botella', 'Malbec reserva de Mendoza', 6500.00, '/images/malbec.jpg', 2, '["vino"]', true, true),
    ('33330001-0001-0001-0001-000000000051', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000006', 'Vino Malbec (Copa)', 'malbec-copa', 'Malbec reserva', 1500.00, '/images/copa-vino.jpg', 1, '["vino"]', false, true),
    ('33330001-0001-0001-0001-000000000052', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000006', 'Cerveza Artesanal', 'cerveza-artesanal', 'IPA, Stout o Honey disponibles', 1200.00, '/images/cerveza.jpg', 1, '["cerveza"]', false, true),
    ('33330001-0001-0001-0001-000000000053', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000006', 'Agua Mineral', 'agua', 'Con o sin gas 500ml', 600.00, '/images/agua.jpg', 1, '[]', false, true),
    ('33330001-0001-0001-0001-000000000054', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000006', 'Gaseosa', 'gaseosa', 'Coca-Cola, Sprite o Fanta', 800.00, '/images/gaseosa.jpg', 1, '[]', false, true),
    ('33330001-0001-0001-0001-000000000055', '11111111-1111-1111-1111-111111111111', '22220001-0001-0001-0001-000000000006', 'Café Espresso', 'cafe-espresso', 'Café recién molido', 700.00, '/images/cafe.jpg', 3, '[]', false, true);

-- =====================================================
-- MODIFICADORES DE PLATOS
-- =====================================================
INSERT INTO dish_modifiers (dish_id, name, options, is_required, max_selections) VALUES 
    -- Punto de cocción para carnes
    ('33330001-0001-0001-0001-000000000010', 'Punto de cocción', '[{"name": "Jugoso", "price": 0}, {"name": "A punto", "price": 0}, {"name": "Cocido", "price": 0}]', true, 1),
    ('33330001-0001-0001-0001-000000000011', 'Punto de cocción', '[{"name": "Jugoso", "price": 0}, {"name": "A punto", "price": 0}, {"name": "Cocido", "price": 0}]', true, 1),
    ('33330001-0001-0001-0001-000000000012', 'Punto de cocción', '[{"name": "Jugoso", "price": 0}, {"name": "A punto", "price": 0}, {"name": "Cocido", "price": 0}]', true, 1),
    -- Guarniciones
    ('33330001-0001-0001-0001-000000000010', 'Guarnición', '[{"name": "Papas fritas", "price": 0}, {"name": "Puré", "price": 0}, {"name": "Ensalada mixta", "price": 0}, {"name": "Vegetales grillé", "price": 500}]', false, 1),
    ('33330001-0001-0001-0001-000000000011', 'Guarnición', '[{"name": "Papas fritas", "price": 0}, {"name": "Puré", "price": 0}, {"name": "Ensalada mixta", "price": 0}, {"name": "Vegetales grillé", "price": 500}]', false, 1),
    -- Salsas para pastas
    ('33330001-0001-0001-0001-000000000020', 'Salsa', '[{"name": "Bolognesa", "price": 0}, {"name": "Fileto", "price": 0}, {"name": "4 quesos", "price": 300}, {"name": "Crema", "price": 200}]', true, 1),
    -- Sabores de empanadas
    ('33330001-0001-0001-0001-000000000002', 'Sabor', '[{"name": "Carne", "price": 0}, {"name": "Pollo", "price": 0}, {"name": "Jamón y queso", "price": 0}, {"name": "Verdura", "price": 0}]', true, 3);

-- =====================================================
-- PEDIDOS DE EJEMPLO
-- =====================================================

-- Sesión activa para Mesa 5
INSERT INTO table_sessions (id, table_id, session_token, is_active) VALUES 
    ('44440001-0001-0001-0001-000000000001', '11110001-0001-0001-0001-000000000005', 'session-mesa5-active-token', true);

-- Pedido en estado "preparing"
INSERT INTO orders (id, restaurant_id, table_id, table_session_id, order_number, status, customer_name, subtotal, total, created_at, confirmed_at, preparing_at) VALUES 
    ('55550001-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', '11110001-0001-0001-0001-000000000005', '44440001-0001-0001-0001-000000000001', 1001, 'preparing', 'Juan Cliente', 18700.00, 18700.00, NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '12 minutes', NOW() - INTERVAL '10 minutes');

-- Items del pedido
INSERT INTO order_items (order_id, dish_id, quantity, unit_price, modifiers, status) VALUES 
    ('55550001-0001-0001-0001-000000000001', '33330001-0001-0001-0001-000000000001', 1, 2500.00, '[]', 'preparing'),
    ('55550001-0001-0001-0001-000000000001', '33330001-0001-0001-0001-000000000010', 2, 8500.00, '[{"name": "Punto de cocción", "value": "A punto"}, {"name": "Guarnición", "value": "Papas fritas"}]', 'preparing'),
    ('55550001-0001-0001-0001-000000000001', '33330001-0001-0001-0001-000000000051', 2, 1500.00, '[]', 'ready');

-- Historial de estados
INSERT INTO order_status_history (order_id, previous_status, new_status, created_at) VALUES 
    ('55550001-0001-0001-0001-000000000001', NULL, 'created', NOW() - INTERVAL '15 minutes'),
    ('55550001-0001-0001-0001-000000000001', 'created', 'confirmed', NOW() - INTERVAL '12 minutes'),
    ('55550001-0001-0001-0001-000000000001', 'confirmed', 'preparing', NOW() - INTERVAL '10 minutes');
