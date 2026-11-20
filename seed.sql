-- ============================================================================
-- SEED DATA FOR SRI MATHURSHREE AGRO KENDRA (Reference Date: Oct 14, 2026)
-- ============================================================================
USE mathurshree_agro_erp;

-- 1. Insert 10 Realistic Indian Agro Products
INSERT INTO products 
(product_id, name, brand, category, chemical_composition, hsn_code, gst_slab, base_unit, bulk_unit, conversion_factor, reorder_level) 
VALUES
-- NPK & Chemical Fertilizers (5% & 12% GST)
(1, 'IFFCO NPK 19:19:19 Water Soluble', 'IFFCO', 'NPK_Fertilizer', 'NPK 19:19:19', '31052000', '5', 'Kg', 'Bag', 25.00, 50.00),
(2, 'Coromandel Gromor NPK 19:19:19', 'Coromandel', 'NPK_Fertilizer', 'NPK 19:19:19', '31052000', '5', 'Kg', 'Bag', 25.00, 50.00),
(3, 'Coromandel Gromor DAP 18:46:0', 'Coromandel', 'NPK_Fertilizer', 'DAP 18:46:0', '31053000', '5', 'Kg', 'Bag', 50.00, 200.00),

-- Insecticides (18% GST) - Note identical chemical_composition on IDs 4 & 5 for Substitute Search demo!
(4, 'Bayer Confidor 200ml', 'Bayer CropScience', 'Insecticide', 'Imidacloprid 17.8% SL', '38089199', '18', 'Bottle', 'Box', 20.00, 15.00),
(5, 'Tata Mida 200ml', 'Rallis India (Tata)', 'Insecticide', 'Imidacloprid 17.8% SL', '38089199', '18', 'Bottle', 'Box', 20.00, 15.00),
(6, 'Syngenta Actara 100g', 'Syngenta', 'Insecticide', 'Thiamethoxam 25% WG', '38089199', '18', 'Packet', 'Box', 50.00, 20.00),
(7, 'FMC Coragen 60ml', 'FMC India', 'Insecticide', 'Chlorantraniliprole 18.5% SC', '38089199', '18', 'Bottle', 'Box', 30.00, 10.00),

-- Pesticides / Fungicides (18% GST)
(8, 'Syngenta Amistar 100ml', 'Syngenta', 'Pesticide', 'Azoxystrobin 23% SC', '38089290', '18', 'Bottle', 'Box', 20.00, 12.00),

-- Bio-Fertilizers (5% GST)
(9, 'IFFCO Sagarika Seaweed Extract', 'IFFCO', 'Bio_Fertilizer', 'Seaweed Ascophyllum Nodosum 28%', '31010099', '5', 'Liter', 'Box', 10.00, 15.00),

-- Certified Seeds (0% GST)
(10, 'Kaveri Jadoo Hybrid Cotton Seeds (450g)', 'Kaveri Seeds', 'Seeds', 'BG-II Hybrid Bt Cotton', '12072100', '0', 'Packet', 'Box', 20.00, 25.00);

-- 2. Insert Inventory Batches (Includes Multiple Batches & Expiring-in-<30-Days Alerts!)
INSERT INTO inventory_batches 
(product_id, batch_number, mfg_date, expiry_date, purchase_price, mrp, selling_price, available_qty) 
VALUES
-- Product 1 (IFFCO NPK 19:19:19) - Two batches (1 expiring in 14 days!)
(1, 'IFF-NPK-24J', '2024-11-01', '2026-10-28', 110.00, 160.00, 140.00, 35.00), -- RED ALERT: Expiring Oct 28, 2026
(1, 'IFF-NPK-26A', '2026-02-15', '2028-02-14', 115.00, 165.00, 145.00, 150.00),

-- Product 2 (Coromandel NPK 19:19:19 - Substitute for Product 1)
(2, 'COR-19-26B', '2026-01-10', '2028-01-09', 112.00, 160.00, 142.00, 125.00),

-- Product 3 (Gromor DAP)
(3, 'DAP-COR-26M', '2026-03-01', '2029-02-28', 24.00, 27.00, 26.50, 500.00),

-- Product 4 (Bayer Confidor) - Two batches (1 expiring in 11 days for FEFO split demo!)
(4, 'BAY-CNF-0924', '2024-10-26', '2026-10-25', 290.00, 420.00, 360.00, 6.00),  -- RED ALERT: Expiring Oct 25, 2026 (Only 6 left)
(4, 'BAY-CNF-0426', '2026-04-10', '2028-04-09', 300.00, 440.00, 380.00, 40.00),

