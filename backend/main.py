"""
Sri Mathurshree Agro Kendra - FastAPI Backend
Implements Phase 1 Retail & Inventory ERP REST APIs.
"""

from fastapi import FastAPI, HTTPException, Query, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional
import sqlite3
import datetime
import re
from pathlib import Path
from database import get_db, init_db

app = FastAPI(
    title="Sri Mathurshree Agro Kendra ERP API",
    description="Agricultural Retail & Inventory ERP with 3NF SQLite, FEFO Batch Engine, Chemical Substitute Search, and Farmer Khata",
    version="1.0.0"
)

# Enable CORS for frontend Vite dev server and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Ensure all validation errors return clean, readable HTTP 400 responses.
    """
    error_messages = []
    for err in exc.errors():
        field = " -> ".join(str(loc) for loc in err.get("loc", []))
        msg = err.get("msg", "Invalid value")
        error_messages.append(f"{field}: {msg}")
    return JSONResponse(
        status_code=400,
        content={"detail": "Validation error: " + "; ".join(error_messages)}
    )

@app.on_event("startup")
def startup_event():
    """Ensure database schema is created and seeded on server startup."""
    init_db()

# -----------------------------------------------------------------------------
# Data Models
# -----------------------------------------------------------------------------
ALLOWED_CATEGORIES = ('Seeds', 'NPK_Fertilizer', 'Bio_Fertilizer', 'Pesticide', 'Insecticide')
ALLOWED_GST_SLABS = ('0', '5', '12', '18')
ALLOWED_BASE_UNITS = ('Kg', 'Liter', 'Packet', 'Bottle')
ALLOWED_BULK_UNITS = ('Bag', 'Quintal', 'Box', 'Drum')

class SupplierCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    phone: str = Field(..., min_length=10, max_length=15)
    gstin: str = Field(..., min_length=15, max_length=15)
    city: str = Field(..., min_length=2, max_length=100)

class ProductCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    brand: str = Field(..., min_length=1, max_length=100)
    category: str
    chemical_composition: str = Field(..., min_length=1, max_length=200)
    hsn_code: str
    gst_slab: str
    base_unit: str
    bulk_unit: str
    conversion_factor: float = Field(1.0, gt=0)
    reorder_level: float = Field(10.0, ge=0)

class BatchCreate(BaseModel):
    product_id: int
    batch_number: str = Field(..., min_length=1, max_length=60)
    mfg_date: str
    expiry_date: str
    purchase_price: float = Field(..., gt=0)
    mrp: float = Field(..., gt=0)
    selling_price: float = Field(..., gt=0)
    available_qty: Optional[float] = None
    quantity: Optional[float] = None

class CustomerCreate(BaseModel):
    farmer_name: str = Field(..., min_length=2, max_length=120)
    phone: str = Field(..., min_length=10, max_length=15)
    village: str = Field(..., min_length=2, max_length=100)
    primary_crop: str = Field(..., min_length=2, max_length=100)
    credit_limit: float = Field(25000.0, ge=0)

class RepaymentCreate(BaseModel):
    amount: float = Field(..., gt=0)
    payment_mode: str = Field(..., pattern="^(Cash|UPI|Bank_Transfer)$")
    remarks: Optional[str] = Field(None, max_length=255)

class BatchAllocation(BaseModel):
    batch_id: int
    product_name: str
    batch_number: str
    mfg_date: str
    expiry_date: str
    stock_in_batch: float
    qty_to_deduct_from_batch: float
    selling_price: float
    mrp: float
    gst_rate: float
    cgst_rate: float
    sgst_rate: float
    taxable_amount: float
    cgst_amount: float
    sgst_amount: float
    line_total: float

class FEFOPreviewResponse(BaseModel):
    product_id: int
    product_name: str
    brand: str
    chemical_composition: str
    category: str
    base_unit: str
    requested_qty: float
    allocated_qty: float
    is_partially_fulfilled: bool
    subtotal: float
    total_cgst: float
    total_sgst: float
    grand_total: float
    allocations: List[BatchAllocation]
    substitutes_available: Optional[List[dict]] = None

class InvoiceItemCreate(BaseModel):
    product_id: int
    qty: float

class InvoiceCreate(BaseModel):
    customer_id: int
    payment_mode: str = Field(..., pattern="^(Cash|UPI|Credit_Khata|Partial_Credit)$")
    amount_paid: float
    items: List[InvoiceItemCreate]

# -----------------------------------------------------------------------------
# 1. GET /api/dashboard-summary
# -----------------------------------------------------------------------------
@app.get("/api/dashboard-summary")
def get_dashboard_summary():
    """
    Returns Total Stock Value, count and list of Batches Expiring within 30 Days
    (sorted by expiry_date ASC), Low Stock items, and Total Farmer Khata Pending.
    """
    conn = get_db()
    cursor = conn.cursor()

    # 1. Total Stock Value (Retail and Cost)
    cursor.execute("""
        SELECT 
            ROUND(COALESCE(SUM(available_qty * selling_price), 0), 2) AS total_retail_value,
            ROUND(COALESCE(SUM(available_qty * purchase_price), 0), 2) AS total_cost_value,
            ROUND(COALESCE(SUM(available_qty), 0), 2) AS total_units_in_stock
        FROM inventory_batches
        WHERE available_qty > 0;
    """)
    stock_val = dict(cursor.fetchone())

    # 2. Batches Expiring within 30 Days (sorted by expiry_date ASC)
    cursor.execute("""
        SELECT 
            b.batch_id,
            b.product_id,
            p.name AS product_name,
            p.brand,
            p.category,
            p.base_unit,
            b.batch_number,
            b.mfg_date,
            b.expiry_date,
            b.available_qty,
            b.selling_price,
            b.mrp,
            CAST((julianday(b.expiry_date) - julianday('now')) AS INT) AS days_to_expiry
        FROM inventory_batches b
        JOIN products p ON b.product_id = p.product_id
        WHERE b.available_qty > 0 
          AND b.expiry_date >= date('now')
          AND b.expiry_date <= date('now', '+30 days')
        ORDER BY b.expiry_date ASC;
    """)
    expiring_batches = [dict(row) for row in cursor.fetchall()]

    # 3. Low Stock Items (Total available stock <= reorder_level)
    cursor.execute("""
        SELECT 
            p.product_id,
            p.name,
            p.brand,
            p.category,
            p.base_unit,
            p.reorder_level,
            ROUND(COALESCE(SUM(b.available_qty), 0), 2) AS current_stock
        FROM products p
        LEFT JOIN inventory_batches b ON p.product_id = b.product_id AND b.available_qty > 0
        GROUP BY p.product_id
        HAVING current_stock <= p.reorder_level
        ORDER BY current_stock ASC;
    """)
    low_stock_items = [dict(row) for row in cursor.fetchall()]

    # 4. Total Farmer Khata Pending
    cursor.execute("""
        SELECT 
            ROUND(COALESCE(SUM(total_credit_due), 0), 2) AS total_khata_pending,
            COUNT(customer_id) AS total_farmers_count,
            ROUND(COALESCE(SUM(credit_limit), 0), 2) AS total_credit_limit_extended
        FROM customers_khata;
    """)
    khata_summary = dict(cursor.fetchone())

    # 5. Inventory Breakdown by Category
    cursor.execute("""
        SELECT 
            p.category,
            COUNT(DISTINCT p.product_id) AS products_count,
            ROUND(COALESCE(SUM(b.available_qty * b.selling_price), 0), 2) AS category_value,
            ROUND(COALESCE(SUM(b.available_qty), 0), 2) AS category_qty
        FROM products p
        LEFT JOIN inventory_batches b ON p.product_id = b.product_id AND b.available_qty > 0
        GROUP BY p.category
        ORDER BY category_value DESC;
    """)
    category_breakdown = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return {
        "reference_date": datetime.date.today().isoformat(),
        "total_stock_value": stock_val["total_retail_value"],
        "total_cost_value": stock_val["total_cost_value"],
        "total_units_in_stock": stock_val["total_units_in_stock"],
        "expiring_batches_count": len(expiring_batches),
        "expiring_batches": expiring_batches,
        "low_stock_count": len(low_stock_items),
        "low_stock_items": low_stock_items,
        "total_khata_pending": khata_summary["total_khata_pending"],
        "total_farmers_count": khata_summary["total_farmers_count"],
        "total_credit_limit_extended": khata_summary["total_credit_limit_extended"],
        "category_breakdown": category_breakdown
    }

# -----------------------------------------------------------------------------
# 2. GET /api/inventory
# -----------------------------------------------------------------------------
@app.get("/api/inventory")
def get_inventory():
    """
    Returns all products joined with their active batches sorted by FEFO (expiry_date ASC).
    """
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT 
            p.product_id,
            p.name,
            p.brand,
            p.category,
            p.chemical_composition,
            p.hsn_code,
            p.gst_slab,
            p.base_unit,
            p.bulk_unit,
            p.conversion_factor,
            p.reorder_level
        FROM products p
        ORDER BY p.name ASC;
    """)
    products = [dict(row) for row in cursor.fetchall()]

    cursor.execute("""
        SELECT 
            batch_id,
            product_id,
            batch_number,
            mfg_date,
            expiry_date,
            purchase_price,
            mrp,
            selling_price,
            available_qty,
            CAST((julianday(expiry_date) - julianday('now')) AS INT) AS days_to_expiry,
            CASE 
                WHEN expiry_date < date('now') THEN 1 
                ELSE 0 
            END AS is_expired,
            CASE 
                WHEN expiry_date >= date('now') AND expiry_date <= date('now', '+30 days') THEN 1 
                ELSE 0 
            END AS is_expiring_soon
        FROM inventory_batches
        ORDER BY expiry_date ASC, batch_id ASC;
    """)
    all_batches = [dict(row) for row in cursor.fetchall()]
    conn.close()

    # Group batches under products
    batches_by_product = {}
    for batch in all_batches:
        pid = batch["product_id"]
        if pid not in batches_by_product:
            batches_by_product[pid] = []
        batches_by_product[pid].append(batch)

    for p in products:
        pid = p["product_id"]
        p["batches"] = batches_by_product.get(pid, [])
        p["total_stock"] = round(sum(b["available_qty"] for b in p["batches"]), 2)
        p["active_stock"] = round(sum(b["available_qty"] for b in p["batches"] if not b["is_expired"]), 2)
        p["is_low_stock"] = p["total_stock"] <= p["reorder_level"]
        p["has_expiring_soon"] = any(b["is_expiring_soon"] for b in p["batches"] if b["available_qty"] > 0)

    return products

