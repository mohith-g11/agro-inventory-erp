-- ============================================================================
-- A. FEFO MULTI-BATCH PREVIEW QUERY (Uses MySQL 8.0 Window Functions)
-- Calculates exact batch split before the bill is finalized.
-- Example: Farmer requests @requested_qty = 15 units of @target_product_id = 3
-- ============================================================================
SET @target_product_id = 3;
SET @requested_qty = 15.00;

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
    WHERE b.product_id = @target_product_id
      AND b.available_qty > 0
      AND b.expiry_date > CURDATE() -- Never bill already-expired stock!
)
SELECT 
    batch_id,
    product_name,
    batch_number,
    expiry_date,
    available_qty AS stock_in_batch,
    CASE 
        WHEN cumulative_qty <= @requested_qty THEN available_qty
        ELSE @requested_qty - (cumulative_qty - available_qty)
    END AS qty_to_deduct_from_batch,
    selling_price,
    CAST(gst_slab AS DECIMAL(5,2)) AS gst_rate
FROM RunningStock
WHERE (cumulative_qty - available_qty) < @requested_qty
ORDER BY expiry_date ASC;