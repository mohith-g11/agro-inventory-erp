# Sri Mathurshree Agro Kendra — System Architecture & Domain Rules

## 1. System Overview
An Agricultural Retail & Inventory ERP designed for **Sri Mathurshree Agro Kendra**. Unlike generic retail POS systems, this platform enforces Indian agricultural regulatory compliance (Insecticides Act & Fertilizer Control Order), multi-slab GST calculation, chemical composition substitute lookups, and First-Expired, First-Out (FEFO) batch deduction.

## 2. Database Normalization (3NF)
- **1NF:** All columns contain atomic values; repeating batch groups are separated from `products` into `inventory_batches`, and repeating line items are separated into `invoice_items`.
- **2NF:** Every non-key attribute in `inventory_batches` and `invoice_items` is fully functionally dependent on the primary key (`batch_id` and `item_id`).
- **3NF:** Transitive dependencies are eliminated. Product names, HSN codes, and GST rates live strictly in `products`, while batch-specific pricing (`mrp`, `selling_price`) and `expiry_date` live in `inventory_batches` because agro MRP changes per manufactured batch.

## 3. Core Business Rules for Backend Implementation
1. **FEFO (First-Expired, First-Out) Enforcement:**
   - Queries fetching sellable stock MUST filter `available_qty > 0 AND expiry_date > CURDATE()` and sort by `expiry_date ASC`.
   - If a bill requires 15 units and the earliest expiring batch only holds 6 units, the backend automatically splits the checkout into two `invoice_items` rows (6 units from Batch 1, 9 units from Batch 2).
2. **Active Chemical / NPK Substitute Engine:**
   - Querying `products` by `chemical_composition` (e.g., `Imidacloprid 17.8% SL` or `NPK 19:19:19`) returns all stocked brands with identical active compounds when a farmer's requested brand is out of stock.
3. **Multi-Slab Agro GST Split:**
   - Every item's tax is split 50/50 into **CGST** and **SGST** based on `products.gst_slab` (`0%` Seeds, `5%` Bio/NPK Fertilizers, `12%` Micronutrients, `18%` Pesticides/Insecticides).
4. **Farmer Khata (Seasonal Credit) Integrity:**
   - When `payment_mode` is `Credit_Khata` or `Partial_Credit`, `balance_added_to_khata` (`grand_total - amount_paid`) automatically increments `customers_khata.total_credit_due` inside a single ACID database transaction.