# -----------------------------------------------------------------------------
# 3. GET /api/products/substitutes?composition=...
# -----------------------------------------------------------------------------
@app.get("/api/products/substitutes")
def get_chemical_substitutes(composition: str = Query(..., description="Active chemical ingredient or NPK formula")):
    """
    Searches products by chemical_composition (e.g., 'Imidacloprid 17.8% SL' or 'NPK 19:19:19')
    and returns matching substitute brands in stock with active batches.
    """
    conn = get_db()
    cursor = conn.cursor()

    search_query = f"%{composition.strip()}%"

    cursor.execute("""
        SELECT 
            p.product_id,
            p.name,
            p.brand,
            p.category,
            p.chemical_composition,
            p.hsn_code,
            p.gst_slab,
            p.base_unit,
            p.reorder_level,
            ROUND(COALESCE(SUM(b.available_qty), 0), 2) AS total_stock,
            MIN(b.selling_price) AS min_selling_price,
            MAX(b.selling_price) AS max_selling_price,
            MIN(b.expiry_date) AS earliest_expiry
        FROM products p
        LEFT JOIN inventory_batches b ON p.product_id = b.product_id 
             AND b.available_qty > 0 
             AND b.expiry_date > date('now')
        WHERE LOWER(p.chemical_composition) LIKE LOWER(?)
        GROUP BY p.product_id
        ORDER BY total_stock DESC, p.brand ASC;
    """, (search_query,))

    matches = [dict(row) for row in cursor.fetchall()]

    # Fetch active batches for each match
    for item in matches:
        cursor.execute("""
            SELECT 
                batch_id,
                batch_number,
                mfg_date,
                expiry_date,
                mrp,
                selling_price,
                available_qty,
                CAST((julianday(expiry_date) - julianday('now')) AS INT) AS days_to_expiry
            FROM inventory_batches
            WHERE product_id = ? AND available_qty > 0 AND expiry_date > date('now')
            ORDER BY expiry_date ASC;
        """, (item["product_id"],))
        item["active_batches"] = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return {
        "searched_composition": composition,
        "match_count": len(matches),
        "results": matches
    }

# -----------------------------------------------------------------------------
# 4. GET /api/fefo-preview?product_id=...&qty=...
# -----------------------------------------------------------------------------
@app.get("/api/fefo-preview", response_model=FEFOPreviewResponse)
def get_fefo_preview(
    product_id: int = Query(..., description="Target Product ID"),
    qty: float = Query(..., gt=0, description="Requested billing quantity")
):
    """
    Implements the exact logic from fefo_allocation_query.sql:
    Splits requested quantity across multiple batches by FEFO (expiry_date ASC, batch_id ASC).
    Calculates tax split (50/50 CGST and SGST) and line item totals.
    """
    conn = get_db()
    cursor = conn.cursor()

    # Fetch product details
    cursor.execute("""
        SELECT product_id, name, brand, category, chemical_composition, hsn_code, gst_slab, base_unit
        FROM products
        WHERE product_id = ?;
    """, (product_id,))
    product = cursor.fetchone()
    if not product:
        conn.close()
        raise HTTPException(status_code=404, detail="Product not found")

    product = dict(product)
    gst_rate = float(product["gst_slab"])
    cgst_rate = round(gst_rate / 2.0, 2)
    sgst_rate = round(gst_rate / 2.0, 2)

    # FEFO Window Function Query from fefo_allocation_query.sql adapted for SQLite
    query = """
    WITH RunningStock AS (
        SELECT 
            b.batch_id,
            b.product_id,
            p.name AS product_name,
            b.batch_number,
            b.mfg_date,
            b.expiry_date,
            b.mrp,
            b.selling_price,
            p.gst_slab,
            b.available_qty,
            SUM(b.available_qty) OVER (
                PARTITION BY b.product_id 
                ORDER BY b.expiry_date ASC, b.batch_id ASC
            ) AS cumulative_qty
        FROM inventory_batches b
        JOIN products p ON b.product_id = p.product_id
        WHERE b.product_id = ?
          AND b.available_qty > 0
          AND b.expiry_date > date('now')
    )
    SELECT 
        batch_id,
        product_name,
        batch_number,
        mfg_date,
        expiry_date,
        mrp,
        available_qty AS stock_in_batch,
        CASE 
            WHEN cumulative_qty <= ? THEN available_qty
            ELSE ? - (cumulative_qty - available_qty)
        END AS qty_to_deduct_from_batch,
        selling_price,
        CAST(gst_slab AS REAL) AS gst_rate
    FROM RunningStock
    WHERE (cumulative_qty - available_qty) < ?
    ORDER BY expiry_date ASC, batch_id ASC;
    """

    cursor.execute(query, (product_id, qty, qty, qty))
    rows = cursor.fetchall()

    allocations: List[BatchAllocation] = []
    total_allocated = 0.0
    subtotal = 0.0
    total_cgst = 0.0
    total_sgst = 0.0

    for r in rows:
        row_dict = dict(r)
        qty_deduct = float(row_dict["qty_to_deduct_from_batch"])
        price = float(row_dict["selling_price"])
        taxable = round(qty_deduct * price, 2)
        cgst = round(taxable * (cgst_rate / 100.0), 2)
        sgst = round(taxable * (sgst_rate / 100.0), 2)
        line_tot = round(taxable + cgst + sgst, 2)

        allocations.append(BatchAllocation(
            batch_id=row_dict["batch_id"],
            product_name=row_dict["product_name"],
            batch_number=row_dict["batch_number"],
            mfg_date=row_dict["mfg_date"],
            expiry_date=row_dict["expiry_date"],
            stock_in_batch=float(row_dict["stock_in_batch"]),
            qty_to_deduct_from_batch=qty_deduct,
            selling_price=price,
            mrp=float(row_dict["mrp"]),
            gst_rate=gst_rate,
            cgst_rate=cgst_rate,
            sgst_rate=sgst_rate,
            taxable_amount=taxable,
            cgst_amount=cgst,
            sgst_amount=sgst,
            line_total=line_tot
        ))

        total_allocated += qty_deduct
        subtotal += taxable
        total_cgst += cgst
        total_sgst += sgst

    is_partial = round(total_allocated, 2) < round(qty, 2)

    # If partial or zero stock, find substitutes
    substitutes = []
    if is_partial:
        cursor.execute("""
            SELECT p.product_id, p.name, p.brand, p.chemical_composition,
                   ROUND(COALESCE(SUM(b.available_qty), 0), 2) AS available_stock,
                   MIN(b.selling_price) AS sample_price
            FROM products p
            JOIN inventory_batches b ON p.product_id = b.product_id
            WHERE p.chemical_composition = ? 
              AND p.product_id != ?
              AND b.available_qty > 0 
              AND b.expiry_date > date('now')
            GROUP BY p.product_id;
        """, (product["chemical_composition"], product_id))
        substitutes = [dict(s) for s in cursor.fetchall()]

    conn.close()

    grand_total = round(subtotal + total_cgst + total_sgst, 2)

    return FEFOPreviewResponse(
        product_id=product["product_id"],
        product_name=product["name"],
        brand=product["brand"],
        chemical_composition=product["chemical_composition"],
        category=product["category"],
        base_unit=product["base_unit"],
        requested_qty=qty,
        allocated_qty=round(total_allocated, 2),
        is_partially_fulfilled=is_partial,
        subtotal=round(subtotal, 2),
        total_cgst=round(total_cgst, 2),
        total_sgst=round(total_sgst, 2),
        grand_total=grand_total,
        allocations=allocations,
        substitutes_available=substitutes if substitutes else None
    )

