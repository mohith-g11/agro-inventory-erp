"""
Sri Mathurshree Agro Kendra - FastAPI Backend
Implements Phase 1 Retail & Inventory ERP REST APIs.
"""

from fastapi import FastAPI, HTTPException, Query, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from typing import List, Optional
import sqlite3
import datetime
import re
import csv
import io
from pathlib import Path
from database import get_db, init_db
import database
from auth import get_current_user, require_admin

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
    barcode: Optional[str] = None

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
    supplier_id: Optional[int] = None

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

class LoginRequest(BaseModel):
    username: str
    password: str

class CreditLimitUpdate(BaseModel):
    credit_limit: float = Field(..., ge=0)

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
    customer_id: Optional[int] = None
    payment_mode: str = Field(..., pattern="^(Cash|UPI|Credit_Khata|Partial_Credit)$")
    amount_paid: float = 0.0
    items: List[InvoiceItemCreate]

class StockAdjustmentCreate(BaseModel):
    adjustment_type: str = Field(..., pattern="^(Expired_WriteOff|Damaged|Return_To_Supplier|Audit_Increase|Audit_Decrease)$")
    quantity_change: int
    reason: str = Field(..., min_length=2, max_length=255)

class SalesReturnItemCreate(BaseModel):
    invoice_item_id: int
    quantity_returned: int = Field(..., gt=0)
    restock_batch: bool = True

class SalesReturnCreate(BaseModel):
    refund_mode: str = Field(..., pattern="^(Cash|UPI|Khata_Credit_Adjustment)$")
    reason: str = Field(..., min_length=2, max_length=255)
    items: List[SalesReturnItemCreate]

# -----------------------------------------------------------------------------
# Auth routes: POST /api/auth/login, GET /api/auth/me
# -----------------------------------------------------------------------------

@app.post("/api/auth/login")
def login(login_data: LoginRequest):
    """Authenticate user with username/password, return JWT token."""
    from auth import verify_password, create_token
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT user_id, username, full_name, password_hash, role, is_active FROM users WHERE username = ?",
        (login_data.username,)
    )
    user_row = cursor.fetchone()
    conn.close()

    if not user_row:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    user = dict(user_row)
    if not user["is_active"]:
        raise HTTPException(status_code=401, detail="Account is inactive")

    if not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token_payload = {
        "user_id": user["user_id"],
        "username": user["username"],
        "full_name": user["full_name"],
        "role": user["role"]
    }
    token = create_token(token_payload)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "user_id": user["user_id"],
            "username": user["username"],
            "full_name": user["full_name"],
            "role": user["role"]
        }
    }


