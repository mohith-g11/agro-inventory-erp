"""
Sri Mathurshree Agro Kendra - Database Initialization and SQLite Engine
Translates schema.sql and seed.sql into a zero-config local SQLite database (agro_erp.db).
"""

import sqlite3
import os
import re
from pathlib import Path

DB_FILE = Path(__file__).parent / "agro_erp.db"
ROOT_DIR = Path(__file__).parent.parent
SCHEMA_FILE = ROOT_DIR / "schema.sql"
SEED_FILE = ROOT_DIR / "seed.sql"

SQLITE_SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
    product_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('Seeds', 'NPK_Fertilizer', 'Bio_Fertilizer', 'Pesticide', 'Insecticide')),
    chemical_composition TEXT NOT NULL,
    hsn_code TEXT NOT NULL,
    gst_slab TEXT NOT NULL CHECK(gst_slab IN ('0', '5', '12', '18')),
    base_unit TEXT NOT NULL CHECK(base_unit IN ('Kg', 'Liter', 'Packet', 'Bottle')),
    bulk_unit TEXT NOT NULL CHECK(bulk_unit IN ('Bag', 'Quintal', 'Box', 'Drum')),
    conversion_factor REAL NOT NULL DEFAULT 1.00,
    reorder_level REAL NOT NULL DEFAULT 10.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_chemical ON products (chemical_composition);
CREATE INDEX IF NOT EXISTS idx_product_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_product_name ON products (name);

CREATE TABLE IF NOT EXISTS inventory_batches (
    batch_id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    batch_number TEXT NOT NULL,
    mfg_date TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    purchase_price REAL NOT NULL,
    mrp REAL NOT NULL,
    selling_price REAL NOT NULL,
    available_qty REAL NOT NULL DEFAULT 0.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE (product_id, batch_number),
    CHECK (expiry_date > mfg_date),
    CHECK (selling_price <= mrp AND purchase_price <= selling_price),
    CHECK (available_qty >= 0)
);

CREATE INDEX IF NOT EXISTS idx_fefo_allocation ON inventory_batches (product_id, expiry_date ASC, available_qty);

CREATE TABLE IF NOT EXISTS customers_khata (
    customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    village TEXT NOT NULL,
    primary_crop TEXT NOT NULL,
    total_credit_due REAL NOT NULL DEFAULT 0.00,
    credit_limit REAL NOT NULL DEFAULT 25000.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (total_credit_due >= 0)
);

CREATE INDEX IF NOT EXISTS idx_customer_village ON customers_khata (village);
CREATE INDEX IF NOT EXISTS idx_customer_phone ON customers_khata (phone);

CREATE TABLE IF NOT EXISTS invoices (
    invoice_id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL,
    invoice_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subtotal REAL NOT NULL DEFAULT 0.00,
    total_cgst REAL NOT NULL DEFAULT 0.00,
    total_sgst REAL NOT NULL DEFAULT 0.00,
    grand_total REAL NOT NULL DEFAULT 0.00,
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('Cash', 'UPI', 'Credit_Khata', 'Partial_Credit')),
    amount_paid REAL NOT NULL DEFAULT 0.00,
    balance_added_to_khata REAL NOT NULL DEFAULT 0.00,
    FOREIGN KEY (customer_id) REFERENCES customers_khata(customer_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invoice_date ON invoices (invoice_date);

CREATE TABLE IF NOT EXISTS invoice_items (
    item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    batch_id INTEGER NOT NULL,
    qty_billed REAL NOT NULL,
    unit_price REAL NOT NULL,
    gst_rate REAL NOT NULL,
    cgst_amount REAL NOT NULL,
    sgst_amount REAL NOT NULL,
    line_total REAL NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (batch_id) REFERENCES inventory_batches(batch_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK (qty_billed > 0)
);
"""

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def parse_and_seed_data(conn: sqlite3.Connection):
    """
    Reads the original seed.sql file from the root directory,
    extracts the INSERT statements, and executes them in SQLite.
    """
    if not SEED_FILE.exists():
        print(f"Warning: {SEED_FILE} not found. Skipping auto-seed.")
        return

    cursor = conn.cursor()
    # Check if data already exists
    cursor.execute("SELECT COUNT(*) FROM products")
    if cursor.fetchone()[0] > 0:
        return  # Already seeded

    print(f"Loading seed data from {SEED_FILE}...")
    with open(SEED_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    # Strip inline and block SQL comments
    clean_sql = re.sub(r"--.*", "", content)
    # Split by semicolon
    raw_statements = [s.strip() for s in clean_sql.split(";") if s.strip()]

    for stmt in raw_statements:
        if stmt.upper().startswith("USE "):
            continue
        if stmt.upper().startswith("INSERT INTO"):
            try:
                conn.execute(stmt)
            except Exception as e:
                print(f"Error executing seed statement: {e}\nStatement: {stmt[:100]}...")
                raise e

    conn.commit()
    print("Database successfully initialized and seeded with 10 products, 11 batches, and 5 farmers!")

def init_db():
    conn = get_db()
    conn.executescript(SQLITE_SCHEMA)
    conn.commit()
    parse_and_seed_data(conn)
    conn.close()

if __name__ == "__main__":
    init_db()
