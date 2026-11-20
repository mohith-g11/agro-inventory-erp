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
    reorder_level INTEGER NOT NULL DEFAULT 15,
    barcode TEXT,
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
    supplier_id INTEGER,
    status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Depleted', 'Expired_Written_Off', 'Quarantined')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE SET NULL,
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
    customer_id INTEGER,
    invoice_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subtotal REAL NOT NULL DEFAULT 0.00,
    total_cgst REAL NOT NULL DEFAULT 0.00,
    total_sgst REAL NOT NULL DEFAULT 0.00,
    grand_total REAL NOT NULL DEFAULT 0.00,
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('Cash', 'UPI', 'Credit_Khata', 'Partial_Credit')),
    amount_paid REAL NOT NULL DEFAULT 0.00,
    balance_added_to_khata REAL NOT NULL DEFAULT 0.00,
    billed_by TEXT,
    status TEXT NOT NULL DEFAULT 'Completed' CHECK(status IN ('Completed', 'Returned', 'Partially_Returned')),
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

CREATE TABLE IF NOT EXISTS stock_adjustments (
    adjustment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    adjustment_type TEXT NOT NULL CHECK(adjustment_type IN ('Expired_WriteOff', 'Damaged', 'Return_To_Supplier', 'Audit_Increase', 'Audit_Decrease')),
    quantity_change INTEGER NOT NULL CHECK(quantity_change != 0),
    cost_impact REAL DEFAULT 0.0,
    reason TEXT NOT NULL,
    performed_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES inventory_batches(batch_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stock_adj_product ON stock_adjustments (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_adj_batch ON stock_adjustments (batch_id);
CREATE INDEX IF NOT EXISTS idx_stock_adj_created ON stock_adjustments (created_at);

CREATE TABLE IF NOT EXISTS sales_returns (
    return_id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_number TEXT UNIQUE NOT NULL,
    invoice_id INTEGER NOT NULL,
    customer_id INTEGER,
    refund_mode TEXT NOT NULL CHECK(refund_mode IN ('Cash', 'UPI', 'Khata_Credit_Adjustment')),
    total_refund_amount REAL NOT NULL CHECK(total_refund_amount > 0),
    reason TEXT NOT NULL,
    processed_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers_khata(customer_id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_return_invoice ON sales_returns (invoice_id);
CREATE INDEX IF NOT EXISTS idx_return_date ON sales_returns (created_at);

CREATE TABLE IF NOT EXISTS sales_return_items (
    return_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id INTEGER NOT NULL,
    invoice_item_id INTEGER NOT NULL,
    batch_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity_returned INTEGER NOT NULL CHECK(quantity_returned > 0),
    restock_batch INTEGER NOT NULL DEFAULT 1 CHECK(restock_batch IN (0, 1)),
    refund_line_total REAL NOT NULL,
    FOREIGN KEY (return_id) REFERENCES sales_returns(return_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (batch_id) REFERENCES inventory_batches(batch_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    summary TEXT NOT NULL,
    performed_by TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action_type);
"""

def safe_migrate(conn: sqlite3.Connection):
    """
    Safe schema migrations across all phases:
    Phase 2:
    - Add billed_by column to invoices if not present
    - Add recorded_by column to khata_payments if not present
    Phase 3:
    - Add barcode, reorder_level columns to products and populate realistic sample SKUs
    - Add supplier_id, status columns to inventory_batches, linking to suppliers
    - Add status column to invoices, make customer_id nullable for walk-in counter sales
    - Create stock_adjustments, sales_returns, sales_return_items, audit_logs tables if missing
    """
    cursor = conn.cursor()

    # 1. Products migrations
    cursor.execute("PRAGMA table_info(products)")
    prod_cols = {row[1]: row for row in cursor.fetchall()}
    if "barcode" not in prod_cols:
        cursor.execute("ALTER TABLE products ADD COLUMN barcode TEXT")
    if "reorder_level" not in prod_cols:
        cursor.execute("ALTER TABLE products ADD COLUMN reorder_level INTEGER DEFAULT 15")

    # Populate realistic barcodes for products where barcode is null or empty
    SAMPLE_BARCODES = {
        1: "SMAK-IFF-1919",
        2: "SMAK-COR-1919",
        3: "SMAK-COR-DAP",
        4: "SMAK-BAY-200",
        5: "SMAK-TAT-200",
        6: "SMAK-SYN-ACT",
        7: "SMAK-FMC-COR",
        8: "SMAK-SYN-AMI",
        9: "SMAK-IFF-SAG",
        10: "SMAK-KAV-COT",
        11: "SMAK-IFF-1026",
        12: "SMAK-MYS-HUM"
    }
    cursor.execute("SELECT product_id FROM products WHERE barcode IS NULL OR barcode = ''")
    for (pid,) in cursor.fetchall():
        sku = SAMPLE_BARCODES.get(pid, f"SMAK-PRD-{pid:03d}")
        cursor.execute("UPDATE products SET barcode = ? WHERE product_id = ?", (sku, pid))

    # Ensure reorder_level has default 15 if null or 0
    cursor.execute("UPDATE products SET reorder_level = 15 WHERE reorder_level IS NULL OR reorder_level <= 0")

    # 2. Inventory batches migrations
    cursor.execute("PRAGMA table_info(inventory_batches)")
    batch_cols = {row[1]: row for row in cursor.fetchall()}
    if "supplier_id" not in batch_cols:
        cursor.execute("ALTER TABLE inventory_batches ADD COLUMN supplier_id INTEGER REFERENCES suppliers(supplier_id)")
    if "status" not in batch_cols:
        cursor.execute("ALTER TABLE inventory_batches ADD COLUMN status TEXT DEFAULT 'Active'")

    # Link unlinked batches to suppliers 1, 2, or 3
    cursor.execute("UPDATE inventory_batches SET supplier_id = (((batch_id - 1) % 3) + 1) WHERE supplier_id IS NULL")
    cursor.execute("UPDATE inventory_batches SET status = 'Active' WHERE status IS NULL")

    # 3. Khata payments migration
    cursor.execute("PRAGMA table_info(khata_payments)")
    payment_cols = {row[1]: row for row in cursor.fetchall()}
    if "recorded_by" not in payment_cols:
        cursor.execute("ALTER TABLE khata_payments ADD COLUMN recorded_by TEXT")

    # 4. Invoices migration
    cursor.execute("PRAGMA table_info(invoices)")
    inv_info = {row[1]: row for row in cursor.fetchall()}
    if "billed_by" not in inv_info:
        cursor.execute("ALTER TABLE invoices ADD COLUMN billed_by TEXT")
    if "status" not in inv_info:
        cursor.execute("ALTER TABLE invoices ADD COLUMN status TEXT DEFAULT 'Completed'")

    # Ensure invoices table allows customer_id to be NULL for walk-in counter billing
    if inv_info.get("customer_id") and inv_info["customer_id"][3] == 1:  # notnull == 1
        conn.execute("PRAGMA foreign_keys = OFF;")
        conn.execute("""
            CREATE TABLE invoices_new (
                invoice_id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_number TEXT NOT NULL UNIQUE,
                customer_id INTEGER,
                invoice_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                subtotal REAL NOT NULL DEFAULT 0.00,
                total_cgst REAL NOT NULL DEFAULT 0.00,
                total_sgst REAL NOT NULL DEFAULT 0.00,
                grand_total REAL NOT NULL DEFAULT 0.00,
                payment_mode TEXT NOT NULL CHECK (payment_mode IN ('Cash', 'UPI', 'Credit_Khata', 'Partial_Credit')),
                amount_paid REAL NOT NULL DEFAULT 0.00,
                balance_added_to_khata REAL NOT NULL DEFAULT 0.00,
                billed_by TEXT,
                status TEXT NOT NULL DEFAULT 'Completed' CHECK(status IN ('Completed', 'Returned', 'Partially_Returned')),
                FOREIGN KEY (customer_id) REFERENCES customers_khata(customer_id) ON DELETE RESTRICT ON UPDATE CASCADE
            );
        """)
        conn.execute("""
            INSERT INTO invoices_new (invoice_id, invoice_number, customer_id, invoice_date, subtotal, total_cgst, total_sgst, grand_total, payment_mode, amount_paid, balance_added_to_khata, billed_by, status)
            SELECT invoice_id, invoice_number, customer_id, invoice_date, subtotal, total_cgst, total_sgst, grand_total, payment_mode, amount_paid, balance_added_to_khata, billed_by, COALESCE(status, 'Completed')
            FROM invoices;
        """)
        conn.execute("DROP TABLE invoices;")
        conn.execute("ALTER TABLE invoices_new RENAME TO invoices;")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_invoice_date ON invoices (invoice_date);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_invoice_status ON invoices (status);")
        conn.execute("PRAGMA foreign_keys = ON;")

    # 5. Create new Phase 3 tables if missing
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS stock_adjustments (
        adjustment_id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        adjustment_type TEXT NOT NULL CHECK(adjustment_type IN ('Expired_WriteOff', 'Damaged', 'Return_To_Supplier', 'Audit_Increase', 'Audit_Decrease')),
        quantity_change INTEGER NOT NULL CHECK(quantity_change != 0),
        cost_impact REAL DEFAULT 0.0,
        reason TEXT NOT NULL,
        performed_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES inventory_batches(batch_id) ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT ON UPDATE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_stock_adj_product ON stock_adjustments (product_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_stock_adj_batch ON stock_adjustments (batch_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_stock_adj_created ON stock_adjustments (created_at);")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sales_returns (
        return_id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_number TEXT UNIQUE NOT NULL,
        invoice_id INTEGER NOT NULL,
        customer_id INTEGER,
        refund_mode TEXT NOT NULL CHECK(refund_mode IN ('Cash', 'UPI', 'Khata_Credit_Adjustment')),
        total_refund_amount REAL NOT NULL CHECK(total_refund_amount > 0),
        reason TEXT NOT NULL,
        processed_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES customers_khata(customer_id) ON DELETE SET NULL ON UPDATE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_return_invoice ON sales_returns (invoice_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_return_date ON sales_returns (created_at);")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sales_return_items (
        return_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id INTEGER NOT NULL,
        invoice_item_id INTEGER NOT NULL,
        batch_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity_returned INTEGER NOT NULL CHECK(quantity_returned > 0),
        restock_batch INTEGER NOT NULL DEFAULT 1 CHECK(restock_batch IN (0, 1)),
        refund_line_total REAL NOT NULL,
        FOREIGN KEY (return_id) REFERENCES sales_returns(return_id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (batch_id) REFERENCES inventory_batches(batch_id) ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT ON UPDATE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        log_id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        summary TEXT NOT NULL,
        performed_by TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action_type);")

    conn.commit()


def log_audit(conn: sqlite3.Connection, action_type: str, entity_type: str, entity_id: str, summary: str, performed_by: str, role: str):
    """Logs an operational action to audit_logs."""
    try:
        conn.execute("""
            INSERT INTO audit_logs (action_type, entity_type, entity_id, summary, performed_by, role)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (action_type, entity_type, str(entity_id) if entity_id is not None else None, summary, performed_by, role))
        conn.commit()
    except Exception as e:
        print(f"Audit log error: {e}")


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
