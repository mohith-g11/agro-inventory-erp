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

CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    gstin TEXT NOT NULL UNIQUE,
    city TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_supplier_name ON suppliers (name);
CREATE INDEX IF NOT EXISTS idx_supplier_city ON suppliers (city);

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
    billed_by TEXT,
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

CREATE TABLE IF NOT EXISTS khata_payments (
    payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL CHECK(amount > 0),
    payment_mode TEXT NOT NULL CHECK(payment_mode IN ('Cash', 'UPI', 'Bank_Transfer')),
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT,
    recorded_by TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers_khata(customer_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payment_customer ON khata_payments (customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_date ON khata_payments (payment_date);

CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('Admin', 'Staff')),
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

def safe_migrate(conn: sqlite3.Connection):
    """
    Safe schema migrations:
    - Add billed_by column to invoices if not present
    - Add recorded_by column to khata_payments if not present
    """
    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(invoices)")
    invoice_cols = {row[1] for row in cursor.fetchall()}
    if "billed_by" not in invoice_cols:
        cursor.execute("ALTER TABLE invoices ADD COLUMN billed_by TEXT")

    cursor.execute("PRAGMA table_info(khata_payments)")
    payment_cols = {row[1] for row in cursor.fetchall()}
    if "recorded_by" not in payment_cols:
        cursor.execute("ALTER TABLE khata_payments ADD COLUMN recorded_by TEXT")

    conn.commit()


def seed_users(conn: sqlite3.Connection):
    """
    Seeds default users (Admin + Staff) if users table is empty.
    Imports hash_password from auth module to hash passwords.
    """
    from auth import hash_password

    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] > 0:
        return  # Already seeded

    users = [
        ("harish", "Harish Kumar (Proprietor)", "Admin", "admin123"),
        ("ramesh", "Ramesh Gowda (Counter Staff)", "Staff", "staff123"),
    ]
    for username, full_name, role, password in users:
        cursor.execute(
            "INSERT INTO users (username, full_name, password_hash, role) VALUES (?, ?, ?, ?)",
            (username, full_name, hash_password(password), role)
        )
    conn.commit()
    print("Seeded default users: harish (Admin), ramesh (Staff).")


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

def seed_suppliers(conn: sqlite3.Connection):
    """
    Seeds 3 realistic Mysuru/Karnataka agro distributors if suppliers table is empty.
    Ensures safe migration without deleting or re-seeding existing distributor data.
    """
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM suppliers")
    if cursor.fetchone()[0] == 0:
        seed_distributors = [
            ("Sri Chamundeshwari Agro Agencies", "9845123456", "29ABCDE1234F1Z5", "Mysuru"),
            ("Cauvery Krishi Input Distributors", "9448234567", "29FGHIJ5678K1Z3", "Mandya"),
            ("Karnataka Agro Feeds & Seeds Corp", "9900345678", "29KLMNO9012P1Z1", "Mysuru")
        ]
        cursor.executemany(
            "INSERT INTO suppliers (name, phone, gstin, city) VALUES (?, ?, ?, ?)",
            seed_distributors
        )
        conn.commit()
        print("Seeded 3 realistic Mysuru/Karnataka agro distributors into suppliers table.")

def seed_khata_payments(conn: sqlite3.Connection):
    """
    Seeds 2-3 realistic repayment records for existing Mysuru farmers if khata_payments table is empty.
    Ensures safe migration without deleting or modifying existing ledger data.
    """
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM khata_payments")
    if cursor.fetchone()[0] == 0:
        seed_payments = [
            (1, 4000.00, 'UPI', '2026-10-18 11:30:00', 'Post-harvest paddy advance repayment via PhonePe UPI'),
            (2, 2000.00, 'Cash', '2026-10-20 16:45:00', 'Partial cash payment at Kendra counter'),
            (3, 5000.00, 'Bank_Transfer', '2026-10-25 10:15:00', 'NEFT harvest settlement - Cotton crop yield')
        ]
        cursor.executemany(
            "INSERT INTO khata_payments (customer_id, amount, payment_mode, payment_date, remarks) VALUES (?, ?, ?, ?, ?)",
            seed_payments
        )
        conn.commit()
        print("Seeded 3 realistic repayment records for Mysuru farmers into khata_payments.")

def init_db():
    conn = get_db()
    conn.executescript(SQLITE_SCHEMA)
    conn.commit()
    safe_migrate(conn)
    parse_and_seed_data(conn)
    seed_suppliers(conn)
    seed_khata_payments(conn)
    seed_users(conn)
    conn.close()

if __name__ == "__main__":
    init_db()
