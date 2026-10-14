import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  User, 
  ShoppingBag, 
  AlertCircle, 
  Sparkles, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  CreditCard, 
  Wallet, 
  ShieldCheck, 
  FileCheck,
  Split,
  ChevronRight,
  Info
} from 'lucide-react';
import { fetchFEFOPreview, createInvoice } from '../services/api';

export default function PosBillingTab({ 
  inventory = [], 
  customers = [], 
  preSelectedProductId = null,
  onInvoiceCreated
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [fefoPreview, setFefoPreview] = useState(null);
  const [fefoLoading, setFefoLoading] = useState(false);
  const [fefoError, setFefoError] = useState(null);

  // Cart line items (each item can be backed by multiple batches!)
  const [cartItems, setCartItems] = useState([]);
  
  // Payment Details
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [cashAmountPaid, setCashAmountPaid] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Selected customer object
  const currentCustomer = customers.find(c => c.customer_id === Number(selectedCustomerId));

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
    if (customers.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(String(customers[0].customer_id));
    }
  }, [customers]);

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

    // Check if product is already in cart
    const existingIndex = cartItems.findIndex(item => item.product_id === fefoPreview.product_id);
    if (existingIndex >= 0) {
      // Replace with new quantity allocation
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

  // Calculate GST Slab breakdown across all batch allocations
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
    if (!selectedCustomerId) {
      setErrorMessage('Please select a Farmer.');
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
        customer_id: Number(selectedCustomerId),
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
      {/* Header with Statutory Licences */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Receipt className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                GST Point-of-Sale Billing Counter
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Automated First-Expired, First-Out (FEFO) multi-batch splitting & 50/50 CGST/SGST compliance
            </p>
          </div>

          {/* Quick Demo Trigger */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadDemoBayer}
              className="text-xs bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 px-3.5 py-2 rounded-xl font-medium transition active:scale-95 flex items-center gap-2 shadow-sm"
            >
              <Split className="w-4 h-4 text-indigo-400" />
              <span>Load 15 units Bayer Confidor (FEFO Multi-Batch Demo)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Billing Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Farmer Selection & Product FEFO Allocator (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Farmer Selection Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" />
                Select Farmer (Khata Profile)
              </label>
              <span className="text-[11px] text-slate-400">Mysore Agricultural Belt</span>
            </div>

            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition"
            >
              {customers.map((c) => (
                <option key={c.customer_id} value={c.customer_id}>
                  {c.farmer_name} • {c.village} ({c.primary_crop}) — Due: ₹{c.total_credit_due} / Limit: ₹{c.credit_limit}
                </option>
              ))}
            </select>

            {currentCustomer && (
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs">
                <div>
                  <div className="text-slate-400 text-[10px]">Village & Crop:</div>
                  <div className="font-semibold text-slate-200 mt-0.5">
                    {currentCustomer.village} • {currentCustomer.primary_crop}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">Current Khata Due:</div>
                  <div className="font-bold text-sky-400 font-mono mt-0.5">
                    ₹{currentCustomer.total_credit_due?.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">Available Credit Limit:</div>
                  <div className="font-bold text-emerald-400 font-mono mt-0.5">
                    ₹{currentCustomer.available_credit?.toFixed(2)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Product & Quantity Selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
                Select Product & Billing Quantity
              </label>
              <span className="text-[11px] text-emerald-400 font-mono">FEFO Engine Active</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                >
                  {inventory.map((p) => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.name} ({p.brand}) — Stock: {p.total_stock} {p.base_unit} [GST: {p.gst_slab}%]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseFloat(e.target.value) || 1))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500 text-center"
                  />
                  <div className="flex gap-1">
                    {[1, 5, 10, 15].map(q => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQuantity(q)}
                        className={`text-[10px] px-2 py-1.5 rounded-lg font-mono font-bold transition ${
                          quantity === q ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        +{q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* LIVE FEFO MULTI-BATCH PREVIEW BOX */}
            <div className="bg-slate-950/80 rounded-xl p-4 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Split className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-white">Live FEFO Batch Allocation Plan:</span>
                </div>
                {fefoLoading && <span className="text-[11px] text-slate-400 animate-pulse">Calculating FEFO order...</span>}
              </div>

              {fefoError && (
                <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-lg text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{fefoError}</span>
                </div>
              )}

              {fefoPreview && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    {fefoPreview.allocations.map((alloc, idx) => {
                      const isNearExpiry = new Date(alloc.expiry_date) - new Date() < 30 * 24 * 3600 * 1000;
                      return (
                        <div 
                          key={alloc.batch_id}
                          className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <span className="font-mono font-bold text-emerald-300">
                                Batch {alloc.batch_number}
                              </span>
                              {isNearExpiry && (
                                <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/40 px-1.5 py-0.5 rounded font-bold">
                                  Expires Soon ({alloc.expiry_date})
                                </span>
                              )}
                              {!isNearExpiry && (
                                <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                                  Exp: {alloc.expiry_date}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Available in batch: {alloc.stock_in_batch} {fefoPreview.base_unit} • MRP: ₹{alloc.mrp.toFixed(2)}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="font-bold text-white font-mono text-sm">
                              {alloc.qty_to_deduct_from_batch} {fefoPreview.base_unit}
                            </div>
                            <div className="text-[11px] font-mono text-slate-300">
                              @ ₹{alloc.selling_price.toFixed(2)} = ₹{alloc.taxable_amount.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Multi-Batch Splitting Info Banner */}
                  {fefoPreview.allocations.length > 1 && (
                    <div className="p-2.5 bg-indigo-950/40 border border-indigo-500/30 rounded-lg text-xs text-indigo-200 flex items-start gap-2">
                      <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Multi-Batch FEFO Split:</strong> The requested {fefoPreview.requested_qty} units exceed the oldest batch capacity. The system safely splits the line item across {fefoPreview.allocations.length} batches to exhaust older stock first.
                      </span>
                    </div>
                  )}

                  {/* Tax & Total Calculation */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                    <div className="text-slate-400">
                      Taxable: ₹{fefoPreview.subtotal.toFixed(2)} + GST ({fefoPreview.allocations[0]?.gst_rate}%): ₹{(fefoPreview.total_cgst + fefoPreview.total_sgst).toFixed(2)}
                    </div>
                    <div className="font-bold text-emerald-400 font-mono text-sm">
                      Total: ₹{fefoPreview.grand_total.toFixed(2)}
                    </div>
                  </div>

                  {/* Add to Bill Button */}
                  <button
                    onClick={handleAddToCart}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-emerald-950 transition active:scale-98 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add {fefoPreview.allocated_qty} {fefoPreview.base_unit} to Current Bill
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Invoice Cart, GST Split, & Payment Controls (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                Current Tax Invoice Cart
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {cartItems.length} Products
              </span>
            </div>

            {/* Cart Items List */}
            {cartItems.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No items added to the bill yet. Select a product and quantity on the left.
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {cartItems.map((item, idx) => (
                  <div 
                    key={item.product_id} 
                    className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-100">{item.product_name}</div>
                        <div className="text-[11px] text-slate-400">{item.brand} • GST {item.allocations[0]?.gst_rate}%</div>
                      </div>
                      <button
                        onClick={() => handleRemoveFromCart(idx)}
                        className="text-slate-500 hover:text-red-400 p-1 transition"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Batch breakdown rows */}
                    <div className="space-y-1 bg-slate-900/60 p-2 rounded-lg font-mono text-[11px]">
                      {item.allocations.map((alloc) => (
                        <div key={alloc.batch_id} className="flex justify-between text-slate-300">
                          <span>
                            {alloc.batch_number} ({alloc.qty_to_deduct_from_batch} {item.base_unit})
                          </span>
                          <span className="font-semibold text-emerald-400">
                            ₹{alloc.line_total.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 50/50 Multi-Slab GST Table */}
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                <span>Multi-Slab Agro GST Summary (50/50 Split)</span>
                <span className="font-mono text-emerald-400">Rule 3 Compliant</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 font-semibold">
                      <th className="py-1">Slab</th>
                      <th className="py-1 text-right">Taxable (₹)</th>
                      <th className="py-1 text-right">CGST (₹)</th>
                      <th className="py-1 text-right">SGST (₹)</th>
                      <th className="py-1 text-right">Total Tax (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 font-mono">
                    {['0', '5', '12', '18'].map((slab) => {
                      const data = gstSlabBreakdown[slab];
                      return (
                        <tr key={slab} className="text-slate-300">
                          <td className="py-1 font-semibold text-emerald-400">{slab}%</td>
                          <td className="py-1 text-right">{data.taxable.toFixed(2)}</td>
                          <td className="py-1 text-right">{data.cgst.toFixed(2)}</td>
                          <td className="py-1 text-right">{data.sgst.toFixed(2)}</td>
                          <td className="py-1 text-right font-bold text-slate-200">{data.total.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cart Grand Total Card */}
            <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-1">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Taxable Subtotal:</span>
                <span className="font-mono font-medium">₹{cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-300">
                <span>Total Tax (CGST + SGST):</span>
                <span className="font-mono font-medium">₹{(cartTotalCgst + cartTotalSgst).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-emerald-500/20">
                <span>Invoice Grand Total:</span>
                <span className="font-mono text-emerald-400 text-lg">₹{cartGrandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Mode Selector */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-white uppercase tracking-wider block">
                Payment Mode & Settlement
              </label>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'Cash', label: 'Cash (Paid Full)', icon: Wallet },
                  { id: 'UPI', label: 'UPI QR (Paid Full)', icon: CreditCard },
                  { id: 'Credit_Khata', label: 'Farmer Khata (Credit)', icon: User },
                  { id: 'Partial_Credit', label: 'Partial Khata + Cash', icon: Split },
                ].map((mode) => {
                  const Icon = mode.icon;
                  const isSelected = paymentMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setPaymentMode(mode.id)}
                      className={`p-2.5 rounded-xl border text-left text-xs transition flex items-center gap-2 ${
                        isSelected
                          ? 'bg-emerald-600/20 border-emerald-500 text-white font-semibold'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`} />
                      <span>{mode.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Partial Credit Input */}
              {paymentMode === 'Partial_Credit' && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <label className="text-slate-300 font-medium">Upfront Cash / UPI Paid (₹):</label>
                  <input
                    type="number"
                    min="0"
                    max={cartGrandTotal}
                    step="10"
                    placeholder="Enter upfront amount paid"
                    value={cashAmountPaid}
                    onChange={(e) => setCashAmountPaid(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex justify-between text-slate-400 pt-1">
                    <span>Balance added to Farmer Khata:</span>
                    <span className="font-mono font-bold text-sky-400">₹{balanceToKhata.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Credit Status Warning if adding to Khata */}
              {balanceToKhata > 0 && currentCustomer && (
                <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                  isCreditExceeded 
                    ? 'bg-red-950/40 border-red-500/50 text-red-300' 
                    : 'bg-sky-950/40 border-sky-500/30 text-sky-200'
                }`}>
                  <div className="font-bold flex items-center gap-1.5">
                    {isCreditExceeded ? <AlertCircle className="w-4 h-4 text-red-400" /> : <ShieldCheck className="w-4 h-4 text-sky-400" />}
                    <span>{isCreditExceeded ? 'Credit Limit Exceeded!' : 'Khata Credit Assessment'}</span>
                  </div>
                  <div className="text-[11px] leading-relaxed">
                    Adding ₹{balanceToKhata.toFixed(2)} to {currentCustomer.farmer_name}'s Khata.
                    New balance will be <strong>₹{newProjectedKhataDue.toFixed(2)}</strong> / Limit: ₹{currentCustomer.credit_limit.toFixed(2)}.
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Finalize Button */}
              <button
                disabled={isSubmitting || cartItems.length === 0 || isCreditExceeded}
                onClick={handleFinalizeBill}
                className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider shadow-xl transition active:scale-98 flex items-center justify-center gap-2 ${
                  isSubmitting || cartItems.length === 0 || isCreditExceeded
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950'
                }`}
              >
                {isSubmitting ? (
                  <span>Executing ACID Checkout...</span>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4" />
                    <span>Finalize & Generate GST Tax Invoice</span>
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