# -----------------------------------------------------------------------------
# 5. GET /api/customers
# -----------------------------------------------------------------------------
@app.get("/api/customers")
def get_customers():
    """
    Returns the seeded Farmer Khata list with villages, crops, credit limit, and dues.
    """
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT 
            customer_id,
            farmer_name,
            phone,
            village,
            primary_crop,
            ROUND(total_credit_due, 2) AS total_credit_due,
            ROUND(credit_limit, 2) AS credit_limit,
            ROUND(credit_limit - total_credit_due, 2) AS available_credit,
            ROUND((total_credit_due / credit_limit) * 100, 1) AS credit_utilization_pct
        FROM customers_khata
        ORDER BY total_credit_due DESC, farmer_name ASC;
    """)
    farmers = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return farmers

# -----------------------------------------------------------------------------
# 6. POST /api/invoices (ACID POS Transaction)
# -----------------------------------------------------------------------------
@app.post("/api/invoices")
def create_invoice(invoice_data: InvoiceCreate):
    """
    Creates an official GST tax invoice:
    1. Executes FEFO batch deduction per line item
    2. Writes to `invoices` and `invoice_items`
    3. If Credit_Khata or Partial_Credit, increments customer's `total_credit_due`
    All inside a single ACID SQLite transaction.
    """
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("BEGIN TRANSACTION;")

        # Validate customer
        cursor.execute("SELECT customer_id, farmer_name, total_credit_due, credit_limit FROM customers_khata WHERE customer_id = ?", (invoice_data.customer_id,))
        cust = cursor.fetchone()
        if not cust:
            raise HTTPException(status_code=404, detail="Customer not found")

        cust_info = dict(cust)

        total_subtotal = 0.0
        total_cgst = 0.0
        total_sgst = 0.0
        allocated_items = []

        # Process each product with FEFO allocation
        for item in invoice_data.items:
            cursor.execute("SELECT product_id, name, gst_slab FROM products WHERE product_id = ?", (item.product_id,))
            prod = cursor.fetchone()
            if not prod:
                raise HTTPException(status_code=404, detail=f"Product ID {item.product_id} not found")

            gst_rate = float(prod["gst_slab"])
            cgst_rate = round(gst_rate / 2.0, 2)
            sgst_rate = round(gst_rate / 2.0, 2)

            # Query FEFO allocation
            query = """
            WITH RunningStock AS (
                SELECT 
                    b.batch_id,
                    b.product_id,
                    p.name AS product_name,
                    b.batch_number,
                    b.expiry_date,
                    b.selling_price,
                    p.gst_slab,
                    b.available_qty,
                    SUM(b.available_qty) OVER (
                        PARTITION BY b.product_id 
                        ORDER BY b.expiry_date ASC, b.batch_id ASC
                    ) AS cumulative_qty
                FROM inventory_batches b
                JOIN products p ON b.product_id = p.product_id
                WHERE b.product_id = ?
                  AND b.available_qty > 0
                  AND b.expiry_date > date('now')
            )
            SELECT 
                batch_id,
                product_name,
                batch_number,
                expiry_date,
                available_qty AS stock_in_batch,
                CASE 
                    WHEN cumulative_qty <= ? THEN available_qty
                    ELSE ? - (cumulative_qty - available_qty)
                END AS qty_to_deduct_from_batch,
                selling_price,
                CAST(gst_slab AS REAL) AS gst_rate
            FROM RunningStock
            WHERE (cumulative_qty - available_qty) < ?
            ORDER BY expiry_date ASC, batch_id ASC;
            """
            cursor.execute(query, (item.product_id, item.qty, item.qty, item.qty))
            batches = cursor.fetchall()

            allocated_for_product = 0.0
            for b in batches:
                b_dict = dict(b)
                qty_deduct = float(b_dict["qty_to_deduct_from_batch"])
                price = float(b_dict["selling_price"])
                taxable = round(qty_deduct * price, 2)
                cgst = round(taxable * (cgst_rate / 100.0), 2)
                sgst = round(taxable * (sgst_rate / 100.0), 2)
                line_tot = round(taxable + cgst + sgst, 2)

                # Deduct batch stock
                cursor.execute("""
                    UPDATE inventory_batches 
                    SET available_qty = available_qty - ? 
                    WHERE batch_id = ? AND available_qty >= ?;
                """, (qty_deduct, b_dict["batch_id"], qty_deduct))

                if cursor.rowcount == 0:
                    raise HTTPException(status_code=400, detail=f"Insufficient stock in batch {b_dict['batch_number']}")

                allocated_items.append({
                    "product_id": item.product_id,
                    "product_name": b_dict["product_name"],
                    "batch_id": b_dict["batch_id"],
                    "batch_number": b_dict["batch_number"],
                    "expiry_date": b_dict["expiry_date"],
                    "qty_billed": qty_deduct,
                    "unit_price": price,
                    "gst_rate": gst_rate,
                    "cgst_amount": cgst,
                    "sgst_amount": sgst,
                    "line_total": line_tot
                })

                allocated_for_product += qty_deduct
                total_subtotal += taxable
                total_cgst += cgst
                total_sgst += sgst

            if allocated_for_product < item.qty:
                raise HTTPException(status_code=400, detail=f"Insufficient unexpired stock for {prod['name']}. Available: {allocated_for_product}, Requested: {item.qty}")

        grand_total = round(total_subtotal + total_cgst + total_sgst, 2)

        # Calculate balance added to khata
        if invoice_data.payment_mode in ("Cash", "UPI"):
            amount_paid = grand_total
            balance_khata = 0.0
        elif invoice_data.payment_mode == "Credit_Khata":
            amount_paid = 0.0
            balance_khata = grand_total
        else:  # Partial_Credit
            amount_paid = round(min(invoice_data.amount_paid, grand_total), 2)
            balance_khata = round(grand_total - amount_paid, 2)

        # Check credit limit if adding balance to khata
        if balance_khata > 0:
            new_due = cust_info["total_credit_due"] + balance_khata
            if new_due > cust_info["credit_limit"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Credit limit exceeded! Current due: ₹{cust_info['total_credit_due']}, New due: ₹{new_due}, Limit: ₹{cust_info['credit_limit']}"
                )
            cursor.execute("""
                UPDATE customers_khata 
                SET total_credit_due = total_credit_due + ? 
                WHERE customer_id = ?;
            """, (balance_khata, invoice_data.customer_id))

        # Generate invoice number
        cursor.execute("SELECT COUNT(*) FROM invoices;")
        next_num = cursor.fetchone()[0] + 1
        invoice_number = f"SMAK-2026-{next_num:04d}"

        # Insert invoice header
        cursor.execute("""
            INSERT INTO invoices 
            (invoice_number, customer_id, invoice_date, subtotal, total_cgst, total_sgst, grand_total, payment_mode, amount_paid, balance_added_to_khata)
            VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?);
        """, (
            invoice_number,
            invoice_data.customer_id,
            total_subtotal,
            total_cgst,
            total_sgst,
            grand_total,
            invoice_data.payment_mode,
            amount_paid,
            balance_khata
        ))
        invoice_id = cursor.lastrowid

        # Insert invoice items
        for item in allocated_items:
            cursor.execute("""
                INSERT INTO invoice_items 
                (invoice_id, product_id, batch_id, qty_billed, unit_price, gst_rate, cgst_amount, sgst_amount, line_total)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                invoice_id,
                item["product_id"],
                item["batch_id"],
                item["qty_billed"],
                item["unit_price"],
                item["gst_rate"],
                item["cgst_amount"],
                item["sgst_amount"],
                item["line_total"]
            ))

        conn.commit()

        return {
            "success": True,
            "invoice_id": invoice_id,
            "invoice_number": invoice_number,
            "farmer_name": cust_info["farmer_name"],
            "subtotal": total_subtotal,
            "total_cgst": total_cgst,
            "total_sgst": total_sgst,
            "grand_total": grand_total,
            "payment_mode": invoice_data.payment_mode,
            "amount_paid": amount_paid,
            "balance_added_to_khata": balance_khata,
            "items": allocated_items
        }

    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# -----------------------------------------------------------------------------
# 7. GET /api/invoices
# -----------------------------------------------------------------------------
@app.get("/api/invoices")
def list_invoices():
    """Returns recent invoices with customer information and items."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT 
            i.invoice_id,
            i.invoice_number,
            i.invoice_date,
            i.subtotal,
            i.total_cgst,
            i.total_sgst,
            i.grand_total,
            i.payment_mode,
            i.amount_paid,
            i.balance_added_to_khata,
            c.farmer_name,
            c.village,
            c.phone
        FROM invoices i
        JOIN customers_khata c ON i.customer_id = c.customer_id
        ORDER BY i.invoice_id DESC;
    """)
    invoices = [dict(row) for row in cursor.fetchall()]

    for inv in invoices:
        cursor.execute("""
            SELECT 
                ii.item_id,
                p.name AS product_name,
                b.batch_number,
                ii.qty_billed,
                ii.unit_price,
                ii.gst_rate,
                ii.cgst_amount,
                ii.sgst_amount,
                ii.line_total
            FROM invoice_items ii
            JOIN products p ON ii.product_id = p.product_id
            JOIN inventory_batches b ON ii.batch_id = b.batch_id
            WHERE ii.invoice_id = ?;
        """, (inv["invoice_id"],))
        inv["items"] = [dict(row) for row in cursor.fetchall()]

    conn.close()
    return invoices

# -----------------------------------------------------------------------------
# Phase 2 Step 1: Stock Inward & Supplier Management Endpoints
# -----------------------------------------------------------------------------

# 8. GET /api/suppliers & POST /api/suppliers
@app.get("/api/suppliers")
def get_suppliers():
    """Returns list of registered agro distributors/suppliers."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT supplier_id, name, phone, gstin, city, created_at
        FROM suppliers
        ORDER BY name ASC;
    """)
    suppliers = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return suppliers

