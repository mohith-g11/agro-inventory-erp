"""
Sri Mathurshree Agro Kendra - FastAPI Backend
Implements Phase 1 Retail & Inventory ERP REST APIs.
"""

from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import sqlite3
import datetime
from pathlib import Path
from .database import get_db, init_db

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

@app.on_event("startup")
def startup_event():
    """Ensure database schema is created and seeded on server startup."""
    init_db()

# -----------------------------------------------------------------------------
# Data Models
# -----------------------------------------------------------------------------
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
