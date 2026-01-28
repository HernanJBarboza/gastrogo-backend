-- =====================================================
-- GASTROGO: Sistema de Gestión de Pedidos por QR
-- Esquema de Base de Datos PostgreSQL
-- =====================================================

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLA: Estados de Pedido (Máquina de Estados)
-- Flujo: created -> confirmed -> preparing -> ready -> delivered -> paid
-- =====================================================
CREATE TYPE order_status AS ENUM (
    'created',      -- Cliente creó el pedido
    'confirmed',    -- Mozo/Sistema confirmó el pedido
    'preparing',    -- Cocina está preparando
    'ready',        -- Pedido listo para servir
    'delivered',    -- Entregado al cliente
    'paid',         -- Pagado y cerrado
    'cancelled'     -- Cancelado
);

-- =====================================================
-- TABLA: Roles de Usuario
-- =====================================================
CREATE TYPE user_role AS ENUM (
    'admin',        -- Gestión completa de menú y pantallas
    'staff',        -- Dashboard cocina y mozos
    'customer'      -- Acceso anónimo vía QR
);

-- =====================================================
-- TABLA: Restaurantes
-- =====================================================
CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,  -- para URLs amigables
    description TEXT,
    logo_url VARCHAR(500),
    cover_image_url VARCHAR(500),
    address VARCHAR(500),
    phone VARCHAR(50),
    email VARCHAR(255),
    currency VARCHAR(3) DEFAULT 'USD',
    timezone VARCHAR(50) DEFAULT 'America/Argentina/Buenos_Aires',
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',  -- configuraciones adicionales
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLA: Usuarios
-- =====================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'customer',
    avatar_url VARCHAR(500),
    provider VARCHAR(50),  -- 'google', 'apple', 'email', 'anonymous'
    provider_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLA: Mesas (vinculadas a UUID de QR)
-- =====================================================
CREATE TABLE tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    table_number VARCHAR(20) NOT NULL,
    qr_code UUID UNIQUE DEFAULT uuid_generate_v4(),  -- UUID único para el QR
    capacity INT DEFAULT 4,
    location VARCHAR(100),  -- 'terraza', 'interior', 'vip'
    is_active BOOLEAN DEFAULT true,
    current_session_id UUID,  -- sesión activa de la mesa
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(restaurant_id, table_number)
);

-- =====================================================
-- TABLA: Sesiones de Mesa (para validación de acceso)
-- =====================================================
CREATE TABLE table_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- =====================================================
-- TABLA: Categorías de Platos
-- =====================================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    icon VARCHAR(50),  -- emoji o icono
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(restaurant_id, slug)
);

-- =====================================================
-- TABLA: Platos
-- =====================================================
CREATE TABLE dishes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    compare_price DECIMAL(10, 2),  -- precio anterior (para mostrar descuento)
    image_url VARCHAR(500),
    images JSONB DEFAULT '[]',  -- galería de imágenes
    preparation_time INT DEFAULT 15,  -- minutos estimados
    calories INT,
    allergens JSONB DEFAULT '[]',  -- ['gluten', 'lactose', 'nuts']
    tags JSONB DEFAULT '[]',  -- ['vegetariano', 'picante', 'popular']
    is_featured BOOLEAN DEFAULT false,
    is_available BOOLEAN DEFAULT true,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(restaurant_id, slug)
);

-- =====================================================
-- TABLA: Modificadores/Extras de Platos
-- =====================================================
CREATE TABLE dish_modifiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    options JSONB NOT NULL,  -- [{"name": "Sin cebolla", "price": 0}, {"name": "Extra queso", "price": 2.50}]
    is_required BOOLEAN DEFAULT false,
    max_selections INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLA: Pedidos
-- =====================================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES tables(id),
    table_session_id UUID REFERENCES table_sessions(id),
    order_number SERIAL,  -- número correlativo por restaurante
    status order_status NOT NULL DEFAULT 'created',
    customer_name VARCHAR(100),
    customer_notes TEXT,
    subtotal DECIMAL(10, 2) DEFAULT 0,
    tax DECIMAL(10, 2) DEFAULT 0,
    tip DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) DEFAULT 0,
    payment_method VARCHAR(50),  -- 'cash', 'card', 'transfer'
    payment_status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'paid', 'refunded'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    preparing_at TIMESTAMP WITH TIME ZONE,
    ready_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLA: Items del Pedido