@app.post("/api/suppliers", status_code=201)
def create_supplier(supplier_data: SupplierCreate):
    """Registers a new agro supplier/distributor with unique phone and GSTIN."""
    name = supplier_data.name.strip()
    phone = supplier_data.phone.strip()
    gstin = supplier_data.gstin.strip().upper()
    city = supplier_data.city.strip()

    if not name:
        raise HTTPException(status_code=400, detail="Supplier name cannot be empty")

    if not re.match(r"^\+?[0-9]{10,15}$", phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format. Must be 10-15 digits.")

    if not re.match(r"^[0-9A-Z]{15}$", gstin):
        raise HTTPException(status_code=400, detail="Invalid GSTIN format. Must be a 15-character alphanumeric GSTIN.")

    if not city:
        raise HTTPException(status_code=400, detail="City cannot be empty")

    conn = get_db()
    cursor = conn.cursor()
    try:
        # Check duplicate phone
        cursor.execute("SELECT supplier_id FROM suppliers WHERE phone = ?", (phone,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail=f"Supplier with phone '{phone}' already exists")

        # Check duplicate GSTIN
        cursor.execute("SELECT supplier_id FROM suppliers WHERE gstin = ?", (gstin,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail=f"Supplier with GSTIN '{gstin}' already exists")

        cursor.execute("""
            INSERT INTO suppliers (name, phone, gstin, city)
            VALUES (?, ?, ?, ?);
        """, (name, phone, gstin, city))
        supplier_id = cursor.lastrowid
        conn.commit()

        cursor.execute("SELECT supplier_id, name, phone, gstin, city, created_at FROM suppliers WHERE supplier_id = ?", (supplier_id,))
        new_supplier = dict(cursor.fetchone())
        return new_supplier
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

# -----------------------------------------------------------------------------
# Phase 2 Step 2: Farmer Onboarding & Khata Repayments
# -----------------------------------------------------------------------------

# 11. POST /api/customers
@app.post("/api/customers", status_code=201)
def create_customer(customer_data: CustomerCreate):
    """
    Registers a new farmer in customers_khata.
    Enforces unique phone number and non-negative credit limit.
    Returns clean 400 error if phone already exists.
    """
    farmer_name = customer_data.farmer_name.strip()
    phone = customer_data.phone.strip()
    village = customer_data.village.strip()
    primary_crop = customer_data.primary_crop.strip()
    credit_limit = float(customer_data.credit_limit)

    if not farmer_name:
        raise HTTPException(status_code=400, detail="Farmer name cannot be empty")

    if not re.match(r"^\+?[0-9]{10,15}$", phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format. Must be 10-15 digits.")

    if not village:
        raise HTTPException(status_code=400, detail="Village cannot be empty")

    if not primary_crop:
        raise HTTPException(status_code=400, detail="Primary crop cannot be empty")

    if credit_limit < 0:
        raise HTTPException(status_code=400, detail="Credit limit must be greater than or equal to 0")

    conn = get_db()
    cursor = conn.cursor()
    try:
        # Check duplicate phone
        cursor.execute("SELECT customer_id FROM customers_khata WHERE phone = ?;", (phone,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail=f"Farmer with phone number '{phone}' already exists")

        cursor.execute("""
            INSERT INTO customers_khata 
            (farmer_name, phone, village, primary_crop, total_credit_due, credit_limit)
            VALUES (?, ?, ?, ?, 0.00, ?);
        """, (farmer_name, phone, village, primary_crop, round(credit_limit, 2)))
        customer_id = cursor.lastrowid
        conn.commit()

        cursor.execute("""
            SELECT customer_id, farmer_name, phone, village, primary_crop, total_credit_due, credit_limit, created_at
            FROM customers_khata WHERE customer_id = ?;
        """, (customer_id,))
        new_customer = dict(cursor.fetchone())
        new_customer["available_credit"] = new_customer["credit_limit"]
        new_customer["credit_utilization_pct"] = 0.0
        return new_customer
    except HTTPException:
        conn.rollback()
        raise
    except sqlite3.IntegrityError as ie:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Database constraint violation: {str(ie)}")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

# 12. POST /api/customers/{customer_id}/repay
@app.post("/api/customers/{customer_id}/repay", status_code=201)
def record_farmer_repayment(customer_id: int, repayment_data: RepaymentCreate):
    """
    Executes a farmer Khata debt repayment inside an atomic ACID transaction:
    1. Validates customer exists and 0 < amount <= total_credit_due
    2. Inserts repayment record into khata_payments
    3. Deducts repayment amount from customers_khata.total_credit_due
    4. Commits transaction and returns receipt details with updated balance
    """
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("BEGIN TRANSACTION;")

        cursor.execute("""
            SELECT customer_id, farmer_name, phone, village, primary_crop, total_credit_due, credit_limit
            FROM customers_khata
            WHERE customer_id = ?;
        """, (customer_id,))
        cust = cursor.fetchone()
        if not cust:
            raise HTTPException(status_code=404, detail=f"Farmer with customer ID {customer_id} not found")

        cust_info = dict(cust)
        current_due = float(cust_info["total_credit_due"])
        amount = float(repayment_data.amount)

        if amount <= 0:
            raise HTTPException(status_code=400, detail="Repayment amount must be greater than 0")

        if amount > current_due:
            raise HTTPException(
                status_code=400, 
                detail=f"Repayment amount (₹{amount:.2f}) cannot exceed current outstanding due (₹{current_due:.2f})"
            )

        if repayment_data.payment_mode not in ('Cash', 'UPI', 'Bank_Transfer'):
            raise HTTPException(
                status_code=400, 
                detail="Invalid payment mode. Allowed modes: Cash, UPI, Bank_Transfer"
            )

        remarks = repayment_data.remarks.strip() if repayment_data.remarks else None

        # Insert repayment record
        cursor.execute("""
            INSERT INTO khata_payments (customer_id, amount, payment_mode, payment_date, remarks)
            VALUES (?, ?, ?, datetime('now'), ?);
        """, (customer_id, round(amount, 2), repayment_data.payment_mode, remarks))
        payment_id = cursor.lastrowid

        # Deduct amount from customer credit due
        new_due = round(current_due - amount, 2)
        cursor.execute("""
            UPDATE customers_khata
            SET total_credit_due = ?
            WHERE customer_id = ?;
        """, (new_due, customer_id))

        cursor.execute("""
            SELECT payment_date FROM khata_payments WHERE payment_id = ?;
        """, (payment_id,))
        payment_date = cursor.fetchone()[0]

        conn.commit()

        return {
            "success": True,
            "payment_id": payment_id,
            "receipt_number": f"REC-KHA-{payment_id:04d}",
            "customer_id": customer_id,
            "farmer_name": cust_info["farmer_name"],
            "phone": cust_info["phone"],
            "village": cust_info["village"],
            "amount_paid": amount,
            "payment_mode": repayment_data.payment_mode,
            "payment_date": payment_date,
            "remarks": remarks,
            "previous_due": current_due,
            "updated_credit_due": new_due,
            "credit_limit": cust_info["credit_limit"],
            "available_credit": round(cust_info["credit_limit"] - new_due, 2)
        }
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# 13. GET /api/customers/{customer_id}/ledger
@app.get("/api/customers/{customer_id}/ledger")
def get_customer_ledger(customer_id: int):
    """
    Returns a unified reverse-chronological statement combining that farmer's
    invoices (invoices) and debt repayments (khata_payments).
    """
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT customer_id, farmer_name, phone, village, primary_crop, total_credit_due, credit_limit, created_at
        FROM customers_khata
        WHERE customer_id = ?;
    """, (customer_id,))
    cust = cursor.fetchone()
    if not cust:
        conn.close()
        raise HTTPException(status_code=404, detail="Customer not found")

    cust_dict = dict(cust)

    # Invoices for this customer
    cursor.execute("""
        SELECT 
            invoice_id,
            invoice_number,
            invoice_date,
            subtotal,
            total_cgst,
            total_sgst,
            grand_total,
            payment_mode,
            amount_paid,
            balance_added_to_khata
        FROM invoices
        WHERE customer_id = ?
        ORDER BY invoice_date DESC;
    """, (customer_id,))
    invoices = [dict(row) for row in cursor.fetchall()]

    for inv in invoices:
        cursor.execute("""
            SELECT ii.item_id, p.name AS product_name, b.batch_number, ii.qty_billed, ii.unit_price, ii.line_total
            FROM invoice_items ii
            JOIN products p ON ii.product_id = p.product_id
            JOIN inventory_batches b ON ii.batch_id = b.batch_id
            WHERE ii.invoice_id = ?;
        """, (inv["invoice_id"],))
        inv["items"] = [dict(r) for r in cursor.fetchall()]

    # Repayments for this customer
    cursor.execute("""
        SELECT payment_id, customer_id, amount, payment_mode, payment_date, remarks
        FROM khata_payments
        WHERE customer_id = ?
        ORDER BY payment_date DESC;
    """, (customer_id,))
    payments = [dict(row) for row in cursor.fetchall()]
    conn.close()

    statement = []
    total_credit_incurred = 0.0

    for inv in invoices:
        total_credit_incurred += inv["balance_added_to_khata"]
        statement.append({
            "entry_id": f"INV-{inv['invoice_id']}",
            "type": "INVOICE",
            "date": inv["invoice_date"],
            "reference": inv["invoice_number"],
            "description": f"GST Tax Invoice ({inv['payment_mode'].replace('_', ' ')})",
            "grand_total": inv["grand_total"],
            "amount_paid": inv["amount_paid"],
            "debit": inv["balance_added_to_khata"],
            "credit": 0.0,
            "payment_mode": inv["payment_mode"],
            "items": inv["items"],
            "remarks": f"Added to Khata: ₹{inv['balance_added_to_khata']:.2f}" if inv["balance_added_to_khata"] > 0 else "Fully Paid at Counter"
        })

    total_repaid = 0.0
    for pay in payments:
        total_repaid += pay["amount"]
        statement.append({
            "entry_id": f"PAY-{pay['payment_id']}",
            "type": "REPAYMENT",
            "date": pay["payment_date"],
            "reference": f"REC-KHA-{pay['payment_id']:04d}",
            "description": f"Khata Repayment ({pay['payment_mode'].replace('_', ' ')})" + (f": {pay['remarks']}" if pay["remarks"] else ""),
            "grand_total": pay["amount"],
            "amount_paid": pay["amount"],
            "debit": 0.0,
            "credit": pay["amount"],
            "payment_mode": pay["payment_mode"],
            "items": [],
            "remarks": pay["remarks"] or "Counter debt repayment"
        })

    # Sort reverse-chronologically by date
    statement.sort(key=lambda x: str(x["date"]), reverse=True)

    available_credit = max(0.0, round(cust_dict["credit_limit"] - cust_dict["total_credit_due"], 2))

    return {
        "customer": cust_dict,
        "summary": {
            "total_credit_due": cust_dict["total_credit_due"],
            "credit_limit": cust_dict["credit_limit"],
            "available_credit": available_credit,
            "total_credit_incurred": round(total_credit_incurred, 2),
            "total_repaid": round(total_repaid, 2),
            "invoices_count": len(invoices),
            "payments_count": len(payments)
        },
        "statement": statement
    }

# 9. GET /api/products & POST /api/products
@app.get("/api/products")
def list_products():
    """Returns list of products from the catalog."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            product_id,
            name,
            brand,
            category,
            chemical_composition,
            hsn_code,
            gst_slab,
            base_unit,
            bulk_unit,
            conversion_factor,
            reorder_level,
            created_at
        FROM products
        ORDER BY name ASC;
    """)
    products = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return products

@app.post("/api/products", status_code=201)
def create_product(product_data: ProductCreate):
    """
    Adds a new product to the catalog with category, HSN code, GST slab, and unit validation.
    """
    name = product_data.name.strip()
    brand = product_data.brand.strip()
    category = product_data.category.strip()
    chemical_comp = product_data.chemical_composition.strip()
    hsn_code = product_data.hsn_code.strip()
    gst_slab = str(product_data.gst_slab).strip()
    base_unit = product_data.base_unit.strip()
    bulk_unit = product_data.bulk_unit.strip()
    conversion_factor = float(product_data.conversion_factor)
    reorder_level = float(product_data.reorder_level)

    if not name:
        raise HTTPException(status_code=400, detail="Product name cannot be empty")
    if not brand:
        raise HTTPException(status_code=400, detail="Brand cannot be empty")
    if not chemical_comp:
        raise HTTPException(status_code=400, detail="Chemical composition cannot be empty")

    # Validate category
    if category not in ALLOWED_CATEGORIES:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid category '{category}'. Allowed categories: {', '.join(ALLOWED_CATEGORIES)}"
        )

    # Validate GST slab
    if gst_slab not in ALLOWED_GST_SLABS:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid GST slab '{gst_slab}'. Allowed GST slabs: {', '.join(ALLOWED_GST_SLABS)}"
        )

    # Validate base_unit
    if base_unit not in ALLOWED_BASE_UNITS:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid base unit '{base_unit}'. Allowed base units: {', '.join(ALLOWED_BASE_UNITS)}"
        )

    # Validate bulk_unit
    if bulk_unit not in ALLOWED_BULK_UNITS:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid bulk unit '{bulk_unit}'. Allowed bulk units: {', '.join(ALLOWED_BULK_UNITS)}"
        )

    # Validate HSN code (4 to 15 alphanumeric characters)
    if not re.match(r"^[0-9A-Za-z]{4,15}$", hsn_code):
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid HSN code '{hsn_code}'. Must be 4 to 15 alphanumeric characters"
        )

    if conversion_factor <= 0:
        raise HTTPException(status_code=400, detail="Conversion factor must be greater than 0")

    if reorder_level < 0:
        raise HTTPException(status_code=400, detail="Reorder level must be greater than or equal to 0")

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO products 
            (name, brand, category, chemical_composition, hsn_code, gst_slab, base_unit, bulk_unit, conversion_factor, reorder_level)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (name, brand, category, chemical_comp, hsn_code, gst_slab, base_unit, bulk_unit, conversion_factor, reorder_level))
        product_id = cursor.lastrowid
        conn.commit()

        cursor.execute("""
            SELECT product_id, name, brand, category, chemical_composition, hsn_code, gst_slab, base_unit, bulk_unit, conversion_factor, reorder_level, created_at
            FROM products WHERE product_id = ?;
        """, (product_id,))
        new_prod = dict(cursor.fetchone())
        return new_prod
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

# -----------------------------------------------------------------------------
# Phase 2 Step 2: Farmer Onboarding & Khata Repayments
# -----------------------------------------------------------------------------

# 11. POST /api/customers
@app.post("/api/customers", status_code=201)
def create_customer(customer_data: CustomerCreate):
    """
    Registers a new farmer in customers_khata.
    Enforces unique phone number and non-negative credit limit.
    Returns clean 400 error if phone already exists.
    """
    farmer_name = customer_data.farmer_name.strip()
    phone = customer_data.phone.strip()
    village = customer_data.village.strip()
    primary_crop = customer_data.primary_crop.strip()
    credit_limit = float(customer_data.credit_limit)

    if not farmer_name:
        raise HTTPException(status_code=400, detail="Farmer name cannot be empty")

    if not re.match(r"^\+?[0-9]{10,15}$", phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format. Must be 10-15 digits.")

    if not village:
        raise HTTPException(status_code=400, detail="Village cannot be empty")

    if not primary_crop:
        raise HTTPException(status_code=400, detail="Primary crop cannot be empty")

    if credit_limit < 0:
        raise HTTPException(status_code=400, detail="Credit limit must be greater than or equal to 0")

    conn = get_db()
    cursor = conn.cursor()
    try:
        # Check duplicate phone
        cursor.execute("SELECT customer_id FROM customers_khata WHERE phone = ?;", (phone,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail=f"Farmer with phone number '{phone}' already exists")

        cursor.execute("""
            INSERT INTO customers_khata 
            (farmer_name, phone, village, primary_crop, total_credit_due, credit_limit)
            VALUES (?, ?, ?, ?, 0.00, ?);
        """, (farmer_name, phone, village, primary_crop, round(credit_limit, 2)))
        customer_id = cursor.lastrowid
        conn.commit()

        cursor.execute("""
            SELECT customer_id, farmer_name, phone, village, primary_crop, total_credit_due, credit_limit, created_at
            FROM customers_khata WHERE customer_id = ?;
        """, (customer_id,))
        new_customer = dict(cursor.fetchone())
        new_customer["available_credit"] = new_customer["credit_limit"]
        new_customer["credit_utilization_pct"] = 0.0
        return new_customer
    except HTTPException:
        conn.rollback()
        raise
    except sqlite3.IntegrityError as ie:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Database constraint violation: {str(ie)}")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

# 12. POST /api/customers/{customer_id}/repay
@app.post("/api/customers/{customer_id}/repay", status_code=201)
def record_farmer_repayment(customer_id: int, repayment_data: RepaymentCreate):
    """
    Executes a farmer Khata debt repayment inside an atomic ACID transaction:
    1. Validates customer exists and 0 < amount <= total_credit_due
    2. Inserts repayment record into khata_payments
    3. Deducts repayment amount from customers_khata.total_credit_due
    4. Commits transaction and returns receipt details with updated balance
    """
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("BEGIN TRANSACTION;")

        cursor.execute("""
            SELECT customer_id, farmer_name, phone, village, primary_crop, total_credit_due, credit_limit
            FROM customers_khata
            WHERE customer_id = ?;
        """, (customer_id,))
        cust = cursor.fetchone()
        if not cust:
            raise HTTPException(status_code=404, detail=f"Farmer with customer ID {customer_id} not found")

        cust_info = dict(cust)
        current_due = float(cust_info["total_credit_due"])
        amount = float(repayment_data.amount)

        if amount <= 0:
            raise HTTPException(status_code=400, detail="Repayment amount must be greater than 0")

        if amount > current_due:
            raise HTTPException(
                status_code=400, 
                detail=f"Repayment amount (₹{amount:.2f}) cannot exceed current outstanding due (₹{current_due:.2f})"
            )

        if repayment_data.payment_mode not in ('Cash', 'UPI', 'Bank_Transfer'):
            raise HTTPException(
                status_code=400, 
                detail="Invalid payment mode. Allowed modes: Cash, UPI, Bank_Transfer"
            )

        remarks = repayment_data.remarks.strip() if repayment_data.remarks else None

        # Insert repayment record
        cursor.execute("""
            INSERT INTO khata_payments (customer_id, amount, payment_mode, payment_date, remarks)
            VALUES (?, ?, ?, datetime('now'), ?);
        """, (customer_id, round(amount, 2), repayment_data.payment_mode, remarks))
        payment_id = cursor.lastrowid

        # Deduct amount from customer credit due
        new_due = round(current_due - amount, 2)
        cursor.execute("""
            UPDATE customers_khata
            SET total_credit_due = ?
            WHERE customer_id = ?;
        """, (new_due, customer_id))

        cursor.execute("""
            SELECT payment_date FROM khata_payments WHERE payment_id = ?;
        """, (payment_id,))
        payment_date = cursor.fetchone()[0]

        conn.commit()

        return {
            "success": True,
            "payment_id": payment_id,
            "receipt_number": f"REC-KHA-{payment_id:04d}",
            "customer_id": customer_id,
            "farmer_name": cust_info["farmer_name"],
            "phone": cust_info["phone"],
            "village": cust_info["village"],
            "amount_paid": amount,
            "payment_mode": repayment_data.payment_mode,
            "payment_date": payment_date,
            "remarks": remarks,
            "previous_due": current_due,
            "updated_credit_due": new_due,
            "credit_limit": cust_info["credit_limit"],
            "available_credit": round(cust_info["credit_limit"] - new_due, 2)
        }
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# 13. GET /api/customers/{customer_id}/ledger
@app.get("/api/customers/{customer_id}/ledger")
def get_customer_ledger(customer_id: int):
    """
    Returns a unified reverse-chronological statement combining that farmer's
    invoices (invoices) and debt repayments (khata_payments).
    """
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT customer_id, farmer_name, phone, village, primary_crop, total_credit_due, credit_limit, created_at
        FROM customers_khata
        WHERE customer_id = ?;
    """, (customer_id,))
    cust = cursor.fetchone()
    if not cust:
        conn.close()
        raise HTTPException(status_code=404, detail="Customer not found")

    cust_dict = dict(cust)

    # Invoices for this customer
    cursor.execute("""
        SELECT 
            invoice_id,
            invoice_number,
            invoice_date,
            subtotal,
            total_cgst,
            total_sgst,
            grand_total,
            payment_mode,
            amount_paid,
            balance_added_to_khata
        FROM invoices
        WHERE customer_id = ?
        ORDER BY invoice_date DESC;
    """, (customer_id,))
    invoices = [dict(row) for row in cursor.fetchall()]

    for inv in invoices:
        cursor.execute("""
            SELECT ii.item_id, p.name AS product_name, b.batch_number, ii.qty_billed, ii.unit_price, ii.line_total
            FROM invoice_items ii
            JOIN products p ON ii.product_id = p.product_id
            JOIN inventory_batches b ON ii.batch_id = b.batch_id
            WHERE ii.invoice_id = ?;
        """, (inv["invoice_id"],))
        inv["items"] = [dict(r) for r in cursor.fetchall()]

    # Repayments for this customer
    cursor.execute("""
        SELECT payment_id, customer_id, amount, payment_mode, payment_date, remarks
        FROM khata_payments
        WHERE customer_id = ?
        ORDER BY payment_date DESC;
    """, (customer_id,))
    payments = [dict(row) for row in cursor.fetchall()]
    conn.close()

    statement = []
    total_credit_incurred = 0.0

    for inv in invoices:
        total_credit_incurred += inv["balance_added_to_khata"]
        statement.append({
            "entry_id": f"INV-{inv['invoice_id']}",
            "type": "INVOICE",
            "date": inv["invoice_date"],
            "reference": inv["invoice_number"],
            "description": f"GST Tax Invoice ({inv['payment_mode'].replace('_', ' ')})",
            "grand_total": inv["grand_total"],
            "amount_paid": inv["amount_paid"],
            "debit": inv["balance_added_to_khata"],
            "credit": 0.0,
            "payment_mode": inv["payment_mode"],
            "items": inv["items"],
            "remarks": f"Added to Khata: ₹{inv['balance_added_to_khata']:.2f}" if inv["balance_added_to_khata"] > 0 else "Fully Paid at Counter"
        })

    total_repaid = 0.0
    for pay in payments:
        total_repaid += pay["amount"]
        statement.append({
            "entry_id": f"PAY-{pay['payment_id']}",
            "type": "REPAYMENT",
            "date": pay["payment_date"],
            "reference": f"REC-KHA-{pay['payment_id']:04d}",
            "description": f"Khata Repayment ({pay['payment_mode'].replace('_', ' ')})" + (f": {pay['remarks']}" if pay["remarks"] else ""),
            "grand_total": pay["amount"],
            "amount_paid": pay["amount"],
            "debit": 0.0,
            "credit": pay["amount"],
            "payment_mode": pay["payment_mode"],
            "items": [],
            "remarks": pay["remarks"] or "Counter debt repayment"
        })

    # Sort reverse-chronologically by date
    statement.sort(key=lambda x: str(x["date"]), reverse=True)

    available_credit = max(0.0, round(cust_dict["credit_limit"] - cust_dict["total_credit_due"], 2))

    return {
        "customer": cust_dict,
        "summary": {
            "total_credit_due": cust_dict["total_credit_due"],
            "credit_limit": cust_dict["credit_limit"],
            "available_credit": available_credit,
            "total_credit_incurred": round(total_credit_incurred, 2),
            "total_repaid": round(total_repaid, 2),
            "invoices_count": len(invoices),
            "payments_count": len(payments)
        },
        "statement": statement
    }

# 10. POST /api/batches
@app.post("/api/batches", status_code=201)
def create_batch(batch_data: BatchCreate):
    """
    Adds a new batch to inventory_batches, enforcing:
    1. expiry_date > mfg_date
    2. purchase_price <= selling_price <= mrp
    3. available_qty > 0
    Returns clean 400 errors on constraint violations.
    """
    # 1. Determine and validate available quantity
    qty = batch_data.available_qty if batch_data.available_qty is not None else batch_data.quantity
    if qty is None or qty <= 0:
        raise HTTPException(
            status_code=400, 
            detail="Available quantity must be greater than 0"
        )

    # 2. Validate dates
    try:
        mfg = datetime.date.fromisoformat(batch_data.mfg_date.strip())
        exp = datetime.date.fromisoformat(batch_data.expiry_date.strip())
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(
            status_code=400, 
            detail="Invalid date format. Expected YYYY-MM-DD"
        )

    if exp <= mfg:
        raise HTTPException(
            status_code=400, 
            detail=f"Expiry date ({batch_data.expiry_date}) must be after manufacturing date ({batch_data.mfg_date})"
        )

    # 3. Validate prices (purchase_price <= selling_price <= mrp)
    pp = float(batch_data.purchase_price)
    sp = float(batch_data.selling_price)
    mrp = float(batch_data.mrp)

    if pp <= 0 or sp <= 0 or mrp <= 0:
        raise HTTPException(
            status_code=400, 
            detail="Purchase price, selling price, and MRP must be positive numbers greater than 0"
        )

    if pp > sp:
        raise HTTPException(
            status_code=400, 
            detail=f"Purchase price (₹{pp:.2f}) cannot be greater than selling price (₹{sp:.2f})"
        )

    if sp > mrp:
        raise HTTPException(
            status_code=400, 
            detail=f"Selling price (₹{sp:.2f}) cannot exceed MRP (₹{mrp:.2f})"
        )

    batch_no = batch_data.batch_number.strip()
    if not batch_no:
        raise HTTPException(status_code=400, detail="Batch number cannot be empty")

    conn = get_db()
    cursor = conn.cursor()
    try:
        # Check product existence
        cursor.execute("SELECT product_id, name FROM products WHERE product_id = ?", (batch_data.product_id,))
        prod = cursor.fetchone()
        if not prod:
            raise HTTPException(
                status_code=400, 
                detail=f"Product with ID {batch_data.product_id} does not exist"
            )

        # Check unique constraint (product_id, batch_number)
        cursor.execute(
            "SELECT batch_id FROM inventory_batches WHERE product_id = ? AND batch_number = ?", 
            (batch_data.product_id, batch_no)
        )
        if cursor.fetchone():
            raise HTTPException(
                status_code=400, 
                detail=f"Batch '{batch_no}' already exists for product '{dict(prod)['name']}'"
            )

        cursor.execute("""
            INSERT INTO inventory_batches 
            (product_id, batch_number, mfg_date, expiry_date, purchase_price, mrp, selling_price, available_qty)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            batch_data.product_id,
            batch_no,
            mfg.isoformat(),
            exp.isoformat(),
            round(pp, 2),
            round(mrp, 2),
            round(sp, 2),
            round(qty, 2)
        ))
        batch_id = cursor.lastrowid
        conn.commit()

        cursor.execute("""
            SELECT 
                batch_id,
                product_id,
                batch_number,
                mfg_date,
                expiry_date,
                purchase_price,
                mrp,
                selling_price,
                available_qty,
                CAST((julianday(expiry_date) - julianday('now')) AS INT) AS days_to_expiry,
                CASE 
                    WHEN expiry_date < date('now') THEN 1 
                    ELSE 0 
                END AS is_expired,
                CASE 
                    WHEN expiry_date >= date('now') AND expiry_date <= date('now', '+30 days') THEN 1 
                    ELSE 0 
                END AS is_expiring_soon,
                created_at
            FROM inventory_batches
            WHERE batch_id = ?;
        """, (batch_id,))
        new_batch = dict(cursor.fetchone())
        return new_batch
    except HTTPException:
        conn.rollback()
        raise
    except sqlite3.IntegrityError as ie:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Database constraint violation: {str(ie)}")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()



# -----------------------------------------------------------------------------
# Phase 2 Step 2: Farmer Onboarding & Khata Repayments
# -----------------------------------------------------------------------------

# 11. POST /api/customers
@app.post("/api/customers", status_code=201)
def create_customer(customer_data: CustomerCreate):
    """
    Registers a new farmer in customers_khata.
    Enforces unique phone number and non-negative credit limit.
    Returns clean 400 error if phone already exists.
    """
    farmer_name = customer_data.farmer_name.strip()
    phone = customer_data.phone.strip()
    village = customer_data.village.strip()
    primary_crop = customer_data.primary_crop.strip()
    credit_limit = float(customer_data.credit_limit)

    if not farmer_name:
        raise HTTPException(status_code=400, detail="Farmer name cannot be empty")

    if not re.match(r"^\+?[0-9]{10,15}$", phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format. Must be 10-15 digits.")

    if not village:
        raise HTTPException(status_code=400, detail="Village cannot be empty")

    if not primary_crop:
        raise HTTPException(status_code=400, detail="Primary crop cannot be empty")

    if credit_limit < 0:
        raise HTTPException(status_code=400, detail="Credit limit must be greater than or equal to 0")

    conn = get_db()
    cursor = conn.cursor()
    try:
        # Check duplicate phone
        cursor.execute("SELECT customer_id FROM customers_khata WHERE phone = ?;", (phone,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail=f"Farmer with phone number '{phone}' already exists")

        cursor.execute("""
            INSERT INTO customers_khata 
            (farmer_name, phone, village, primary_crop, total_credit_due, credit_limit)
            VALUES (?, ?, ?, ?, 0.00, ?);
        """, (farmer_name, phone, village, primary_crop, round(credit_limit, 2)))
        customer_id = cursor.lastrowid
        conn.commit()

        cursor.execute("""
            SELECT customer_id, farmer_name, phone, village, primary_crop, total_credit_due, credit_limit, created_at
            FROM customers_khata WHERE customer_id = ?;
        """, (customer_id,))
        new_customer = dict(cursor.fetchone())
        new_customer["available_credit"] = new_customer["credit_limit"]
        new_customer["credit_utilization_pct"] = 0.0
        return new_customer
    except HTTPException:
        conn.rollback()
        raise
    except sqlite3.IntegrityError as ie:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Database constraint violation: {str(ie)}")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

# 12. POST /api/customers/{customer_id}/repay
@app.post("/api/customers/{customer_id}/repay", status_code=201)
def record_farmer_repayment(customer_id: int, repayment_data: RepaymentCreate):
    """
    Executes a farmer Khata debt repayment inside an atomic ACID transaction:
    1. Validates customer exists and 0 < amount <= total_credit_due
    2. Inserts repayment record into khata_payments
    3. Deducts repayment amount from customers_khata.total_credit_due
    4. Commits transaction and returns receipt details with updated balance
    """
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("BEGIN TRANSACTION;")

        cursor.execute("""
            SELECT customer_id, farmer_name, phone, village, primary_crop, total_credit_due, credit_limit
            FROM customers_khata
            WHERE customer_id = ?;
        """, (customer_id,))
        cust = cursor.fetchone()
        if not cust:
            raise HTTPException(status_code=404, detail=f"Farmer with customer ID {customer_id} not found")

        cust_info = dict(cust)
        current_due = float(cust_info["total_credit_due"])
        amount = float(repayment_data.amount)

        if amount <= 0:
            raise HTTPException(status_code=400, detail="Repayment amount must be greater than 0")

        if amount > current_due:
            raise HTTPException(
                status_code=400, 
                detail=f"Repayment amount (₹{amount:.2f}) cannot exceed current outstanding due (₹{current_due:.2f})"
            )

        if repayment_data.payment_mode not in ('Cash', 'UPI', 'Bank_Transfer'):
            raise HTTPException(
                status_code=400, 
                detail="Invalid payment mode. Allowed modes: Cash, UPI, Bank_Transfer"
            )

        remarks = repayment_data.remarks.strip() if repayment_data.remarks else None

        # Insert repayment record
        cursor.execute("""
            INSERT INTO khata_payments (customer_id, amount, payment_mode, payment_date, remarks)
            VALUES (?, ?, ?, datetime('now'), ?);
        """, (customer_id, round(amount, 2), repayment_data.payment_mode, remarks))
        payment_id = cursor.lastrowid

        # Deduct amount from customer credit due
        new_due = round(current_due - amount, 2)
        cursor.execute("""
            UPDATE customers_khata
            SET total_credit_due = ?
            WHERE customer_id = ?;
        """, (new_due, customer_id))

        cursor.execute("""
            SELECT payment_date FROM khata_payments WHERE payment_id = ?;
        """, (payment_id,))
        payment_date = cursor.fetchone()[0]

        conn.commit()

        return {
            "success": True,
            "payment_id": payment_id,
            "receipt_number": f"REC-KHA-{payment_id:04d}",
            "customer_id": customer_id,
            "farmer_name": cust_info["farmer_name"],
            "phone": cust_info["phone"],
            "village": cust_info["village"],
            "amount_paid": amount,
            "payment_mode": repayment_data.payment_mode,
            "payment_date": payment_date,
            "remarks": remarks,
            "previous_due": current_due,
            "updated_credit_due": new_due,
            "credit_limit": cust_info["credit_limit"],
            "available_credit": round(cust_info["credit_limit"] - new_due, 2)
        }
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# 13. GET /api/customers/{customer_id}/ledger
@app.get("/api/customers/{customer_id}/ledger")
def get_customer_ledger(customer_id: int):
    """
    Returns a unified reverse-chronological statement combining that farmer's
    invoices (invoices) and debt repayments (khata_payments).
    """
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT customer_id, farmer_name, phone, village, primary_crop, total_credit_due, credit_limit, created_at
        FROM customers_khata
        WHERE customer_id = ?;
    """, (customer_id,))
    cust = cursor.fetchone()
    if not cust:
        conn.close()
        raise HTTPException(status_code=404, detail="Customer not found")

    cust_dict = dict(cust)

    # Invoices for this customer
    cursor.execute("""
        SELECT 
            invoice_id,
            invoice_number,
            invoice_date,
            subtotal,
            total_cgst,
            total_sgst,
            grand_total,
            payment_mode,
            amount_paid,
            balance_added_to_khata
        FROM invoices
        WHERE customer_id = ?
        ORDER BY invoice_date DESC;
    """, (customer_id,))
    invoices = [dict(row) for row in cursor.fetchall()]

    for inv in invoices:
        cursor.execute("""
            SELECT ii.item_id, p.name AS product_name, b.batch_number, ii.qty_billed, ii.unit_price, ii.line_total
            FROM invoice_items ii
            JOIN products p ON ii.product_id = p.product_id
            JOIN inventory_batches b ON ii.batch_id = b.batch_id
            WHERE ii.invoice_id = ?;
        """, (inv["invoice_id"],))
        inv["items"] = [dict(r) for r in cursor.fetchall()]

    # Repayments for this customer
    cursor.execute("""
        SELECT payment_id, customer_id, amount, payment_mode, payment_date, remarks
        FROM khata_payments
        WHERE customer_id = ?
        ORDER BY payment_date DESC;
    """, (customer_id,))
    payments = [dict(row) for row in cursor.fetchall()]
    conn.close()

    statement = []
    total_credit_incurred = 0.0

    for inv in invoices:
        total_credit_incurred += inv["balance_added_to_khata"]
        statement.append({
            "entry_id": f"INV-{inv['invoice_id']}",
            "type": "INVOICE",
            "date": inv["invoice_date"],
            "reference": inv["invoice_number"],
            "description": f"GST Tax Invoice ({inv['payment_mode'].replace('_', ' ')})",
            "grand_total": inv["grand_total"],
            "amount_paid": inv["amount_paid"],
            "debit": inv["balance_added_to_khata"],
            "credit": 0.0,
            "payment_mode": inv["payment_mode"],
            "items": inv["items"],
            "remarks": f"Added to Khata: ₹{inv['balance_added_to_khata']:.2f}" if inv["balance_added_to_khata"] > 0 else "Fully Paid at Counter"
        })

    total_repaid = 0.0
    for pay in payments:
        total_repaid += pay["amount"]
        statement.append({
            "entry_id": f"PAY-{pay['payment_id']}",
            "type": "REPAYMENT",
            "date": pay["payment_date"],
            "reference": f"REC-KHA-{pay['payment_id']:04d}",
            "description": f"Khata Repayment ({pay['payment_mode'].replace('_', ' ')})" + (f": {pay['remarks']}" if pay["remarks"] else ""),
            "grand_total": pay["amount"],
            "amount_paid": pay["amount"],
            "debit": 0.0,
            "credit": pay["amount"],
            "payment_mode": pay["payment_mode"],
            "items": [],
            "remarks": pay["remarks"] or "Counter debt repayment"
        })

    # Sort reverse-chronologically by date
    statement.sort(key=lambda x: str(x["date"]), reverse=True)

    available_credit = max(0.0, round(cust_dict["credit_limit"] - cust_dict["total_credit_due"], 2))

    return {
        "customer": cust_dict,
        "summary": {
            "total_credit_due": cust_dict["total_credit_due"],
            "credit_limit": cust_dict["credit_limit"],
            "available_credit": available_credit,
            "total_credit_incurred": round(total_credit_incurred, 2),
            "total_repaid": round(total_repaid, 2),
            "invoices_count": len(invoices),
            "payments_count": len(payments)
        },
        "statement": statement
    }

# -----------------------------------------------------------------------------
# Phase 2 Step 2: Farmer Onboarding & Khata Repayments
# -----------------------------------------------------------------------------

# 11. POST /api/customers
@app.post("/api/customers", status_code=201)
def create_customer(customer_data: CustomerCreate):
    """
    Registers a new farmer in customers_khata.
    Enforces unique phone number and non-negative credit limit.
    Returns clean 400 error if phone already exists.
    """
    farmer_name = customer_data.farmer_name.strip()
    phone = customer_data.phone.strip()
    village = customer_data.village.strip()
    primary_crop = customer_data.primary_crop.strip()
    credit_limit = float(customer_data.credit_limit)

    if not farmer_name:
        raise HTTPException(status_code=400, detail="Farmer name cannot be empty")

    if not re.match(r"^\+?[0-9]{10,15}$", phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format. Must be 10-15 digits.")

    if not village:
        raise HTTPException(status_code=400, detail="Village cannot be empty")

    if not primary_crop:
        raise HTTPException(status_code=400, detail="Primary crop cannot be empty")

    if credit_limit < 0:
        raise HTTPException(status_code=400, detail="Credit limit must be greater than or equal to 0")

    conn = get_db()
    cursor = conn.cursor()
    try:
        # Check duplicate phone
        cursor.execute("SELECT customer_id FROM customers_khata WHERE phone = ?;", (phone,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail=f"Farmer with phone number '{phone}' already exists")

        cursor.execute("""
            INSERT INTO customers_khata 
            (farmer_name, phone, village, primary_crop, total_credit_due, credit_limit)
            VALUES (?, ?, ?, ?, 0.00, ?);
        """, (farmer_name, phone, village, primary_crop, round(credit_limit, 2)))
        customer_id = cursor.lastrowid
        conn.commit()

        cursor.execute("""
            SELECT customer_id, farmer_name, phone, village, primary_crop, total_credit_due, credit_limit, created_at
            FROM customers_khata WHERE customer_id = ?;
        """, (customer_id,))
        new_customer = dict(cursor.fetchone())
        new_customer["available_credit"] = new_customer["credit_limit"]
        new_customer["credit_utilization_pct"] = 0.0
        return new_customer
    except HTTPException:
        conn.rollback()
        raise
    except sqlite3.IntegrityError as ie:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Database constraint violation: {str(ie)}")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

# 12. POST /api/customers/{customer_id}/repay
@app.post("/api/customers/{customer_id}/repay", status_code=201)
def record_farmer_repayment(customer_id: int, repayment_data: RepaymentCreate):
    """
    Executes a farmer Khata debt repayment inside an atomic ACID transaction:
    1. Validates customer exists and 0 < amount <= total_credit_due
    2. Inserts repayment record into khata_payments
    3. Deducts repayment amount from customers_khata.total_credit_due
    4. Commits transaction and returns receipt details with updated balance
    """
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("BEGIN TRANSACTION;")

        cursor.execute("""
            SELECT customer_id, farmer_name, phone, village, primary_crop, total_credit_due, credit_limit
            FROM customers_khata
            WHERE customer_id = ?;
        """, (customer_id,))
        cust = cursor.fetchone()
        if not cust:
            raise HTTPException(status_code=404, detail=f"Farmer with customer ID {customer_id} not found")

        cust_info = dict(cust)
        current_due = float(cust_info["total_credit_due"])
        amount = float(repayment_data.amount)

        if amount <= 0:
            raise HTTPException(status_code=400, detail="Repayment amount must be greater than 0")

        if amount > current_due:
            raise HTTPException(
                status_code=400, 
                detail=f"Repayment amount (₹{amount:.2f}) cannot exceed current outstanding due (₹{current_due:.2f})"
            )

        if repayment_data.payment_mode not in ('Cash', 'UPI', 'Bank_Transfer'):
            raise HTTPException(
                status_code=400, 
                detail="Invalid payment mode. Allowed modes: Cash, UPI, Bank_Transfer"
            )

        remarks = repayment_data.remarks.strip() if repayment_data.remarks else None

        # Insert repayment record
        cursor.execute("""
            INSERT INTO khata_payments (customer_id, amount, payment_mode, payment_date, remarks)
            VALUES (?, ?, ?, datetime('now'), ?);
        """, (customer_id, round(amount, 2), repayment_data.payment_mode, remarks))
        payment_id = cursor.lastrowid

        # Deduct amount from customer credit due
        new_due = round(current_due - amount, 2)
        cursor.execute("""
            UPDATE customers_khata
            SET total_credit_due = ?
            WHERE customer_id = ?;
        """, (new_due, customer_id))

        cursor.execute("""
            SELECT payment_date FROM khata_payments WHERE payment_id = ?;
        """, (payment_id,))
        payment_date = cursor.fetchone()[0]

        conn.commit()

        return {
            "success": True,
            "payment_id": payment_id,
            "receipt_number": f"REC-KHA-{payment_id:04d}",
            "customer_id": customer_id,
            "farmer_name": cust_info["farmer_name"],
            "phone": cust_info["phone"],
            "village": cust_info["village"],
            "amount_paid": amount,
            "payment_mode": repayment_data.payment_mode,
            "payment_date": payment_date,
            "remarks": remarks,
            "previous_due": current_due,
            "updated_credit_due": new_due,
            "credit_limit": cust_info["credit_limit"],
            "available_credit": round(cust_info["credit_limit"] - new_due, 2)
        }
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# 13. GET /api/customers/{customer_id}/ledger
@app.get("/api/customers/{customer_id}/ledger")
def get_customer_ledger(customer_id: int):
    """
    Returns a unified reverse-chronological statement combining that farmer's
    invoices (invoices) and debt repayments (khata_payments).
    """
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT customer_id, farmer_name, phone, village, primary_crop, total_credit_due, credit_limit, created_at
        FROM customers_khata
        WHERE customer_id = ?;
    """, (customer_id,))
    cust = cursor.fetchone()
    if not cust:
        conn.close()
        raise HTTPException(status_code=404, detail="Customer not found")

    cust_dict = dict(cust)

    # Invoices for this customer
    cursor.execute("""
        SELECT 
            invoice_id,
            invoice_number,
            invoice_date,
            subtotal,
            total_cgst,
            total_sgst,
            grand_total,
            payment_mode,
            amount_paid,
            balance_added_to_khata
        FROM invoices
        WHERE customer_id = ?
        ORDER BY invoice_date DESC;
    """, (customer_id,))
    invoices = [dict(row) for row in cursor.fetchall()]

    for inv in invoices:
        cursor.execute("""
            SELECT ii.item_id, p.name AS product_name, b.batch_number, ii.qty_billed, ii.unit_price, ii.line_total
            FROM invoice_items ii
            JOIN products p ON ii.product_id = p.product_id
            JOIN inventory_batches b ON ii.batch_id = b.batch_id
            WHERE ii.invoice_id = ?;
        """, (inv["invoice_id"],))
        inv["items"] = [dict(r) for r in cursor.fetchall()]

    # Repayments for this customer
    cursor.execute("""
        SELECT payment_id, customer_id, amount, payment_mode, payment_date, remarks
        FROM khata_payments
        WHERE customer_id = ?
        ORDER BY payment_date DESC;
    """, (customer_id,))
    payments = [dict(row) for row in cursor.fetchall()]
    conn.close()

    statement = []
    total_credit_incurred = 0.0

    for inv in invoices:
        total_credit_incurred += inv["balance_added_to_khata"]
        statement.append({
            "entry_id": f"INV-{inv['invoice_id']}",
            "type": "INVOICE",
            "date": inv["invoice_date"],
            "reference": inv["invoice_number"],
            "description": f"GST Tax Invoice ({inv['payment_mode'].replace('_', ' ')})",
            "grand_total": inv["grand_total"],
            "amount_paid": inv["amount_paid"],
            "debit": inv["balance_added_to_khata"],
            "credit": 0.0,
            "payment_mode": inv["payment_mode"],
            "items": inv["items"],
            "remarks": f"Added to Khata: ₹{inv['balance_added_to_khata']:.2f}" if inv["balance_added_to_khata"] > 0 else "Fully Paid at Counter"
        })

    total_repaid = 0.0
    for pay in payments:
        total_repaid += pay["amount"]
        statement.append({
            "entry_id": f"PAY-{pay['payment_id']}",
            "type": "REPAYMENT",
            "date": pay["payment_date"],
            "reference": f"REC-KHA-{pay['payment_id']:04d}",
            "description": f"Khata Repayment ({pay['payment_mode'].replace('_', ' ')})" + (f": {pay['remarks']}" if pay["remarks"] else ""),
            "grand_total": pay["amount"],
            "amount_paid": pay["amount"],
            "debit": 0.0,
            "credit": pay["amount"],
            "payment_mode": pay["payment_mode"],
            "items": [],
            "remarks": pay["remarks"] or "Counter debt repayment"
        })

    # Sort reverse-chronologically by date
    statement.sort(key=lambda x: str(x["date"]), reverse=True)

    available_credit = max(0.0, round(cust_dict["credit_limit"] - cust_dict["total_credit_due"], 2))

    return {
        "customer": cust_dict,
        "summary": {
            "total_credit_due": cust_dict["total_credit_due"],
            "credit_limit": cust_dict["credit_limit"],
            "available_credit": available_credit,
            "total_credit_incurred": round(total_credit_incurred, 2),
            "total_repaid": round(total_repaid, 2),
            "invoices_count": len(invoices),
            "payments_count": len(payments)
        },
        "statement": statement
    }
