-- 跨境发货管理系统数据库设计
-- 支持多用户并发操作、库存锁定机制、权限控制

-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建序列用于任务编号
CREATE SEQUENCE IF NOT EXISTS task_seq START 1;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'sales', 'warehouse')),
    company_name VARCHAR(255),
    currency VARCHAR(10) DEFAULT 'USD',
    language VARCHAR(10) DEFAULT 'en',
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 产品表
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    price DECIMAL(12, 2) NOT NULL,
    cost DECIMAL(12, 2) NOT NULL,
    weight_kg DECIMAL(10, 3),
    dimensions VARCHAR(100),
    image_url VARCHAR(500),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 库存表
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) NOT NULL,
    warehouse_code VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    available_quantity INTEGER GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
    location VARCHAR(100),
    last_stocked TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, warehouse_code)
);

-- 发货任务表
CREATE TABLE IF NOT EXISTS shipment_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_number VARCHAR(100) UNIQUE NOT NULL DEFAULT 'TSK-' || to_char(CURRENT_DATE, 'YYYYMMDD-') || lpad(nextval('task_seq')::text, 6, '0'),
    user_id UUID REFERENCES users(id) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'packed', 'shipped', 'delivered', 'cancelled')),
    shipping_method VARCHAR(100),
    tracking_number VARCHAR(200),
    destination_country VARCHAR(100),
    destination_address TEXT,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    total_weight_kg DECIMAL(10, 3),
    shipping_cost DECIMAL(12, 2),
    insurance_cost DECIMAL(12, 2),
    total_amount DECIMAL(12, 2),
    notes TEXT,
    estimated_delivery DATE,
    actual_delivery DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 发货任务详情表
CREATE TABLE IF NOT EXISTS shipment_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID REFERENCES shipment_tasks(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) NOT NULL,
    inventory_id UUID REFERENCES inventory(id) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12, 2) NOT NULL,
    total_price DECIMAL(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 库存锁定表（防止并发超卖的关键）
CREATE TABLE IF NOT EXISTS inventory_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) NOT NULL,
    inventory_id UUID REFERENCES inventory(id) NOT NULL,
    shipment_id UUID REFERENCES shipment_tasks(id) NOT NULL,
    quantity INTEGER NOT NULL,
    lock_type VARCHAR(50) NOT NULL DEFAULT 'reservation' 
        CHECK (lock_type IN ('reservation', 'deduction')),
    expires_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 minutes'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(inventory_id, shipment_id)
);

-- 库存变更记录
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_id UUID REFERENCES inventory(id) NOT NULL,
    product_id UUID REFERENCES products(id) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL 
        CHECK (transaction_type IN ('stock_in', 'stock_out', 'adjustment', 'reservation', 'release')),
    quantity_change INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 文件存储记录
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    storage_key VARCHAR(500) NOT NULL,
    bucket_name VARCHAR(100) NOT NULL,
    file_type VARCHAR(50) CHECK (file_type IN ('invoice', 'shipping_label', 'product_image', 'other')),
    related_id UUID,
    is_public BOOLEAN DEFAULT false,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 活动日志
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    activity_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 统计缓存表
CREATE TABLE IF NOT EXISTS statistics_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) NOT NULL,
    statistic_type VARCHAR(100) NOT NULL,
    period VARCHAR(20) NOT NULL,
    data JSONB NOT NULL,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(user_id, statistic_type, period)
);

-- 创建索引
DO $$
BEGIN
    -- 用户表索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'idx_users_email') THEN
        CREATE INDEX idx_users_email ON users(email);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'idx_users_role') THEN
        CREATE INDEX idx_users_role ON users(role);
    END IF;
    
    -- 产品表索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'products' AND indexname = 'idx_products_sku') THEN
        CREATE INDEX idx_products_sku ON products(sku);
    END IF;
    
    -- 库存表索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'inventory' AND indexname = 'idx_inventory_product') THEN
        CREATE INDEX idx_inventory_product ON inventory(product_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'inventory' AND indexname = 'idx_inventory_available') THEN
        CREATE INDEX idx_inventory_available ON inventory(available_quantity) WHERE available_quantity > 0;
    END IF;
    
    -- 发货任务索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'shipment_tasks' AND indexname = 'idx_shipment_tasks_user') THEN
        CREATE INDEX idx_shipment_tasks_user ON shipment_tasks(user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'shipment_tasks' AND indexname = 'idx_shipment_tasks_status') THEN
        CREATE INDEX idx_shipment_tasks_status ON shipment_tasks(status);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'shipment_tasks' AND indexname = 'idx_shipment_tasks_created') THEN
        CREATE INDEX idx_shipment_tasks_created ON shipment_tasks(created_at);
    END IF;
    
    -- 库存锁定索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'inventory_locks' AND indexname = 'idx_inventory_locks_expires') THEN
        CREATE INDEX idx_inventory_locks_expires ON inventory_locks(expires_at);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'inventory_locks' AND indexname = 'idx_inventory_locks_shipment') THEN
        CREATE INDEX idx_inventory_locks_shipment ON inventory_locks(shipment_id);
    END IF;
    
    -- 文件索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'files' AND indexname = 'idx_files_user') THEN
        CREATE INDEX idx_files_user ON files(user_id);
    END IF;
    
    -- 活动日志索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'activity_logs' AND indexname = 'idx_activity_logs_user_time') THEN
        CREATE INDEX idx_activity_logs_user_time ON activity_logs(user_id, created_at);
    END IF;
    
    RAISE NOTICE '数据库模式创建完成';
END $$;

-- 创建库存锁定清理函数（定期清理过期锁定）
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS void AS $$
BEGIN
    DELETE FROM inventory_locks 
    WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- 创建库存锁定清理定时任务（如果支持）
-- 注意：在Render的PostgreSQL环境中，可能需要外部调度器来定期调用此函数