-- =====================================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    dish_id UUID NOT NULL REFERENCES dishes(id),
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    modifiers JSONB DEFAULT '[]',  -- modificadores seleccionados
    notes TEXT,  -- notas especiales del cliente
    status order_status DEFAULT 'created',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLA: Historial de Estados del Pedido
-- =====================================================
CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    previous_status order_status,
    new_status order_status NOT NULL,
    changed_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLA: Notificaciones en Tiempo Real
-- =====================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,  -- 'new_order', 'order_ready', 'call_waiter'
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    target_role user_role,  -- a quién va dirigida
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================
CREATE INDEX idx_tables_restaurant ON tables(restaurant_id);
CREATE INDEX idx_tables_qr_code ON tables(qr_code);
CREATE INDEX idx_categories_restaurant ON categories(restaurant_id);
CREATE INDEX idx_dishes_restaurant ON dishes(restaurant_id);
CREATE INDEX idx_dishes_category ON dishes(category_id);
CREATE INDEX idx_dishes_featured ON dishes(is_featured) WHERE is_featured = true;
CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX idx_orders_table ON orders(table_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_notifications_restaurant ON notifications(restaurant_id);
CREATE INDEX idx_notifications_unread ON notifications(is_read) WHERE is_read = false;
CREATE INDEX idx_users_restaurant ON users(restaurant_id);
CREATE INDEX idx_users_email ON users(email);

-- =====================================================
-- FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON tables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dishes_updated_at BEFORE UPDATE ON dishes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para registrar cambios de estado del pedido
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO order_status_history (order_id, previous_status, new_status)
        VALUES (NEW.id, OLD.status, NEW.status);
        
        -- Actualizar timestamps específicos según el estado
        CASE NEW.status
            WHEN 'confirmed' THEN NEW.confirmed_at = NOW();
            WHEN 'preparing' THEN NEW.preparing_at = NOW();
            WHEN 'ready' THEN NEW.ready_at = NOW();
            WHEN 'delivered' THEN NEW.delivered_at = NOW();
            WHEN 'paid' THEN NEW.paid_at = NOW();
            ELSE NULL;
        END CASE;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER log_order_status BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- Función para calcular totales del pedido
CREATE OR REPLACE FUNCTION calculate_order_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_subtotal DECIMAL(10, 2);
BEGIN
    SELECT COALESCE(SUM(unit_price * quantity), 0) INTO v_subtotal
    FROM order_items WHERE order_id = NEW.order_id;
    
    UPDATE orders SET 
        subtotal = v_subtotal,
        total = v_subtotal + COALESCE(tax, 0) + COALESCE(tip, 0)
    WHERE id = NEW.order_id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calc_order_totals AFTER INSERT OR UPDATE OR DELETE ON order_items
    FOR EACH ROW EXECUTE FUNCTION calculate_order_totals();

-- =====================================================
-- DATOS DE EJEMPLO (SEED)
-- =====================================================

-- Restaurante de prueba
INSERT INTO restaurants (id, name, slug, description, currency) VALUES 
    ('11111111-1111-1111-1111-111111111111', 'GastroGo Demo', 'gastrogo-demo', 'Restaurante de demostración', 'USD');

-- Usuario Admin
INSERT INTO users (restaurant_id, email, password_hash, name, role) VALUES 
    ('11111111-1111-1111-1111-111111111111', 'admin@gastrogo.com', '$2b$10$PLACEHOLDER_HASH', 'Admin GastroGo', 'admin');

-- Mesas
INSERT INTO tables (restaurant_id, table_number, capacity, location) VALUES 
    ('11111111-1111-1111-1111-111111111111', '1', 4, 'interior'),
    ('11111111-1111-1111-1111-111111111111', '2', 4, 'interior'),
    ('11111111-1111-1111-1111-111111111111', '3', 6, 'interior'),
    ('11111111-1111-1111-1111-111111111111', '4', 2, 'terraza'),
    ('11111111-1111-1111-1111-111111111111', '5', 2, 'terraza'),
    ('11111111-1111-1111-1111-111111111111', 'VIP', 8, 'vip');

-- Categorías
INSERT INTO categories (restaurant_id, name, slug, icon, display_order) VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Entrantes', 'entrantes', '🥗', 1),
    ('11111111-1111-1111-1111-111111111111', 'Principales', 'principales', '🍽️', 2),
    ('11111111-1111-1111-1111-111111111111', 'Postres', 'postres', '🍮', 3),
    ('11111111-1111-1111-1111-111111111111', 'Bebidas', 'bebidas', '🍹', 4);
