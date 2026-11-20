import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  User, 
  ShoppingBag, 
  AlertCircle, 
  Plus, 
  Trash2, 
  FileCheck,
  Split,
  Info,
  Search,
  CheckCircle2
} from 'lucide-react';
import { fetchFEFOPreview, createInvoice } from '../services/api';

export default function PosBillingTab({ 
  inventory = [], 
  customers = [], 
  preSelectedProductId = null,
  onInvoiceCreated
}) {
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [fefoPreview, setFefoPreview] = useState(null);
  const [fefoLoading, setFefoLoading] = useState(false);
  const [fefoError, setFefoError] = useState(null);

  // Barcode / SKU quick scan input
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [barcodeMessage, setBarcodeMessage] = useState(null);

  // Cart line items
  const [cartItems, setCartItems] = useState([]);
  
  // Payment Details
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [cashAmountPaid, setCashAmountPaid] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Selected customer object
  const currentCustomer = isWalkIn ? null : customers.find(c => c.customer_id === Number(selectedCustomerId));

  // Initialize preSelected product if passed
  useEffect(() => {
    if (preSelectedProductId) {
      setSelectedProductId(String(preSelectedProductId));
    } else if (inventory.length > 0 && !selectedProductId) {
      setSelectedProductId(String(inventory[0].product_id));
    }
  }, [preSelectedProductId, inventory]);

  // Set default customer
  useEffect(() => {
    if (customers.length > 0 && !selectedCustomerId && !isWalkIn) {
      setSelectedCustomerId(String(customers[0].customer_id));
    }
  }, [customers, isWalkIn]);

  // Handle fast barcode lookup
  const handleBarcodeLookup = (code) => {
    setBarcodeMessage(null);
    if (!code || !code.trim()) return;
    const trimmed = code.trim().toLowerCase();

    // Match barcode exact, then name, then composition
    const match = inventory.find(p => 
      (p.barcode && p.barcode.toLowerCase() === trimmed) ||
      p.name.toLowerCase().includes(trimmed) ||
      (p.chemical_composition && p.chemical_composition.toLowerCase().includes(trimmed))
    );

    if (match) {
      setSelectedProductId(String(match.product_id));
      setQuantity(1);
      setBarcodeMessage(`Found: ${match.name} (Barcode: ${match.barcode || 'N/A'})`);
      setBarcodeQuery('');
      setTimeout(() => setBarcodeMessage(null), 3000);
    } else {
      setBarcodeMessage(`No matching product found for "${code}"`);
      setTimeout(() => setBarcodeMessage(null), 3500);
    }
  };

  // Fetch FEFO Preview whenever selected product or quantity changes
  useEffect(() => {
    if (!selectedProductId || !quantity || Number(quantity) <= 0) {
      setFefoPreview(null);
      return;
    }

    let isMounted = true;
    setFefoLoading(true);
    setFefoError(null);

    fetchFEFOPreview(Number(selectedProductId), Number(quantity))
      .then((data) => {
        if (isMounted) {
          setFefoPreview(data);
          setFefoLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setFefoError(err.message);
          setFefoPreview(null);
          setFefoLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedProductId, quantity]);

  // Handle adding current FEFO preview allocation to cart
  const handleAddToCart = () => {
    if (!fefoPreview || !fefoPreview.allocations || fefoPreview.allocations.length === 0) return;

    const existingIndex = cartItems.findIndex(item => item.product_id === fefoPreview.product_id);
    if (existingIndex >= 0) {
      const newItems = [...cartItems];
      newItems[existingIndex] = { ...fefoPreview };
      setCartItems(newItems);
    } else {
      setCartItems([...cartItems, { ...fefoPreview }]);
    }
  };

  const handleRemoveFromCart = (index) => {
    setCartItems(cartItems.filter((_, idx) => idx !== index));
  };

  // Quick Demo: Load Bayer Confidor with 15 units
  const handleLoadDemoBayer = () => {
    const bayer = inventory.find(p => p.name.includes('Bayer Confidor'));
    if (bayer) {
      setSelectedProductId(String(bayer.product_id));
      setQuantity(15);
    }
  };

  // Grand totals across all cart items
  const cartSubtotal = cartItems.reduce((acc, item) => acc + item.subtotal, 0);
  const cartTotalCgst = cartItems.reduce((acc, item) => acc + item.total_cgst, 0);
  const cartTotalSgst = cartItems.reduce((acc, item) => acc + item.total_sgst, 0);
  const cartGrandTotal = Math.round((cartSubtotal + cartTotalCgst + cartTotalSgst) * 100) / 100;

  // Calculate GST Slab breakdown
  const gstSlabBreakdown = {
    '0': { taxable: 0, cgst: 0, sgst: 0, total: 0 },
    '5': { taxable: 0, cgst: 0, sgst: 0, total: 0 },
    '12': { taxable: 0, cgst: 0, sgst: 0, total: 0 },
    '18': { taxable: 0, cgst: 0, sgst: 0, total: 0 },
  };

  cartItems.forEach(item => {
    item.allocations.forEach(alloc => {
      const slabKey = String(Math.round(alloc.gst_rate));
      if (gstSlabBreakdown[slabKey]) {
        gstSlabBreakdown[slabKey].taxable += alloc.taxable_amount;
        gstSlabBreakdown[slabKey].cgst += alloc.cgst_amount;
        gstSlabBreakdown[slabKey].sgst += alloc.sgst_amount;
        gstSlabBreakdown[slabKey].total += (alloc.cgst_amount + alloc.sgst_amount);
      }
    });
  });

  // Calculate payment balance
  let amountPaid = 0;
  let balanceToKhata = 0;

  if (paymentMode === 'Cash' || paymentMode === 'UPI') {
    amountPaid = cartGrandTotal;
    balanceToKhata = 0;
  } else if (paymentMode === 'Credit_Khata') {
    amountPaid = 0;
    balanceToKhata = cartGrandTotal;
  } else if (paymentMode === 'Partial_Credit') {
    amountPaid = Math.min(Number(cashAmountPaid || 0), cartGrandTotal);
    balanceToKhata = Math.round((cartGrandTotal - amountPaid) * 100) / 100;
  }

  // Credit limit validation
  const newProjectedKhataDue = currentCustomer 
    ? (currentCustomer.total_credit_due + balanceToKhata) 
    : 0;
  const isCreditExceeded = currentCustomer 
    ? (newProjectedKhataDue > currentCustomer.credit_limit) 
    : false;

  // Submit and create invoice
  const handleFinalizeBill = async () => {
    setErrorMessage('');
    if (!isWalkIn && !selectedCustomerId) {
      setErrorMessage('Please select a Farmer or check Walk-in Counter Customer.');
      return;
    }
    if (isWalkIn && (paymentMode === 'Credit_Khata' || paymentMode === 'Partial_Credit')) {
      setErrorMessage('Walk-in counter sales cannot be added to Khata. Please choose Cash or UPI.');
      return;
    }
    if (cartItems.length === 0) {
      setErrorMessage('Cart is empty. Add at least one product.');
      return;
    }
    if (balanceToKhata > 0 && isCreditExceeded) {
      setErrorMessage(`Cannot complete: Farmer's credit limit of ₹${currentCustomer.credit_limit} will be exceeded!`);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customer_id: isWalkIn ? null : Number(selectedCustomerId),
        payment_mode: paymentMode,
        amount_paid: amountPaid,
        items: cartItems.map(item => ({
          product_id: item.product_id,
          qty: item.allocated_qty
        }))
      };

      const result = await createInvoice(payload);
      setIsSubmitting(false);
      setCartItems([]);
      if (onInvoiceCreated) {
        onInvoiceCreated(result);
      }
    } catch (err) {
      setIsSubmitting(false);
      setErrorMessage(err.message || 'Error creating invoice');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Billing Counter (POS)
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select farmer, choose items, and generate official GST tax invoice
          </p>
        </div>

        {/* Demo Button */}
        <button
          onClick={handleLoadDemoBayer}
          className="text-xs bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-3.5 py-2 rounded-lg font-semibold transition active:scale-95 flex items-center gap-2 shadow-sm shrink-0"
        >
          <Split className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Load 15 units Bayer Confidor (FEFO Multi-Batch Demo)</span>
        </button>
      </div>

      {/* Main Billing Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Farmer & Product Selection (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Farmer Selection Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Customer Account
              </label>

              {/* Walk-in Counter Sale Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer select-none px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                <input
                  type="checkbox"
                  checked={isWalkIn}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsWalkIn(checked);
                    if (checked && (paymentMode === 'Credit_Khata' || paymentMode === 'Partial_Credit')) {
                      setPaymentMode('Cash');
                    }
                  }}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Walk-in Counter (No Khata)
                </span>
              </label>
            </div>

            {/* Farmer Select Dropdown or Walk-in Notice */}
            {isWalkIn ? (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-xs flex items-center justify-between text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold">Walk-in Counter Customer Selected</span>
                </div>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400">Cash / UPI billing</span>
              </div>
            ) : (
              <>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600 transition"
                >
                  {customers.map((c) => (
                    <option key={c.customer_id} value={c.customer_id}>
                      {c.farmer_name} • {c.village} ({c.primary_crop}) — Due: ₹{c.total_credit_due} / Limit: ₹{c.credit_limit}
                    </option>
                  ))}
                </select>

                {currentCustomer && (
                  <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-lg text-xs">
                    <div>
                      <div className="text-slate-500">Village & Crop</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {currentCustomer.village} • {currentCustomer.primary_crop}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Current Due</div>
                      <div className="font-bold text-sky-700 dark:text-sky-400 mt-0.5">
                        ₹{currentCustomer.total_credit_due?.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Available Limit</div>
                      <div className="font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                        ₹{currentCustomer.available_credit?.toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 2. Product & Quantity Selector */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Product & Quantity
              </label>
              <span className="text-[11px] text-slate-400">FEFO Auto-Allocation</span>
            </div>

            {/* Quick Barcode Scan / SKU Lookup */}
            <div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-emerald-600" />
                <input
                  type="text"
                  placeholder="Scan barcode or type SKU (e.g., SMAK-IFF-1919) and press Enter..."
                  value={barcodeQuery}
                  onChange={(e) => setBarcodeQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleBarcodeLookup(barcodeQuery);
                    }
                  }}
                  className="w-full pl-9 pr-20 py-2 text-xs rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => handleBarcodeLookup(barcodeQuery)}
                  className="absolute right-1 top-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-md transition"
                >
                  Find
                </button>
              </div>
              {barcodeMessage && (
                <div className={`text-[11px] mt-1 font-semibold ${barcodeMessage.startsWith('Found') ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {barcodeMessage}
                </div>
              )}
            </div>

            {/* Larger Product Select Dropdown */}
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600 transition"
            >
              {inventory.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.name} ({p.brand}) — Stock: {p.total_stock} {p.base_unit} [GST: {p.gst_slab}%]{p.barcode ? ` [Barcode: ${p.barcode}]` : ''}
                </option>
              ))}
            </select>

            {/* Quantity Input and Large Quick Buttons */}
            <div>
              <div className="text-xs text-slate-500 mb-1.5 font-medium">Quantity to Bill:</div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseFloat(e.target.value) || 1))}
                  className="w-32 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-base text-slate-900 dark:text-white font-bold text-center focus:outline-none focus:border-emerald-600"
                />
                <div className="flex gap-2">
                  {[1, 5, 10, 15].map(q => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuantity(q)}
                      className={`text-sm px-4 py-2.5 rounded-lg font-bold transition ${
                        quantity === q 
                          ? 'bg-emerald-600 text-white shadow-sm' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      +{q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live FEFO Batch Allocation Display */}
            <div className="bg-slate-50 dark:bg-slate-950/80 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="font-semibold text-slate-700 dark:text-slate-300">
                  Auto-selected from earliest expiring batch(es):
                </div>
                {fefoLoading && <span className="text-slate-400 animate-pulse">Calculating split...</span>}
              </div>

              {fefoError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{fefoError}</span>
                </div>
              )}

              {fefoPreview && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    {fefoPreview.allocations.map((alloc) => (
                      <div 
                        key={alloc.batch_id}
                        className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-xs shadow-sm"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                              Batch {alloc.batch_number}
                            </span>
                            <span className="text-xs text-slate-500">
                              (Exp: {alloc.expiry_date})
                            </span>
                          </div>
                          <div className="text-slate-500 mt-0.5">
                            Batch stock: {alloc.stock_in_batch} {fefoPreview.base_unit} • Selling: ₹{alloc.selling_price.toFixed(2)}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                            {alloc.qty_to_deduct_from_batch} {fefoPreview.base_unit}
                          </div>
                          <div className="text-slate-500 font-mono">
                            ₹{alloc.line_total.toFixed(2)} (incl. tax)
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {fefoPreview.allocations.length > 1 && (
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        The requested {fefoPreview.requested_qty} units are split across {fefoPreview.allocations.length} batches to sell older stock first.
                      </span>
                    </div>
                  )}

                  {/* Add to Bill Button */}
                  <button
                    onClick={handleAddToCart}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-bold text-sm shadow-sm transition active:scale-98 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add {fefoPreview.allocated_qty} {fefoPreview.base_unit} to Current Bill
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Invoice Cart & Grand Total (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                Current Bill
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {cartItems.length} Products
              </span>
            </div>

            {/* Cart Items List */}
            {cartItems.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No items added yet. Select a product on the left.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {cartItems.map((item, idx) => (
                  <div 
                    key={item.product_id} 
                    className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg text-xs space-y-1.5"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{item.product_name}</div>
                        <div className="text-slate-500">{item.brand} • GST {item.allocations[0]?.gst_rate}%</div>
                      </div>
                      <button
                        onClick={() => handleRemoveFromCart(idx)}
                        className="text-slate-400 hover:text-red-600 p-1 transition"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-800 font-mono text-[11px]">
                      {item.allocations.map((alloc) => (
                        <div key={alloc.batch_id} className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>{alloc.batch_number} ({alloc.qty_to_deduct_from_batch} {item.base_unit})</span>
                          <span className="font-semibold text-slate-900 dark:text-white">₹{alloc.line_total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Large Grand Total Box */}
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-1">
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Taxable Subtotal:</span>
                <span className="font-mono">₹{cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Total Tax (CGST + SGST):</span>
                <span className="font-mono">₹{(cartTotalCgst + cartTotalSgst).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-emerald-200 dark:border-emerald-800">
                <span className="font-bold text-slate-900 dark:text-white text-sm">Grand Total:</span>
                <span className="font-extrabold text-2xl text-emerald-700 dark:text-emerald-400 font-mono">
                  ₹{cartGrandTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment Mode Selector */}
            <div className="space-y-2.5 pt-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                Payment Mode
              </label>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'Cash', label: 'Cash' },
                  { id: 'UPI', label: 'UPI / QR' },
                  { id: 'Credit_Khata', label: 'Farmer Khata', disabled: isWalkIn },
                  { id: 'Partial_Credit', label: 'Partial Khata', disabled: isWalkIn },
                ].map((mode) => {
                  const isSelected = paymentMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      disabled={mode.disabled}
                      onClick={() => !mode.disabled && setPaymentMode(mode.id)}
                      title={mode.disabled ? 'Khata credit requires a registered farmer' : ''}
                      className={`p-2.5 rounded-lg border text-center text-xs font-semibold transition ${
                        mode.disabled
                          ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-50'
                          : isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {mode.label}
                    </button>
                  );
                })}
              </div>

              {/* Partial Credit Input */}
              {paymentMode === 'Partial_Credit' && (
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <label className="text-slate-700 dark:text-slate-300 font-medium">Upfront Cash / UPI Paid (₹):</label>
                  <input
                    type="number"
                    min="0"
                    max={cartGrandTotal}
                    step="10"
                    placeholder="Enter amount paid"
                    value={cashAmountPaid}
                    onChange={(e) => setCashAmountPaid(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white font-mono font-bold"
                  />
                  <div className="flex justify-between text-slate-500 pt-1">
                    <span>Balance added to Khata:</span>
                    <span className="font-mono font-bold text-sky-700 dark:text-sky-400">₹{balanceToKhata.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Credit Status Warning if adding to Khata */}
              {balanceToKhata > 0 && currentCustomer && (
                <div className={`p-2.5 rounded-lg border text-xs ${
                  isCreditExceeded 
                    ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300' 
                    : 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300'
                }`}>
                  <div className="font-bold">
                    {isCreditExceeded ? 'Credit Limit Exceeded!' : 'Adding to Farmer Khata'}
                  </div>
                  <div className="mt-0.5">
                    Adding ₹{balanceToKhata.toFixed(2)}. New balance will be <strong>₹{newProjectedKhataDue.toFixed(2)}</strong> / Limit: ₹{currentCustomer.credit_limit.toFixed(2)}.
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Finalize Button */}
              <button
                disabled={isSubmitting || cartItems.length === 0 || isCreditExceeded}
                onClick={handleFinalizeBill}
                className={`w-full py-3.5 rounded-lg font-bold text-sm shadow-sm transition active:scale-98 flex items-center justify-center gap-2 ${
                  isSubmitting || cartItems.length === 0 || isCreditExceeded
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {isSubmitting ? (
                  <span>Generating Invoice...</span>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4" />
                    <span>Finalize & Print GST Bill</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
