-- =================================================================
-- 02_seed_tenant_demo.sql — Sample data for the DEMO tenant
-- Run AFTER create_new_tenant.sh tenant_demo is executed.
-- Sets the search path to the demo tenant schema.
-- =================================================================

SET search_path TO tenant_demo;

-- ─── SAMPLE USERS ─────────────────────────────────────────────────────────────
INSERT INTO users (email, full_name, phone, role, is_active) VALUES
('admin@demo.nexus.com',   'Demo Admin',    '+84901000001', 'manager',  true),
('cashier1@demo.nexus.com','Nguyen Van An', '+84901000002', 'cashier',  true),
('cashier2@demo.nexus.com','Tran Thi Binh', '+84901000003', 'cashier',  true),
('staff@demo.nexus.com',   'Le Van Cuong',  '+84901000004', 'employee', true)
ON CONFLICT (email) DO NOTHING;

-- ─── WAREHOUSES ───────────────────────────────────────────────────────────────
INSERT INTO warehouses (name, address, is_default) VALUES
('Kho Tổng - Hà Nội',  '123 Đường ABC, Quận 1, Hà Nội',   true),
('Chi Nhánh TP.HCM',    '456 Đường XYZ, Quận 3, TP.HCM',  false)
ON CONFLICT DO NOTHING;

-- ─── PRODUCT CATEGORIES ───────────────────────────────────────────────────────
INSERT INTO categories (name, slug, sort_order, is_active) VALUES
('Điện thoại',   'dien-thoai',    1, true),
('Laptop',       'laptop',        2, true),
('Phụ kiện',     'phu-kien',      3, true),
('Đồng hồ',      'dong-ho',       4, true)
ON CONFLICT (slug) DO NOTHING;

-- ─── SAMPLE PRODUCTS ──────────────────────────────────────────────────────────
INSERT INTO products (sku, name, description, base_price, unit, barcode, is_active,
    category_id)
SELECT
    p.sku, p.name, p.description, p.base_price, 'pcs', p.barcode, true,
    c.id
FROM (VALUES
    ('IP15-256-BLK', 'iPhone 15 Pro 256GB Black',   'Apple iPhone 15 Pro 256GB Titan Black',  32990000, '8901234567890', 'Điện thoại'),
    ('IP15-512-WHT', 'iPhone 15 Pro 512GB White',   'Apple iPhone 15 Pro 512GB Titan White',  38990000, '8901234567891', 'Điện thoại'),
    ('SS-S24-256',   'Samsung Galaxy S24 Ultra',    'Samsung S24 Ultra 256GB Phantom Black',  26990000, '8901234567892', 'Điện thoại'),
    ('MB-PRO-14',    'MacBook Pro 14" M3',          'Apple MacBook Pro 14" M3 Chip 16GB RAM', 52990000, '8901234567893', 'Laptop'),
    ('LG-GRAM-17',   'LG Gram 17 Ultra',            'LG Gram 17" Intel Evo i7 32GB RAM',      35990000, '8901234567894', 'Laptop'),
    ('AIR-POD-3',    'AirPods Pro 3rd Gen',         'Apple AirPods Pro với ANC và Spatial Audio', 6490000, '8901234567895', 'Phụ kiện'),
    ('SAMSUNG-WAT',  'Samsung Galaxy Watch 6',      'Samsung Galaxy Watch 6 44mm',             7990000, '8901234567896', 'Đồng hồ')
) AS p(sku, name, description, base_price, barcode, cat_name)
JOIN categories c ON c.name = p.cat_name
ON CONFLICT (sku) DO NOTHING;

-- ─── INVENTORY (Link products to warehouses) ──────────────────────────────────
INSERT INTO inventory (product_id, warehouse_id, quantity, reserved_qty, reorder_point)
SELECT
    pr.id,
    w.id,
    CASE WHEN w.is_default THEN 50 ELSE 20 END,
    0,
    5
FROM products pr
CROSS JOIN warehouses w
ON CONFLICT (product_id, warehouse_id) DO NOTHING;