-- Product 5 (Tata Mida - Direct chemical substitute for Bayer Confidor)
(5, 'RAL-MID-0226', '2026-02-01', '2028-01-31', 260.00, 380.00, 330.00, 30.00),

-- Product 6 (Syngenta Actara) - Expiring in 22 days!
(6, 'SYN-ACT-1124', '2024-11-06', '2026-11-05', 140.00, 210.00, 180.00, 18.00), -- RED ALERT: Expiring Nov 05, 2026
(6, 'SYN-ACT-0526', '2026-05-01', '2028-04-30', 145.00, 220.00, 185.00, 60.00),

-- Product 7 (FMC Coragen)
(7, 'FMC-COR-0126', '2026-01-20', '2028-01-19', 680.00, 930.00, 820.00, 22.00),

-- Product 8 (Syngenta Amistar) - Expiring in 26 days!
(8, 'SYN-AMI-1124', '2024-11-10', '2026-11-09', 410.00, 580.00, 510.00, 9.00),  -- RED ALERT: Expiring Nov 09, 2026

-- Product 9 (IFFCO Sagarika)
(9, 'IFF-SAG-0326', '2026-03-15', '2028-03-14', 320.00, 450.00, 400.00, 25.00),

-- Product 10 (Kaveri Jadoo Cotton Seeds) - Expiring in 19 days!
(10, 'KAV-JAD-0126', '2026-02-02', '2026-11-02', 650.00, 853.00, 810.00, 14.00); -- RED ALERT: Expiring Nov 02, 2026

-- 3. Insert Farmers (Mysore Belt Villages & Crop Profiles)
INSERT INTO customers_khata 
(customer_id, farmer_name, phone, village, primary_crop, total_credit_due, credit_limit) 
VALUES
(1, 'Ramesh Gowda', '9845011223', 'Nanjangud', 'Paddy & Sugarcane', 12450.00, 30000.00),
(2, 'Mahadevaiah S', '9448122334', 'T. Narasipura', 'Paddy', 4200.00, 20000.00),
(3, 'Puttaraju M', '9900233445', 'Hunsur', 'Cotton & Maize', 18900.00, 25000.00),
(4, 'Shivanna K', '9740344556', 'Bannur', 'Sugarcane', 0.00, 35000.00),
(5, 'Nagaraj Urs', '9611455667', 'HD Kote', 'Ragi & Cotton', 8750.00, 20000.00);

-- 4. Insert Sample Historical Invoices
INSERT INTO invoices 
(invoice_id, invoice_number, customer_id, invoice_date, subtotal, total_cgst, total_sgst, grand_total, payment_mode, amount_paid, balance_added_to_khata) 
VALUES
(1, 'SMAK-2026-0001', 1, '2026-10-10 10:30:00', 3600.00, 324.00, 324.00, 4248.00, 'Partial_Credit', 2000.00, 2248.00),
(2, 'SMAK-2026-0002', 4, '2026-10-12 14:15:00', 1400.00, 35.00, 35.00, 1470.00, 'UPI', 1470.00, 0.00);

-- 5. Insert Sample Invoice Items (Linked to specific Batch IDs)
INSERT INTO invoice_items 
(invoice_id, product_id, batch_id, qty_billed, unit_price, gst_rate, cgst_amount, sgst_amount, line_total) 
VALUES
(1, 4, 4, 10.00, 360.00, 18.00, 324.00, 324.00, 4248.00),
(2, 1, 1, 10.00, 140.00, 5.00, 35.00, 35.00, 1470.00);

-- 6. Insert Realistic Mysuru/Karnataka Agro Distributors (Suppliers)
INSERT INTO suppliers 
(supplier_id, name, phone, gstin, city) 
VALUES
(1, 'Sri Chamundeshwari Agro Agencies', '9845123456', '29ABCDE1234F1Z5', 'Mysuru'),
(2, 'Cauvery Krishi Input Distributors', '9448234567', '29FGHIJ5678K1Z3', 'Mandya'),
(3, 'Karnataka Agro Feeds & Seeds Corp', '9900345678', '29KLMNO9012P1Z1', 'Mysuru');

-- 7. Insert Realistic Farmer Khata Repayments
INSERT INTO khata_payments 
(payment_id, customer_id, amount, payment_mode, payment_date, remarks) 
VALUES
(1, 1, 4000.00, 'UPI', '2026-10-18 11:30:00', 'Post-harvest paddy advance repayment via PhonePe UPI'),
(2, 2, 2000.00, 'Cash', '2026-10-20 16:45:00', 'Partial cash payment at Kendra counter'),
(3, 3, 5000.00, 'Bank_Transfer', '2026-10-25 10:15:00', 'NEFT harvest settlement - Cotton crop yield');