@app.get("/api/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    """Return current authenticated user info."""
    return current_user


# -----------------------------------------------------------------------------
# 1. GET /api/dashboard-summary
# -----------------------------------------------------------------------------
@app.get("/api/dashboard-summary")
def get_dashboard_summary(current_user: dict = Depends(get_current_user)):
    """
    Returns Total Stock Value, count and list of Batches Expiring within 30 Days
    (sorted by expiry_date ASC), Low Stock items, and Total Farmer Khata Pending.
    Staff users will have cost-related fields nulled out.
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

    is_staff = current_user.get("role") == "Staff"

    return {
        "reference_date": datetime.date.today().isoformat(),
        "total_stock_value": stock_val["total_retail_value"],
        "total_cost_value": None if is_staff else stock_val["total_cost_value"],
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
def get_inventory(current_user: dict = Depends(get_current_user)):
    """
    Returns all products joined with their active batches sorted by FEFO (expiry_date ASC).
    Staff users will see purchase_price as null.
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
            p.reorder_level,
            p.barcode
        FROM products p
        ORDER BY p.name ASC;
    """)
    products = [dict(row) for row in cursor.fetchall()]

    cursor.execute("""
        SELECT 
            b.batch_id,
            b.product_id,
            b.batch_number,
            b.mfg_date,
            b.expiry_date,
            b.purchase_price,
            b.mrp,
            b.selling_price,
            b.available_qty,
            b.supplier_id,
            COALESCE(s.name, '-') AS supplier_name,
            b.status,
            CAST((julianday(b.expiry_date) - julianday('now')) AS INT) AS days_to_expiry,
            CASE 
                WHEN b.expiry_date < date('now') THEN 1 
                ELSE 0 
            END AS is_expired,
            CASE 
                WHEN b.expiry_date >= date('now') AND b.expiry_date <= date('now', '+30 days') THEN 1 
                ELSE 0 
            END AS is_expiring_soon
        FROM inventory_batches b
        LEFT JOIN suppliers s ON b.supplier_id = s.supplier_id
        ORDER BY b.expiry_date ASC, b.batch_id ASC;
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

    is_staff = current_user.get("role") == "Staff"

    for p in products:
        pid = p["product_id"]
        p["batches"] = batches_by_product.get(pid, [])
        if is_staff:
            for b in p["batches"]:
                b["purchase_price"] = None
        p["total_stock"] = round(sum(b["available_qty"] for b in p["batches"]), 2)
        p["active_stock"] = round(sum(b["available_qty"] for b in p["batches"] if not b["is_expired"]), 2)
        p["is_low_stock"] = p["total_stock"] <= p["reorder_level"]
        p["has_expiring_soon"] = any(b["is_expiring_soon"] for b in p["batches"] if b["available_qty"] > 0)

    return products

# -----------------------------------------------------------------------------
# 3. GET /api/products/substitutes?composition=...
# -----------------------------------------------------------------------------
@app.get("/api/products/substitutes")
def get_chemical_substitutes(composition: str = Query(..., description="Active chemical ingredient or NPK formula"), current_user: dict = Depends(get_current_user)):
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
    qty: float = Query(..., gt=0, description="Requested billing quantity"),
    current_user: dict = Depends(get_current_user)
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
          AND b.status = 'Active'
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
def get_customers(current_user: dict = Depends(get_current_user)):
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
def create_invoice(invoice_data: InvoiceCreate, current_user: dict = Depends(get_current_user)):
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

        # Validate customer or handle walk-in counter sale
        if invoice_data.customer_id is None:
            if invoice_data.payment_mode in ("Credit_Khata", "Partial_Credit"):
                raise HTTPException(
                    status_code=400,
                    detail="Credit Khata or Partial Credit requires a registered farmer. Walk-in sales only allow Cash or UPI."
                )
            cust_info = {"farmer_name": "Walk-in Customer", "total_credit_due": 0.0, "credit_limit": 0.0}
        else:
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
                  AND b.status = 'Active'
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
            (invoice_number, customer_id, invoice_date, subtotal, total_cgst, total_sgst, grand_total, payment_mode, amount_paid, balance_added_to_khata, billed_by, status)
            VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, 'Completed');
        """, (
            invoice_number,
            invoice_data.customer_id,
            total_subtotal,
            total_cgst,
            total_sgst,
            grand_total,
            invoice_data.payment_mode,
            amount_paid,
            balance_khata,
            current_user.get("full_name")
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

        database.log_audit(
            conn,
            "SALE",
            "invoice",
            invoice_number,
            f"Tax Invoice {invoice_number} generated for {cust_info['farmer_name']} - Rs {grand_total:.2f} ({invoice_data.payment_mode})",
            current_user.get("full_name", "Staff"),
            current_user.get("role", "Staff")
        )

        conn.commit()

        return {
            "success": True,
            "invoice_id": invoice_id,
            "invoice_number": invoice_number,
            "customer_id": invoice_data.customer_id,
            "farmer_name": cust_info["farmer_name"],
            "subtotal": total_subtotal,
            "total_cgst": total_cgst,
            "total_sgst": total_sgst,
            "grand_total": grand_total,
            "payment_mode": invoice_data.payment_mode,
            "amount_paid": amount_paid,
            "balance_added_to_khata": balance_khata,
            "billed_by": current_user.get("full_name"),
            "status": "Completed",
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
def list_invoices(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    payment_mode: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 200,
    current_user: dict = Depends(get_current_user)
):
    """Returns recent invoices with customer information and items."""
    conn = get_db()
    cursor = conn.cursor()

    conditions = []
    params = []

    if start_date:
        conditions.append("date(i.invoice_date) >= date(?)")
        params.append(start_date)
    if end_date:
        conditions.append("date(i.invoice_date) <= date(?)")
        params.append(end_date)
    if payment_mode:
        conditions.append("i.payment_mode = ?")
        params.append(payment_mode)
    if status:
        conditions.append("i.status = ?")
        params.append(status)
    if search:
        search_pattern = f"%{search.strip()}%"
        conditions.append("(i.invoice_number LIKE ? OR c.farmer_name LIKE ? OR c.phone LIKE ? OR c.village LIKE ?)")
        params.extend([search_pattern, search_pattern, search_pattern, search_pattern])

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    query = f"""
        SELECT 
            i.invoice_id,
            i.invoice_number,
            i.customer_id,
            i.invoice_date,
            i.subtotal,
            i.total_cgst,
            i.total_sgst,
            i.grand_total,
            i.payment_mode,
            i.amount_paid,
            i.balance_added_to_khata,
            i.billed_by,
            i.status,
            COALESCE(c.farmer_name, 'Walk-in Customer') AS farmer_name,
            c.village,
            c.phone
        FROM invoices i
        LEFT JOIN customers_khata c ON i.customer_id = c.customer_id
        {where_clause}
        ORDER BY i.invoice_id DESC
        LIMIT ?;
    """
    params.append(limit)
    cursor.execute(query, tuple(params))
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
# Phase 2 Step 3: Printable GST Tax Invoice Payload
# -----------------------------------------------------------------------------
STORE_INFO = {
    "name": "Sri Mathurshree Agro Kendra",
    "gstin": "29DMXPK9997J1ZF",
    "fertilizer_license": "MYS/AGR/FERT/2024/7821",
    "insecticide_license": "KA/MYS/INS/2023/4510",
    "address": "Mysuru, Karnataka",
    "state_code": "29"
}

def number_to_indian_rupees(amount: float) -> str:
    """Converts float to Indian Rupees in words format."""
    amount = round(amount, 2)
    int_part = int(amount)
    paise_part = int(round((amount - int_part) * 100))

    if int_part == 0 and paise_part == 0:
        return "Rupees Zero Only"

    units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
             "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
             "Eighteen", "Nineteen"]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def convert_two_digit(n: int) -> str:
        if n < 20:
            return units[n]
        else:
            return tens[n // 10] + (" " + units[n % 10] if n % 10 != 0 else "")

    def convert_three_digit(n: int) -> str:
        h = n // 100
        rem = n % 100
        result = ""
        if h > 0:
            result += units[h] + " Hundred"
            if rem > 0:
                result += " " + convert_two_digit(rem)
        else:
            result += convert_two_digit(rem)
        return result.strip()

    words = []
    crores = int_part // 10000000
    rem = int_part % 10000000
    if crores > 0:
        words.append(convert_three_digit(crores) + " Crore")

    lakhs = rem // 100000
    rem = rem % 100000
    if lakhs > 0:
        words.append(convert_two_digit(lakhs) + " Lakh")

    thousands = rem // 1000
    rem = rem % 1000
    if thousands > 0:
        words.append(convert_two_digit(thousands) + " Thousand")

    if rem > 0:
        words.append(convert_three_digit(rem))

    rupees_str = " ".join(words) if words else "Zero"
    paise_str = f" and {convert_two_digit(paise_part)} Paise" if paise_part > 0 else ""
    return f"Rupees {rupees_str}{paise_str} Only"

@app.get("/api/invoices/{invoice_id}")
def get_invoice_details(invoice_id: int, current_user: dict = Depends(get_current_user)):
    """
    Returns a complete, structured GST invoice payload (returns HTTP 404 if not found).
    """
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT 
            i.invoice_id,
            i.invoice_number,
            i.customer_id,
            i.invoice_date,
            i.subtotal,
            i.total_cgst,
            i.total_sgst,
            i.grand_total,
            i.payment_mode,
            i.amount_paid,
            i.balance_added_to_khata,
            i.billed_by,
            c.farmer_name,
            c.phone,
            c.village,
            c.primary_crop
        FROM invoices i
        LEFT JOIN customers_khata c ON i.customer_id = c.customer_id
        WHERE i.invoice_id = ?;
    """, (invoice_id,))
    inv_row = cursor.fetchone()
    if not inv_row:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Invoice ID {invoice_id} not found")

    inv = dict(inv_row)

    # Fetch items with joined product & batch details
    cursor.execute("""
        SELECT 
            ii.item_id,
            p.name AS product_name,
            p.brand,
            p.hsn_code,
            b.batch_number,
            b.expiry_date,
            ii.qty_billed AS quantity,
            p.base_unit AS unit,
            ii.unit_price,
            ii.gst_rate,
            ROUND(ii.qty_billed * ii.unit_price, 2) AS taxable_value,
            ROUND(ii.gst_rate / 2.0, 2) AS cgst_rate,
            ii.cgst_amount,
            ROUND(ii.gst_rate / 2.0, 2) AS sgst_rate,
            ii.sgst_amount,
            ii.line_total
        FROM invoice_items ii
        JOIN products p ON ii.product_id = p.product_id
        JOIN inventory_batches b ON ii.batch_id = b.batch_id
        WHERE ii.invoice_id = ?
        ORDER BY ii.item_id ASC;
    """, (invoice_id,))
    items = [dict(r) for r in cursor.fetchall()]
    conn.close()

    # Calculate slab-wise GST summary
    gst_map = {}
    for it in items:
        rate = float(it["gst_rate"])
        if rate not in gst_map:
            gst_map[rate] = {
                "gst_rate": rate,
                "taxable_value": 0.0,
                "cgst_amount": 0.0,
                "sgst_amount": 0.0,
                "total_tax": 0.0
            }
        gst_map[rate]["taxable_value"] += it["taxable_value"]
        gst_map[rate]["cgst_amount"] += it["cgst_amount"]
        gst_map[rate]["sgst_amount"] += it["sgst_amount"]
        gst_map[rate]["total_tax"] += round(it["cgst_amount"] + it["sgst_amount"], 2)

    gst_summary = []
    for rate in sorted(gst_map.keys()):
        row = gst_map[rate]
        gst_summary.append({
            "gst_rate": row["gst_rate"],
            "taxable_value": round(row["taxable_value"], 2),
            "cgst_amount": round(row["cgst_amount"], 2),
            "sgst_amount": round(row["sgst_amount"], 2),
            "total_tax": round(row["total_tax"], 2)
        })

    taxable_subtotal = round(sum(it["taxable_value"] for it in items), 2)
    total_cgst = round(sum(it["cgst_amount"] for it in items), 2)
    total_sgst = round(sum(it["sgst_amount"] for it in items), 2)
    total_tax = round(total_cgst + total_sgst, 2)
    grand_total = round(inv["grand_total"], 2)
    amount_in_words = number_to_indian_rupees(grand_total)

    customer_info = {
        "customer_id": inv["customer_id"],
        "farmer_name": inv["farmer_name"] if inv["farmer_name"] else "Walk-in Customer",
        "phone": inv["phone"] if inv["phone"] else "—",
        "village": inv["village"] if inv["village"] else "Mysuru District",
        "primary_crop": inv["primary_crop"] if inv["primary_crop"] else "General Agro"
    }

    return {
        "store": STORE_INFO,
        "invoice": {
            "invoice_id": inv["invoice_id"],
            "invoice_number": inv["invoice_number"],
            "invoice_date": inv["invoice_date"],
            "payment_mode": inv["payment_mode"],
            "paid_amount": inv["amount_paid"],
            "credit_amount": inv["balance_added_to_khata"],
            "amount_paid": inv["amount_paid"],
            "balance_added_to_khata": inv["balance_added_to_khata"],
            "billed_by": inv.get("billed_by"),
            "customer": customer_info
        },
        "items": items,
        "gst_summary": gst_summary,
        "totals": {
            "taxable_subtotal": taxable_subtotal,
            "total_cgst": total_cgst,
            "total_sgst": total_sgst,
            "total_tax": total_tax,
            "grand_total": grand_total,
            "amount_in_words": amount_in_words
        }
    }

# -----------------------------------------------------------------------------
# Phase 2 Step 1: Stock Inward & Supplier Management Endpoints
# -----------------------------------------------------------------------------
# 8. GET /api/suppliers & POST /api/suppliers
@app.get("/api/suppliers")
def get_suppliers(admin_user: dict = Depends(require_admin)):
    """Returns list of registered agro distributors/suppliers (Admin only)."""
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
def create_supplier(supplier_data: SupplierCreate, admin_user: dict = Depends(require_admin)):
    """Registers a new agro supplier/distributor with unique phone and GSTIN (Admin only)."""
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



# 9. GET /api/products & POST /api/products
@app.get("/api/products")
def list_products(
    search: Optional[str] = None,
    category: Optional[str] = None,
    barcode: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Returns list of products from the catalog with optional search, category, or barcode filtering."""
    conn = get_db()
    cursor = conn.cursor()

    conditions = []
    params = []
    if barcode:
        conditions.append("barcode = ?")
        params.append(barcode.strip())
    if category:
        conditions.append("category = ?")
        params.append(category)
    if search:
        search_pattern = f"%{search.strip()}%"
        conditions.append("(barcode = ? OR name LIKE ? OR brand LIKE ? OR chemical_composition LIKE ? OR hsn_code LIKE ?)")
        params.extend([search.strip(), search_pattern, search_pattern, search_pattern, search_pattern])

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    cursor.execute(f"""
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
            barcode,
            created_at
        FROM products
        {where_clause}
        ORDER BY name ASC;
    """, tuple(params))
    products = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return products

@app.post("/api/products", status_code=201)
def create_product(product_data: ProductCreate, admin_user: dict = Depends(require_admin)):
    """
    Adds a new product to the catalog with category, HSN code, GST slab, and unit validation (Admin only).
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
    barcode = product_data.barcode.strip() if product_data.barcode else None

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
            (name, brand, category, chemical_composition, hsn_code, gst_slab, base_unit, bulk_unit, conversion_factor, reorder_level, barcode)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (name, brand, category, chemical_comp, hsn_code, gst_slab, base_unit, bulk_unit, conversion_factor, reorder_level, barcode))
        product_id = cursor.lastrowid
        database.log_audit(
            conn,
            "PRODUCT_CATALOG",
            "product",
            str(product_id),
            f"Added product {name} ({brand}) - Category: {category}",
            admin_user.get("full_name", "Admin"),
            admin_user.get("role", "Admin")
        )
        conn.commit()

        cursor.execute("""
            SELECT product_id, name, brand, category, chemical_composition, hsn_code, gst_slab, base_unit, bulk_unit, conversion_factor, reorder_level, barcode, created_at
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


# 10. POST /api/batches
@app.post("/api/batches", status_code=201)
def create_batch(batch_data: BatchCreate, admin_user: dict = Depends(require_admin)):
    """
    Adds a new batch to inventory_batches (Admin only), enforcing:
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

        supplier_id = batch_data.supplier_id
        if supplier_id is not None:
            cursor.execute("SELECT supplier_id FROM suppliers WHERE supplier_id = ?", (supplier_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=400, detail=f"Supplier ID {supplier_id} not found")

        cursor.execute("""
            INSERT INTO inventory_batches 
            (product_id, batch_number, mfg_date, expiry_date, purchase_price, mrp, selling_price, available_qty, supplier_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active');
        """, (
            batch_data.product_id,
            batch_no,
            mfg.isoformat(),
            exp.isoformat(),
            round(pp, 2),
            round(mrp, 2),
            round(sp, 2),
            round(qty, 2),
            supplier_id
        ))
        batch_id = cursor.lastrowid

        database.log_audit(
            conn,
            "STOCK_INWARD",
            "batch",
            str(batch_id),
            f"Stock Inward GRN: Batch {batch_no} for {dict(prod)['name']} - Qty {qty}",
            admin_user.get("full_name", "Admin"),
            admin_user.get("role", "Admin")
        )

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
                supplier_id,
                status,
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

# 11. POST /api/customers
@app.post("/api/customers", status_code=201)
def create_customer(customer_data: CustomerCreate, current_user: dict = Depends(get_current_user)):
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

# 11b. PATCH /api/customers/{customer_id}/credit-limit (Admin only)
@app.patch("/api/customers/{customer_id}/credit-limit")
def update_farmer_credit_limit(
    customer_id: int, 
    limit_data: CreditLimitUpdate, 
    admin_user: dict = Depends(require_admin)
):
    """
    Updates a farmer's credit limit. Admin only.
    """
    if limit_data.credit_limit < 0:
        raise HTTPException(status_code=400, detail="Credit limit must be greater than or equal to 0")

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT customer_id, farmer_name, total_credit_due FROM customers_khata WHERE customer_id = ?", (customer_id,))
        cust = cursor.fetchone()
        if not cust:
            raise HTTPException(status_code=404, detail=f"Farmer with customer ID {customer_id} not found")

        new_limit = round(float(limit_data.credit_limit), 2)
        cursor.execute("UPDATE customers_khata SET credit_limit = ? WHERE customer_id = ?", (new_limit, customer_id))
        conn.commit()

        cursor.execute("""
            SELECT customer_id, farmer_name, phone, village, primary_crop, total_credit_due, credit_limit, created_at
            FROM customers_khata WHERE customer_id = ?;
        """, (customer_id,))
        updated = dict(cursor.fetchone())
        updated["available_credit"] = max(0.0, round(updated["credit_limit"] - updated["total_credit_due"], 2))
        updated["credit_utilization_pct"] = round((updated["total_credit_due"] / updated["credit_limit"]) * 100, 1) if updated["credit_limit"] > 0 else 0.0
        return updated
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# 12. POST /api/customers/{customer_id}/repay
@app.post("/api/customers/{customer_id}/repay", status_code=201)
def record_farmer_repayment(customer_id: int, repayment_data: RepaymentCreate, current_user: dict = Depends(get_current_user)):
    """
    Executes a farmer Khata debt repayment inside an atomic ACID transaction:
    1. Validates customer exists and 0 < amount <= total_credit_due
    2. Inserts repayment record into khata_payments (with recorded_by)
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
        recorded_by = current_user.get("full_name")

        # Insert repayment record
        cursor.execute("""
            INSERT INTO khata_payments (customer_id, amount, payment_mode, payment_date, remarks, recorded_by)
            VALUES (?, ?, ?, datetime('now'), ?, ?);
        """, (customer_id, round(amount, 2), repayment_data.payment_mode, remarks, recorded_by))
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
            "recorded_by": recorded_by,
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
def get_customer_ledger(customer_id: int, current_user: dict = Depends(get_current_user)):
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
            balance_added_to_khata,
            billed_by
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
        SELECT payment_id, customer_id, amount, payment_mode, payment_date, remarks, recorded_by
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
            "invoice_id": inv["invoice_id"],
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
            "remarks": f"Added to Khata: ₹{inv['balance_added_to_khata']:.2f}" if inv["balance_added_to_khata"] > 0 else "Fully Paid at Counter",
            "billed_by": inv.get("billed_by")
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
            "remarks": pay["remarks"] or "Counter debt repayment",
            "recorded_by": pay.get("recorded_by")
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


# =============================================================================
# Phase 3: Expiry Action Center & Stock Adjustments
# =============================================================================

@app.get("/api/alerts/inventory")
def get_inventory_alerts(current_user: dict = Depends(get_current_user)):
    """
    Returns expired batches, expiring batches (30 and 90 days), low stock products,
    and high credit risk farmers. Masks landing costs for staff users.
    """
    conn = get_db()
    cursor = conn.cursor()
    is_staff = current_user.get("role") == "Staff"

    # 1. Expired batches
    cursor.execute("""
        SELECT b.batch_id, b.product_id, p.name AS product_name, p.brand, p.category,
               b.batch_number, b.mfg_date, b.expiry_date, b.available_qty, p.base_unit,
               b.purchase_price, b.selling_price, b.mrp, b.status,
               COALESCE(s.name, 'Direct Distributor') AS supplier_name, s.phone AS supplier_phone,
               CAST((julianday('now') - julianday(b.expiry_date)) AS INT) AS days_overdue
        FROM inventory_batches b
        JOIN products p ON b.product_id = p.product_id
        LEFT JOIN suppliers s ON b.supplier_id = s.supplier_id
        WHERE b.expiry_date < date('now')
          AND b.available_qty > 0
          AND b.status = 'Active'
        ORDER BY b.expiry_date ASC;
    """)
    expired_batches = [dict(r) for r in cursor.fetchall()]

    # 2. Expiring in 30 days
    cursor.execute("""
        SELECT b.batch_id, b.product_id, p.name AS product_name, p.brand, p.category,
               b.batch_number, b.mfg_date, b.expiry_date, b.available_qty, p.base_unit,
               b.purchase_price, b.selling_price, b.mrp, b.status,
               COALESCE(s.name, 'Direct Distributor') AS supplier_name, s.phone AS supplier_phone,
               CAST((julianday(b.expiry_date) - julianday('now')) AS INT) AS days_to_expiry
        FROM inventory_batches b
        JOIN products p ON b.product_id = p.product_id
        LEFT JOIN suppliers s ON b.supplier_id = s.supplier_id
        WHERE b.expiry_date >= date('now')
          AND b.expiry_date <= date('now', '+30 days')
          AND b.available_qty > 0
          AND b.status = 'Active'
        ORDER BY b.expiry_date ASC;
    """)
    expiring_30_days = [dict(r) for r in cursor.fetchall()]

    # 3. Expiring in 31 to 90 days
    cursor.execute("""
        SELECT b.batch_id, b.product_id, p.name AS product_name, p.brand, p.category,
               b.batch_number, b.mfg_date, b.expiry_date, b.available_qty, p.base_unit,
               b.purchase_price, b.selling_price, b.mrp, b.status,
               COALESCE(s.name, 'Direct Distributor') AS supplier_name, s.phone AS supplier_phone,
               CAST((julianday(b.expiry_date) - julianday('now')) AS INT) AS days_to_expiry
        FROM inventory_batches b
        JOIN products p ON b.product_id = p.product_id
        LEFT JOIN suppliers s ON b.supplier_id = s.supplier_id
        WHERE b.expiry_date > date('now', '+30 days')
          AND b.expiry_date <= date('now', '+90 days')
          AND b.available_qty > 0
          AND b.status = 'Active'
        ORDER BY b.expiry_date ASC;
    """)
    expiring_90_days = [dict(r) for r in cursor.fetchall()]

    # 4. Low stock products
    cursor.execute("""
        SELECT p.product_id, p.name, p.brand, p.category, p.reorder_level, p.base_unit, p.barcode,
               COALESCE(SUM(CASE WHEN b.expiry_date > date('now') AND b.status = 'Active' THEN b.available_qty ELSE 0 END), 0) AS current_stock,
               (
                   SELECT s.supplier_id FROM inventory_batches b2 
                   JOIN suppliers s ON b2.supplier_id = s.supplier_id 
                   WHERE b2.product_id = p.product_id 
                   ORDER BY b2.batch_id DESC LIMIT 1
               ) AS preferred_supplier_id,
               (
                   SELECT s.name FROM inventory_batches b2 
                   JOIN suppliers s ON b2.supplier_id = s.supplier_id 
                   WHERE b2.product_id = p.product_id 
                   ORDER BY b2.batch_id DESC LIMIT 1
               ) AS preferred_supplier_name,
               (
                   SELECT s.phone FROM inventory_batches b2 
                   JOIN suppliers s ON b2.supplier_id = s.supplier_id 
                   WHERE b2.product_id = p.product_id 
                   ORDER BY b2.batch_id DESC LIMIT 1
               ) AS preferred_supplier_phone
        FROM products p
        LEFT JOIN inventory_batches b ON p.product_id = b.product_id
        GROUP BY p.product_id
        HAVING current_stock <= p.reorder_level
        ORDER BY current_stock ASC;
    """)
    low_stock_products = [dict(r) for r in cursor.fetchall()]

    # 5. High credit risk farmers
    cursor.execute("""
        SELECT customer_id, farmer_name, phone, village, primary_crop, total_credit_due, credit_limit,
               ROUND((total_credit_due / credit_limit) * 100.0, 1) AS credit_utilization_pct
        FROM customers_khata
        WHERE total_credit_due > 0
        ORDER BY total_credit_due DESC;
    """)
    high_credit_farmers = [dict(r) for r in cursor.fetchall()]

    # Calculate loss exposure
    total_loss_exposure = 0.0
    for eb in expired_batches:
        total_loss_exposure += eb["available_qty"] * (eb["purchase_price"] or 0.0)

    # Mask costs for staff
    if is_staff:
        for b in expired_batches:
            b["purchase_price"] = None
        for b in expiring_30_days:
            b["purchase_price"] = None
        for b in expiring_90_days:
            b["purchase_price"] = None
        total_loss_exposure = None

    conn.close()

    return {
        "summary": {
            "expired_count": len(expired_batches),
            "expiring_30_count": len(expiring_30_days),
            "expiring_90_count": len(expiring_90_days),
            "low_stock_count": len(low_stock_products),
            "high_credit_count": len([f for f in high_credit_farmers if f["credit_utilization_pct"] >= 80]),
            "total_loss_exposure": round(total_loss_exposure, 2) if total_loss_exposure is not None else None
        },
        "expired_batches": expired_batches,
        "expiring_30_days": expiring_30_days,
        "expiring_90_days": expiring_90_days,
        "low_stock_products": low_stock_products,
        "high_credit_farmers": high_credit_farmers
    }


@app.post("/api/batches/{batch_id}/adjust")
def adjust_batch_stock(
    batch_id: int,
    adj_data: StockAdjustmentCreate,
    admin_user: dict = Depends(require_admin)
):
    """
    ACID stock adjustment for expiry write-offs, damaged stock, supplier returns, or count corrections.
    Restricted to Admin.
    """
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("BEGIN TRANSACTION;")
        cursor.execute("""
            SELECT b.batch_id, b.product_id, b.batch_number, b.available_qty, b.purchase_price, b.status, p.name AS product_name
            FROM inventory_batches b
            JOIN products p ON b.product_id = p.product_id
            WHERE b.batch_id = ?;
        """, (batch_id,))
        batch = cursor.fetchone()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")

        b_dict = dict(batch)
        new_qty = b_dict["available_qty"] + adj_data.quantity_change
        if new_qty < 0:
            raise HTTPException(
                status_code=400,
                detail=f"Adjustment of {adj_data.quantity_change} would result in negative stock ({new_qty}). Available stock: {b_dict['available_qty']}"
            )

        cost_impact = round(abs(adj_data.quantity_change) * b_dict["purchase_price"], 2)
        new_status = b_dict["status"]
        if adj_data.adjustment_type == "Expired_WriteOff":
            new_status = "Expired_Written_Off"
        elif new_qty == 0 and b_dict["status"] == "Active":
            new_status = "Depleted"
        elif new_qty > 0 and b_dict["status"] == "Depleted":
            new_status = "Active"

        cursor.execute("""
            UPDATE inventory_batches
            SET available_qty = ?, status = ?
            WHERE batch_id = ?;
        """, (new_qty, new_status, batch_id))

        cursor.execute("""
            INSERT INTO stock_adjustments 
            (batch_id, product_id, adjustment_type, quantity_change, cost_impact, reason, performed_by)
            VALUES (?, ?, ?, ?, ?, ?, ?);
        """, (
            batch_id,
            b_dict["product_id"],
            adj_data.adjustment_type,
            adj_data.quantity_change,
            cost_impact,
            adj_data.reason.strip(),
            admin_user.get("full_name", "Admin")
        ))
        adj_id = cursor.lastrowid

        database.log_audit(
            conn,
            "STOCK_ADJUSTMENT",
            "batch",
            str(batch_id),
            f"{adj_data.adjustment_type}: {adj_data.quantity_change} units ({b_dict['product_name']} Batch {b_dict['batch_number']}). Cost impact: Rs {cost_impact:.2f}. Reason: {adj_data.reason.strip()}",
            admin_user.get("full_name", "Admin"),
            admin_user.get("role", "Admin")
        )

        conn.commit()
        return {
            "success": True,
            "adjustment_id": adj_id,
            "batch_id": batch_id,
            "product_name": b_dict["product_name"],
            "batch_number": b_dict["batch_number"],
            "previous_qty": b_dict["available_qty"],
            "new_qty": new_qty,
            "quantity_change": adj_data.quantity_change,
            "cost_impact": cost_impact,
            "status": new_status,
            "message": f"Successfully adjusted batch {b_dict['batch_number']} stock by {adj_data.quantity_change} units"
        }
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.get("/api/stock-adjustments")
def get_stock_adjustments(admin_user: dict = Depends(require_admin)):
    """Returns recent stock adjustments audit trail (Admin only)."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT sa.adjustment_id, sa.batch_id, sa.product_id, sa.adjustment_type, sa.quantity_change,
               sa.cost_impact, sa.reason, sa.performed_by, sa.created_at,
               p.name AS product_name, p.brand, p.base_unit, b.batch_number
        FROM stock_adjustments sa
        JOIN products p ON sa.product_id = p.product_id
        JOIN inventory_batches b ON sa.batch_id = b.batch_id
        ORDER BY sa.created_at DESC;
    """)
    adjustments = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return adjustments


# =============================================================================
# Phase 3: Sales Returns (Credit Notes) & Universal Sales Register
# =============================================================================

@app.post("/api/invoices/{invoice_id}/return")
def create_sales_return(
    invoice_id: int,
    return_data: SalesReturnCreate,
    admin_user: dict = Depends(require_admin)
):
    """
    ACID transaction for GST Sales Returns / Credit Notes:
    1. Validates return quantities against billed and previously returned quantities
    2. Calculates proportional refund amounts
    3. Restores batch stock if restock_batch is true
    4. Adjusts farmer Khata balance if refund_mode is Khata_Credit_Adjustment
    5. Issues Credit Note (CN-SMAK-2026-XXXX) and updates invoice status
    """
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("BEGIN TRANSACTION;")
        # Fetch invoice
        cursor.execute("""
            SELECT i.invoice_id, i.invoice_number, i.customer_id, i.payment_mode, i.grand_total, i.amount_paid,
                   i.balance_added_to_khata, i.status, c.farmer_name
            FROM invoices i
            LEFT JOIN customers_khata c ON i.customer_id = c.customer_id
            WHERE i.invoice_id = ?;
        """, (invoice_id,))
        inv = cursor.fetchone()
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found")

        inv_dict = dict(inv)
        if inv_dict["status"] == "Returned":
            raise HTTPException(status_code=400, detail="This invoice has already been fully returned")

        # Fetch prior returns for this invoice
        cursor.execute("""
            SELECT sri.invoice_item_id, SUM(sri.quantity_returned) AS total_returned
            FROM sales_return_items sri
            JOIN sales_returns sr ON sri.return_id = sr.return_id
            WHERE sr.invoice_id = ?
            GROUP BY sri.invoice_item_id;
        """, (invoice_id,))
        already_returned = {r["invoice_item_id"]: r["total_returned"] for r in cursor.fetchall()}

        if not return_data.items:
            raise HTTPException(status_code=400, detail="At least one item must be returned")

        total_refund_amount = 0.0
        processed_items = []

        for item in return_data.items:
            cursor.execute("""
                SELECT ii.item_id, ii.invoice_id, ii.product_id, ii.batch_id, ii.qty_billed,
                       ii.unit_price, ii.gst_rate, ii.line_total, p.name AS product_name
                FROM invoice_items ii
                JOIN products p ON ii.product_id = p.product_id
                WHERE ii.item_id = ? AND ii.invoice_id = ?;
            """, (item.invoice_item_id, invoice_id))
            inv_item = cursor.fetchone()
            if not inv_item:
                raise HTTPException(status_code=404, detail=f"Invoice line item {item.invoice_item_id} not found in this invoice")

            it_dict = dict(inv_item)
            prior_ret = already_returned.get(item.invoice_item_id, 0)
            max_returnable = it_dict["qty_billed"] - prior_ret
            if item.quantity_returned > max_returnable:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot return {item.quantity_returned} units for {it_dict['product_name']}. Billed: {it_dict['qty_billed']}, Prior Returned: {prior_ret}, Max returnable: {max_returnable}"
                )

            # Refund calculation proportional to line item total
            unit_line_total = it_dict["line_total"] / it_dict["qty_billed"]
            refund_line = round(unit_line_total * item.quantity_returned, 2)
            total_refund_amount += refund_line

            # Restock batch if restock_batch is true
            if item.restock_batch:
                cursor.execute("""
                    UPDATE inventory_batches
                    SET available_qty = available_qty + ?, status = 'Active'
                    WHERE batch_id = ?;
                """, (item.quantity_returned, it_dict["batch_id"]))

            processed_items.append({
                "invoice_item_id": it_dict["item_id"],
                "batch_id": it_dict["batch_id"],
                "product_id": it_dict["product_id"],
                "quantity_returned": item.quantity_returned,
                "restock_batch": 1 if item.restock_batch else 0,
                "refund_line_total": refund_line,
                "product_name": it_dict["product_name"]
            })

        total_refund_amount = round(total_refund_amount, 2)

        # Handle refund mode
        if return_data.refund_mode == "Khata_Credit_Adjustment":
            if not inv_dict["customer_id"]:
                raise HTTPException(status_code=400, detail="Cannot adjust Khata credit for a walk-in customer without a registered account")
            cursor.execute("""
                UPDATE customers_khata
                SET total_credit_due = MAX(0.0, total_credit_due - ?)
                WHERE customer_id = ?;
            """, (total_refund_amount, inv_dict["customer_id"]))

        # Generate Return / Credit Note number
        cursor.execute("SELECT COUNT(*) FROM sales_returns;")
        cn_num = cursor.fetchone()[0] + 1
        return_number = f"CN-SMAK-2026-{cn_num:04d}"

        # Insert return header
        cursor.execute("""
            INSERT INTO sales_returns (return_number, invoice_id, customer_id, refund_mode, total_refund_amount, reason, processed_by)
            VALUES (?, ?, ?, ?, ?, ?, ?);
        """, (
            return_number,
            invoice_id,
            inv_dict["customer_id"],
            return_data.refund_mode,
            total_refund_amount,
            return_data.reason.strip(),
            admin_user.get("full_name", "Admin")
        ))
        return_id = cursor.lastrowid

        # Insert return items
        for pi in processed_items:
            cursor.execute("""
                INSERT INTO sales_return_items (return_id, invoice_item_id, batch_id, product_id, quantity_returned, restock_batch, refund_line_total)
                VALUES (?, ?, ?, ?, ?, ?, ?);
            """, (
                return_id,
                pi["invoice_item_id"],
                pi["batch_id"],
                pi["product_id"],
                pi["quantity_returned"],
                pi["restock_batch"],
                pi["refund_line_total"]
            ))

        # Check total returned across the invoice to set status
        cursor.execute("""
            SELECT SUM(qty_billed) AS total_billed FROM invoice_items WHERE invoice_id = ?;
        """, (invoice_id,))
        total_billed = cursor.fetchone()[0] or 0.0

        cursor.execute("""
            SELECT SUM(sri.quantity_returned) AS total_ret
            FROM sales_return_items sri
            JOIN sales_returns sr ON sri.return_id = sr.return_id
            WHERE sr.invoice_id = ?;
        """, (invoice_id,))
        total_ret = cursor.fetchone()[0] or 0.0

        new_inv_status = "Returned" if total_ret >= total_billed else "Partially_Returned"
        cursor.execute("UPDATE invoices SET status = ? WHERE invoice_id = ?;", (new_inv_status, invoice_id))

        database.log_audit(
            conn,
            "SALES_RETURN",
            "sales_return",
            return_number,
            f"Credit Note {return_number} issued against {inv_dict['invoice_number']} - Refund: Rs {total_refund_amount:.2f} ({return_data.refund_mode}). Reason: {return_data.reason.strip()}",
            admin_user.get("full_name", "Admin"),
            admin_user.get("role", "Admin")
        )

        conn.commit()
        return {
            "success": True,
            "return_id": return_id,
            "return_number": return_number,
            "invoice_id": invoice_id,
            "invoice_number": inv_dict["invoice_number"],
            "refund_mode": return_data.refund_mode,
            "total_refund_amount": total_refund_amount,
            "invoice_status": new_inv_status,
            "items": processed_items
        }
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.get("/api/sales-returns")
def list_sales_returns(current_user: dict = Depends(get_current_user)):
    """Returns list of all sales returns / credit notes with items."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT sr.return_id, sr.return_number, sr.invoice_id, sr.customer_id, sr.refund_mode,
               sr.total_refund_amount, sr.reason, sr.processed_by, sr.created_at,
               i.invoice_number, COALESCE(c.farmer_name, 'Walk-in Customer') AS farmer_name,
               c.phone, c.village
        FROM sales_returns sr
        JOIN invoices i ON sr.invoice_id = i.invoice_id
        LEFT JOIN customers_khata c ON sr.customer_id = c.customer_id
        ORDER BY sr.created_at DESC;
    """)
    returns = [dict(r) for r in cursor.fetchall()]

    for ret in returns:
        cursor.execute("""
            SELECT sri.return_item_id, sri.quantity_returned, sri.restock_batch, sri.refund_line_total,
                   p.name AS product_name, p.brand, b.batch_number
            FROM sales_return_items sri
            JOIN products p ON sri.product_id = p.product_id
            JOIN inventory_batches b ON sri.batch_id = b.batch_id
            WHERE sri.return_id = ?;
        """, (ret["return_id"],))
        ret["items"] = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return returns


# =============================================================================
# Phase 3: Enterprise Analytics & GST / CA Reports
# =============================================================================

@app.get("/api/reports/analytics")
def get_analytics_report(admin_user: dict = Depends(require_admin)):
    """
    Returns enterprise-grade business intelligence metrics:
    KPIs, 14-day sales trend, payment split, category performance, top products, and village demand.
    """
    conn = get_db()
    cursor = conn.cursor()

    # 1. KPIs
    cursor.execute("SELECT COALESCE(SUM(grand_total), 0) FROM invoices WHERE date(invoice_date) = date('now') AND status != 'Returned';")
    today_sales = float(cursor.fetchone()[0])

    cursor.execute("SELECT COALESCE(SUM(grand_total), 0) FROM invoices WHERE strftime('%Y-%m', invoice_date) = strftime('%Y-%m', 'now') AND status != 'Returned';")
    month_sales = float(cursor.fetchone()[0])

    cursor.execute("SELECT COALESCE(SUM(grand_total), 0), COUNT(*) FROM invoices WHERE status != 'Returned';")
    tot_row = cursor.fetchone()
    total_revenue = float(tot_row[0])
    total_invoices = int(tot_row[1])

    cursor.execute("SELECT COALESCE(SUM(total_credit_due), 0) FROM customers_khata;")
    total_outstanding_khata = float(cursor.fetchone()[0])

    cursor.execute("SELECT COALESCE(SUM(available_qty * purchase_price), 0) FROM inventory_batches WHERE status = 'Active';")
    total_inventory_valuation = float(cursor.fetchone()[0])

    # Estimated Gross Profit = Sum of (line_total - (qty_billed * b.purchase_price)) on non-returned invoices
    cursor.execute("""
        SELECT COALESCE(SUM((ii.unit_price - b.purchase_price) * ii.qty_billed), 0)
        FROM invoice_items ii
        JOIN inventory_batches b ON ii.batch_id = b.batch_id
        JOIN invoices i ON ii.invoice_id = i.invoice_id
        WHERE i.status != 'Returned';
    """)
    gross_profit = float(cursor.fetchone()[0])

    cursor.execute("SELECT COUNT(*) FROM customers_khata WHERE total_credit_due > 0;")
    active_khata_farmers = int(cursor.fetchone()[0])

    # 2. Daily sales trend (last 14 days)
    cursor.execute("""
        SELECT date(invoice_date) AS date,
               COALESCE(SUM(grand_total), 0) AS sales,
               COUNT(*) AS invoices_count
        FROM invoices
        WHERE invoice_date >= date('now', '-14 days') AND status != 'Returned'
        GROUP BY date(invoice_date)
        ORDER BY date ASC;
    """)
    daily_trend = [dict(r) for r in cursor.fetchall()]

    # 3. Payment mode split
    cursor.execute("""
        SELECT payment_mode, COALESCE(SUM(grand_total), 0) AS total_amount, COUNT(*) AS count
        FROM invoices
        WHERE status != 'Returned'
        GROUP BY payment_mode;
    """)
    payment_mode_split = {r["payment_mode"]: float(r["total_amount"]) for r in cursor.fetchall()}
    for pm in ["Cash", "UPI", "Credit_Khata", "Partial_Credit"]:
        if pm not in payment_mode_split:
            payment_mode_split[pm] = 0.0

    # 4. Category breakdown
    cursor.execute("""
        SELECT p.category,
               COALESCE(SUM(ii.line_total), 0) AS total_revenue,
               COALESCE(SUM(ii.qty_billed), 0) AS total_quantity
        FROM invoice_items ii
        JOIN products p ON ii.product_id = p.product_id
        JOIN invoices i ON ii.invoice_id = i.invoice_id
        WHERE i.status != 'Returned'
        GROUP BY p.category
        ORDER BY total_revenue DESC;
    """)
    category_breakdown = [dict(r) for r in cursor.fetchall()]

    # 5. Top products by revenue
    cursor.execute("""
        SELECT p.product_id, p.name, p.brand, p.category,
               COALESCE(SUM(ii.line_total), 0) AS revenue,
               COALESCE(SUM(ii.qty_billed), 0) AS quantity_sold
        FROM invoice_items ii
        JOIN products p ON ii.product_id = p.product_id
        JOIN invoices i ON ii.invoice_id = i.invoice_id
        WHERE i.status != 'Returned'
        GROUP BY p.product_id
        ORDER BY revenue DESC
        LIMIT 5;
    """)
    top_products = [dict(r) for r in cursor.fetchall()]

    # 6. Village demand & credit
    cursor.execute("""
        SELECT c.village,
               COALESCE(SUM(i.grand_total), 0) AS total_purchase,
               COALESCE(SUM(c.total_credit_due), 0) AS village_credit_due,
               COUNT(DISTINCT c.customer_id) AS farmer_count
        FROM customers_khata c
        LEFT JOIN invoices i ON c.customer_id = i.customer_id AND i.status != 'Returned'
        GROUP BY c.village
        ORDER BY total_purchase DESC
        LIMIT 6;
    """)
    village_demand = [dict(r) for r in cursor.fetchall()]

    conn.close()

    return {
        "kpis": {
            "today_sales": round(today_sales, 2),
            "month_sales": round(month_sales, 2),
            "total_revenue": round(total_revenue, 2),
            "total_invoices": total_invoices,
            "total_outstanding_khata": round(total_outstanding_khata, 2),
            "total_inventory_valuation": round(total_inventory_valuation, 2),
            "gross_profit": round(gross_profit, 2),
            "active_khata_farmers": active_khata_farmers
        },
        "daily_sales_trend": daily_trend,
        "payment_mode_split": payment_mode_split,
        "category_breakdown": category_breakdown,
        "top_products": top_products,
        "village_demand": village_demand
    }


@app.get("/api/reports/gst")
def get_gst_reports(admin_user: dict = Depends(require_admin)):
    """
    Returns CA-ready GSTR-1 Sales Register, HSN summary, and GST Slab totals.
    """
    conn = get_db()
    cursor = conn.cursor()

    # GSTR-1 Sales Register
    cursor.execute("""
        SELECT i.invoice_id, i.invoice_number, i.invoice_date,
               COALESCE(c.farmer_name, 'Walk-in Customer') AS customer_name,
               COALESCE(c.phone, '-') AS phone,
               '29-Karnataka' AS place_of_supply,
               i.subtotal AS taxable_value,
               i.total_cgst, i.total_sgst,
               ROUND(i.total_cgst + i.total_sgst, 2) AS total_tax,
               i.grand_total, i.payment_mode, i.status
        FROM invoices i
        LEFT JOIN customers_khata c ON i.customer_id = c.customer_id
        ORDER BY i.invoice_date DESC;
    """)
    gstr1_register = [dict(r) for r in cursor.fetchall()]

    # HSN Summary
    cursor.execute("""
        SELECT p.hsn_code, p.chemical_composition AS description, p.base_unit AS uqc,
               p.gst_slab,
               ROUND(SUM(ii.qty_billed), 2) AS total_qty,
               ROUND(SUM(ii.qty_billed * ii.unit_price), 2) AS total_taxable_value,
               ROUND(SUM(ii.cgst_amount), 2) AS total_cgst,
               ROUND(SUM(ii.sgst_amount), 2) AS total_sgst,
               ROUND(SUM(ii.cgst_amount + ii.sgst_amount), 2) AS total_tax
        FROM invoice_items ii
        JOIN products p ON ii.product_id = p.product_id
        JOIN invoices i ON ii.invoice_id = i.invoice_id
        WHERE i.status != 'Returned'
        GROUP BY p.hsn_code, p.chemical_composition, p.base_unit, p.gst_slab
        ORDER BY total_taxable_value DESC;
    """)
    hsn_summary = [dict(r) for r in cursor.fetchall()]

    # Slab totals
    cursor.execute("""
        SELECT p.gst_slab,
               ROUND(SUM(ii.qty_billed * ii.unit_price), 2) AS taxable_value,
               ROUND(SUM(ii.cgst_amount), 2) AS cgst,
               ROUND(SUM(ii.sgst_amount), 2) AS sgst,
               ROUND(SUM(ii.cgst_amount + ii.sgst_amount), 2) AS total_tax
        FROM invoice_items ii
        JOIN products p ON ii.product_id = p.product_id
        JOIN invoices i ON ii.invoice_id = i.invoice_id
        WHERE i.status != 'Returned'
        GROUP BY p.gst_slab
        ORDER BY CAST(p.gst_slab AS REAL) ASC;
    """)
    slab_totals = [dict(r) for r in cursor.fetchall()]

    conn.close()

    return {
        "store": STORE_INFO,
        "gstr1_sales_register": gstr1_register,
        "hsn_summary": hsn_summary,
        "slab_totals": slab_totals
    }


@app.get("/api/reports/export/{report_type}")
def export_csv_report(report_type: str, admin_user: dict = Depends(require_admin)):
    """
    Streams UTF-8 BOM encoded CSV reports for sales, gstr1, hsn, inventory, khata_aging, and stock_adjustments.
    """
    conn = get_db()
    cursor = conn.cursor()

    output = io.StringIO()
    # Write UTF-8 BOM so MS Excel renders Indian rupee and unicode symbols without corruption
    output.write("\ufeff")
    writer = csv.writer(output)

    today_str = datetime.date.today().isoformat()
    filename = f"SMAK_{report_type}_{today_str}.csv"

    if report_type == "sales":
        writer.writerow(["Invoice Number", "Date", "Customer", "Phone", "Payment Mode", "Taxable Value (Rs)", "CGST (Rs)", "SGST (Rs)", "Grand Total (Rs)", "Billed By", "Status"])
        cursor.execute("""
            SELECT i.invoice_number, i.invoice_date, COALESCE(c.farmer_name, 'Walk-in Customer'),
                   COALESCE(c.phone, '-'), i.payment_mode, i.subtotal, i.total_cgst, i.total_sgst,
                   i.grand_total, COALESCE(i.billed_by, '-'), i.status
            FROM invoices i
            LEFT JOIN customers_khata c ON i.customer_id = c.customer_id
            ORDER BY i.invoice_date DESC;
        """)
        for row in cursor.fetchall():
            writer.writerow(list(row))

    elif report_type == "gstr1":
        writer.writerow(["GSTIN/UIN of Recipient", "Receiver Name", "Invoice Number", "Invoice Date", "Invoice Value", "Place Of Supply", "Reverse Charge", "Invoice Type", "E-Commerce GSTIN", "Rate (%)", "Taxable Value (Rs)", "Cess Amount"])
        cursor.execute("""
            SELECT 'URP' AS gstin, COALESCE(c.farmer_name, 'Walk-in Customer'), i.invoice_number,
                   substr(i.invoice_date, 1, 10), i.grand_total, '29-Karnataka', 'N', 'Regular', '',
                   p.gst_slab, ROUND(ii.qty_billed * ii.unit_price, 2), 0.00
            FROM invoice_items ii
            JOIN products p ON ii.product_id = p.product_id
            JOIN invoices i ON ii.invoice_id = i.invoice_id
            LEFT JOIN customers_khata c ON i.customer_id = c.customer_id
            WHERE i.status != 'Returned'
            ORDER BY i.invoice_date DESC;
        """)
        for row in cursor.fetchall():
            writer.writerow(list(row))

    elif report_type == "hsn":
        writer.writerow(["HSN Code", "Description / Chemical Composition", "UQC (Unit)", "Total Quantity", "Total Taxable Value (Rs)", "Integrated Tax (Rs)", "Central Tax / CGST (Rs)", "State Tax / SGST (Rs)", "Cess Amount (Rs)", "Total Tax (Rs)"])
        cursor.execute("""
            SELECT p.hsn_code, p.chemical_composition, p.base_unit,
                   ROUND(SUM(ii.qty_billed), 2),
                   ROUND(SUM(ii.qty_billed * ii.unit_price), 2),
                   0.00,
                   ROUND(SUM(ii.cgst_amount), 2),
                   ROUND(SUM(ii.sgst_amount), 2),
                   0.00,
                   ROUND(SUM(ii.cgst_amount + ii.sgst_amount), 2)
            FROM invoice_items ii
            JOIN products p ON ii.product_id = p.product_id
            JOIN invoices i ON ii.invoice_id = i.invoice_id
            WHERE i.status != 'Returned'
            GROUP BY p.hsn_code, p.chemical_composition, p.base_unit
            ORDER BY p.hsn_code ASC;
        """)
        for row in cursor.fetchall():
            writer.writerow(list(row))

    elif report_type == "inventory":
        writer.writerow(["Barcode / SKU", "Product Name", "Brand", "Category", "Batch Number", "Mfg Date", "Expiry Date", "Available Qty", "Base Unit", "Purchase Price (Rs)", "Selling Price (Rs)", "MRP (Rs)", "Supplier", "Status"])
        cursor.execute("""
            SELECT COALESCE(p.barcode, '-'), p.name, p.brand, p.category, b.batch_number,
                   b.mfg_date, b.expiry_date, b.available_qty, p.base_unit,
                   b.purchase_price, b.selling_price, b.mrp,
                   COALESCE(s.name, '-'), b.status
            FROM inventory_batches b
            JOIN products p ON b.product_id = p.product_id
            LEFT JOIN suppliers s ON b.supplier_id = s.supplier_id
            ORDER BY p.name ASC, b.expiry_date ASC;
        """)
        for row in cursor.fetchall():
            writer.writerow(list(row))

    elif report_type == "khata_aging":
        writer.writerow(["Farmer Name", "Phone", "Village", "Primary Crop", "Total Credit Due (Rs)", "Credit Limit (Rs)", "Credit Utilization (%)", "Account Created"])
        cursor.execute("""
            SELECT farmer_name, phone, village, primary_crop, total_credit_due, credit_limit,
                   ROUND((total_credit_due / credit_limit) * 100.0, 1), created_at
            FROM customers_khata
            ORDER BY total_credit_due DESC;
        """)
        for row in cursor.fetchall():
            writer.writerow(list(row))

    elif report_type == "stock_adjustments":
        writer.writerow(["Adjustment ID", "Date", "Product Name", "Batch Number", "Adjustment Type", "Qty Change", "Cost Impact (Rs)", "Reason", "Performed By"])
        cursor.execute("""
            SELECT sa.adjustment_id, sa.created_at, p.name, b.batch_number, sa.adjustment_type,
                   sa.quantity_change, sa.cost_impact, sa.reason, sa.performed_by
            FROM stock_adjustments sa
            JOIN products p ON sa.product_id = p.product_id
            JOIN inventory_batches b ON sa.batch_id = b.batch_id
            ORDER BY sa.created_at DESC;
        """)
        for row in cursor.fetchall():
            writer.writerow(list(row))
    else:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Invalid report type '{report_type}'. Allowed: sales, gstr1, hsn, inventory, khata_aging, stock_adjustments")

    conn.close()
    csv_bytes = output.getvalue().encode("utf-8")
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )


@app.get("/api/audit-logs")
def get_audit_logs(limit: int = 100, admin_user: dict = Depends(require_admin)):
    """Returns recent audit logs across the ERP (Admin only)."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT log_id, action_type, entity_type, entity_id, summary, performed_by, role, created_at
        FROM audit_logs
        ORDER BY log_id DESC
        LIMIT ?;
    """, (limit,))
    logs = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return logs

