-- ============================================================================
-- SRI MATHURSHREE AGRO KENDRA - RETAIL & INVENTORY ERP
-- Database Architecture: 3NF Relational Schema (MySQL 8.0+)
-- ============================================================================

DROP DATABASE IF EXISTS mathurshree_agro_erp;
CREATE DATABASE mathurshree_agro_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mathurshree_agro_erp;

-- ----------------------------------------------------------------------------
-- 1. PRODUCTS CATALOG TABLE
-- Stores master product details, chemical composition for substitute lookup,
-- unit conversions, and Indian agro GST slabs.
-- ----------------------------------------------------------------------------
CREATE TABLE products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    category ENUM('Seeds', 'NPK_Fertilizer', 'Bio_Fertilizer', 'Pesticide', 'Insecticide') NOT NULL,
    chemical_composition VARCHAR(200) NOT NULL COMMENT 'Active ingredient or NPK ratio (e.g., Imidacloprid 17.8% SL, NPK 19:19:19)',
    hsn_code VARCHAR(15) NOT NULL,
    gst_slab ENUM('0', '5', '12', '18') NOT NULL,
    base_unit ENUM('Kg', 'Liter', 'Packet', 'Bottle') NOT NULL COMMENT 'Retail billing unit',
    bulk_unit ENUM('Bag', 'Quintal', 'Box', 'Drum') NOT NULL COMMENT 'Wholesale purchase unit',
    conversion_factor DECIMAL(10, 2) NOT NULL DEFAULT 1.00 COMMENT '1 bulk_unit = X base_units (e.g., 1 Bag = 50 Kg)',
    reorder_level DECIMAL(10, 2) NOT NULL DEFAULT 10.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for fast POS search and chemical substitute lookup
    INDEX idx_product_chemical (chemical_composition),
    INDEX idx_product_category (category),
    INDEX idx_product_name (name)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 2. INVENTORY BATCHES TABLE (FEFO ENGINE CORE)
-- Tracks batch-level stock, manufacturing/expiry dates, and batch pricing.
-- ----------------------------------------------------------------------------
CREATE TABLE inventory_batches (
    batch_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    batch_number VARCHAR(60) NOT NULL COMMENT 'Manufacturer printed Batch/Lot No.',
    mfg_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    purchase_price DECIMAL(10, 2) NOT NULL COMMENT 'Landing cost per base_unit (excl. tax)',
    mrp DECIMAL(10, 2) NOT NULL COMMENT 'Maximum Retail Price printed on batch',
    selling_price DECIMAL(10, 2) NOT NULL COMMENT 'Store retail price per base_unit (excl. GST)',
    available_qty DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'Current stock in base_unit',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT fk_batch_product FOREIGN KEY (product_id) 
        REFERENCES products(product_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT uq_product_batch UNIQUE (product_id, batch_number),
    CONSTRAINT chk_dates CHECK (expiry_date > mfg_date),
    CONSTRAINT chk_prices CHECK (selling_price <= mrp AND purchase_price <= selling_price),
    CONSTRAINT chk_qty_non_negative CHECK (available_qty >= 0),

    -- Composite index for First-Expired, First-Out (FEFO) query sorting
    INDEX idx_fefo_allocation (product_id, expiry_date ASC, available_qty)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 3. CUSTOMERS KHATA (FARMER CREDIT LEDGER)
-- Tracks farmer profiles, village, primary crops, and seasonal credit balances.
-- ----------------------------------------------------------------------------
CREATE TABLE customers_khata (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    farmer_name VARCHAR(120) NOT NULL,
    phone VARCHAR(15) NOT NULL UNIQUE,
    village VARCHAR(100) NOT NULL,
    primary_crop VARCHAR(100) NOT NULL COMMENT 'e.g., Paddy, Sugarcane, Ragi, Cotton, Maize',
    total_credit_due DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    credit_limit DECIMAL(12, 2) NOT NULL DEFAULT 25000.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_credit_non_negative CHECK (total_credit_due >= 0),
    INDEX idx_customer_village (village),
    INDEX idx_customer_phone (phone)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 4. INVOICES HEADER TABLE
-- Stores GST tax summary, payment modes, and Khata additions.
-- ----------------------------------------------------------------------------
CREATE TABLE invoices (
    invoice_id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(30) NOT NULL UNIQUE COMMENT 'Format: SMAK-2026-XXXX',
    customer_id INT NOT NULL,
    invoice_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_cgst DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_sgst DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    grand_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    payment_mode ENUM('Cash', 'UPI', 'Credit_Khata', 'Partial_Credit') NOT NULL,
    amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    balance_added_to_khata DECIMAL(12, 2) NOT NULL DEFAULT 0.00,

    CONSTRAINT fk_invoice_customer FOREIGN KEY (customer_id) 
        REFERENCES customers_khata(customer_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_payment_balance CHECK (ROUND(amount_paid + balance_added_to_khata, 2) = ROUND(grand_total, 2)),
    INDEX idx_invoice_date (invoice_date)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 5. INVOICE ITEMS TABLE (BATCH-TRACEABLE LINE ITEMS)
-- Mandatory batch_id link for Insecticides Act & Fertilizer Control Order compliance.
-- ----------------------------------------------------------------------------
CREATE TABLE invoice_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    product_id INT NOT NULL,
    batch_id INT NOT NULL COMMENT 'Mandatory link to exact batch sold for legal traceability',
    qty_billed DECIMAL(10, 2) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    gst_rate DECIMAL(5, 2) NOT NULL COMMENT '0.00, 5.00, 12.00, or 18.00',
    cgst_amount DECIMAL(10, 2) NOT NULL,
    sgst_amount DECIMAL(10, 2) NOT NULL,
    line_total DECIMAL(12, 2) NOT NULL,

    CONSTRAINT fk_item_invoice FOREIGN KEY (invoice_id) 
        REFERENCES invoices(invoice_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_item_product FOREIGN KEY (product_id) 
        REFERENCES products(product_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_item_batch FOREIGN KEY (batch_id) 
        REFERENCES inventory_batches(batch_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_qty_positive CHECK (qty_billed > 0)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 6. SUPPLIERS TABLE (DISTRIBUTOR MANAGEMENT & GRN STOCK INWARD)
-- Tracks authorized agro distributors across Karnataka/Mysuru.
-- ----------------------------------------------------------------------------
CREATE TABLE suppliers (
    supplier_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(15) NOT NULL UNIQUE,
    gstin VARCHAR(15) NOT NULL UNIQUE,
    city VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_supplier_name (name),
    INDEX idx_supplier_city (city)
) ENGINE=InnoDB;