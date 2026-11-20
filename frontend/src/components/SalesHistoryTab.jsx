import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  RotateCcw, 
  Search, 
  Calendar, 
  Filter, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Clock, 
  ArrowRight,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { fetchInvoices, fetchSalesReturns, createSalesReturn } from '../services/api';

export default function SalesHistoryTab({ onPrintInvoice, currentUser, onRefreshData }) {
  const [subView, setSubView] = useState('invoices'); // 'invoices' | 'returns'
  const [invoices, setInvoices] = useState([]);
  const [salesReturns, setSalesReturns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [paymentModeFilter, setPaymentModeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Return / Credit Note Modal State
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [returnItemsState, setReturnItemsState] = useState([]);
  const [refundMode, setRefundMode] = useState('Cash');
  const [returnReason, setReturnReason] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnModalError, setReturnModalError] = useState(null);

  // Expandable returns row
  const [expandedReturnId, setExpandedReturnId] = useState(null);

  const isAdmin = currentUser?.role === 'Admin';

  const loadInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (search) params.search = search;
      if (paymentModeFilter) params.payment_mode = paymentModeFilter;
      if (statusFilter) params.status = statusFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const data = await fetchInvoices(params);
      setInvoices(data || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch sales invoices');
    } finally {
      setLoading(false);
    }
  };

  const loadReturns = async () => {
    try {
      setLoading(true);
      const data = await fetchSalesReturns();
      setSalesReturns(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subView === 'invoices') {
      loadInvoices();
    } else {
      loadReturns();
    }
  }, [subView, paymentModeFilter, statusFilter, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (subView === 'invoices') {
      loadInvoices();
    }
  };

  // Open Return / Credit Note Modal
  const openReturnModal = (inv) => {
    setSelectedInvoice(inv);
    setReturnReason('');
    setReturnModalError(null);
    // Walk-ins can only receive Cash or UPI refund
    const initialMode = inv.customer_id ? (inv.payment_mode === 'Credit_Khata' ? 'Khata_Credit_Adjustment' : 'Cash') : 'Cash';
    setRefundMode(initialMode);

    // Prepare return items state
    const items = (inv.items || []).map((it) => ({
      invoice_item_id: it.item_id,
      product_name: it.product_name,
      batch_number: it.batch_number,
      qty_billed: it.qty_billed,
      unit_price: it.unit_price,
      gst_rate: it.gst_rate,
      line_total: it.line_total,
      quantity_returned: 0,
      restock_batch: true
    }));
    setReturnItemsState(items);
    setReturnModalOpen(true);
  };

  const handleItemReturnQtyChange = (itemId, val, maxQty) => {
    const num = Math.max(0, Math.min(Number(val) || 0, maxQty));
    setReturnItemsState(prev => prev.map(it => 
      it.invoice_item_id === itemId ? { ...it, quantity_returned: num } : it
    ));
  };

  const handleItemRestockToggle = (itemId) => {
    setReturnItemsState(prev => prev.map(it => 
      it.invoice_item_id === itemId ? { ...it, restock_batch: !it.restock_batch } : it
    ));
  };

  // Live refund calculation
  const totalCalculatedRefund = returnItemsState.reduce((sum, it) => {
    if (it.quantity_returned > 0 && it.qty_billed > 0) {
      const unitLine = it.line_total / it.qty_billed;
      return sum + (unitLine * it.quantity_returned);
    }
    return sum;
  }, 0);

  const handleSubmitReturn = async (e) => {
    e.preventDefault();
    setReturnModalError(null);

    const activeItems = returnItemsState
      .filter(it => it.quantity_returned > 0)
      .map(it => ({
        invoice_item_id: it.invoice_item_id,
        quantity_returned: it.quantity_returned,
        restock_batch: it.restock_batch
      }));

    if (activeItems.length === 0) {
      setReturnModalError('Please enter a return quantity greater than 0 for at least one item.');
      return;
    }

    if (!returnReason.trim()) {
      setReturnModalError('Please enter a reason for this return/credit note.');
      return;
    }

    try {
      setReturnSubmitting(true);
      await createSalesReturn(selectedInvoice.invoice_id, {
        refund_mode: refundMode,
        reason: returnReason.trim(),
        items: activeItems
      });

      setReturnModalOpen(false);
      loadInvoices();
      loadReturns();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error(err);
      setReturnModalError(err.message || 'Failed to process sales return.');
    } finally {
      setReturnSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Universal Sales Register & Returns
            </h1>
            <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
              GST Tax Invoices
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Browse complete counter and farmer sales, reprint official GST tax invoices, and issue Credit Notes.
          </p>
        </div>

        {/* Sub-view switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setSubView('invoices')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              subView === 'invoices'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Sales Invoices</span>
            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">
              {invoices.length}
            </span>
          </button>
          <button
            onClick={() => setSubView('returns')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              subView === 'returns'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Credit Notes (Returns)</span>
            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">
              {salesReturns.length}
            </span>
          </button>
        </div>
      </div>

      {/* FILTER BAR (for invoices sub-view) */}
      {subView === 'invoices' && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="md:col-span-4 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search Invoice #, Farmer Name, Phone, Village..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Payment Mode Filter */}
            <div className="md:col-span-2">
              <select
                value={paymentModeFilter}
                onChange={(e) => setPaymentModeFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Payment Modes</option>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Credit_Khata">Credit (Khata)</option>
                <option value="Partial_Credit">Partial Khata</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="md:col-span-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Invoice Status</option>
                <option value="Completed">Completed</option>
                <option value="Partially_Returned">Partially Returned</option>
                <option value="Returned">Fully Returned</option>
              </select>
            </div>

            {/* Date Range Start */}
            <div className="md:col-span-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Date Range End & Action */}
            <div className="md:col-span-2 flex gap-2">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center shrink-0"
              >
                Filter
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ERROR NOTICE */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadInvoices} className="font-bold underline text-xs">Retry</button>
        </div>
      )}

      {/* ─── SUB-VIEW 1: INVOICES LIST ────────────────────────────────────────── */}
      {subView === 'invoices' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Showing {invoices.length} Registered Sales Invoices
            </div>
            <button
              onClick={loadInvoices}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading sales invoices...
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No sales invoices found matching the current search & filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Payment Mode</th>
                    <th className="py-3 px-4 text-right">Taxable (₹)</th>
                    <th className="py-3 px-4 text-right">GST (₹)</th>
                    <th className="py-3 px-4 text-right">Grand Total</th>
                    <th className="py-3 px-4">Billed By</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invoices.map((inv) => {
                    const isWalkIn = !inv.customer_id;
                    const isFullyReturned = inv.status === 'Returned';
                    const isPartiallyReturned = inv.status === 'Partially_Returned';

                    return (
                      <tr key={inv.invoice_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                          {inv.invoice_number}
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {inv.invoice_date?.slice(0, 16).replace('T', ' ')}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {inv.farmer_name || 'Walk-in Customer'}
                          </div>
                          {inv.village && (
                            <div className="text-[11px] text-slate-400">
                              {inv.village} {inv.phone ? `• ${inv.phone}` : ''}
                            </div>
                          )}
                          {isWalkIn && (
                            <div className="text-[10px] text-slate-400">Counter Sale</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            inv.payment_mode === 'Cash'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : inv.payment_mode === 'UPI'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                              : inv.payment_mode === 'Credit_Khata'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                          }`}>
                            {inv.payment_mode.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300 font-mono">
                          ₹{Number(inv.subtotal || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500 font-mono text-[11px]">
                          ₹{(Number(inv.total_cgst || 0) + Number(inv.total_sgst || 0)).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100 font-mono">
                          ₹{Number(inv.grand_total || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                          {inv.billed_by || 'Staff'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isFullyReturned
                              ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                              : isPartiallyReturned
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}>
                            {inv.status || 'Completed'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Print Official GST Tax Invoice */}
                            <button
                              onClick={() => onPrintInvoice(inv.invoice_id)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-[11px] flex items-center gap-1 transition"
                              title="Print A4 / Thermal 80mm GST Invoice"
                            >
                              <Printer className="w-3.5 h-3.5 text-slate-500" />
                              <span>Print</span>
                            </button>

                            {/* Return / Credit Note (Admin Only) */}
                            {isAdmin && (
                              <button
                                onClick={() => openReturnModal(inv)}
                                disabled={isFullyReturned}
                                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] flex items-center gap-1 transition ${
                                  isFullyReturned
                                    ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
                                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 dark:text-amber-300'
                                }`}
                                title={isFullyReturned ? 'Already fully returned' : 'Issue Credit Note / Sales Return'}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Return</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── SUB-VIEW 2: CREDIT NOTES (SALES RETURNS) REGISTER ────────────────── */}
      {subView === 'returns' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                GST Credit Notes / Sales Returns Register
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Statutory record of stock returned and customer refunds/khata adjustments
              </p>
            </div>
            <button
              onClick={loadReturns}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading credit notes...
            </div>
          ) : salesReturns.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No sales returns or credit notes recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-4">Credit Note #</th>
                    <th className="py-3 px-4">Original Invoice</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Refund Mode</th>
                    <th className="py-3 px-4 text-right">Refund Amount</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Processed By</th>
                    <th className="py-3 px-4 text-center">Items</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {salesReturns.map((ret) => {
                    const isExpanded = expandedReturnId === ret.return_id;
                    return (
                      <React.Fragment key={ret.return_id}>
                        <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 font-mono font-bold text-amber-700 dark:text-amber-400">
                            {ret.return_number}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                            {ret.invoice_number}
                          </td>
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                            {ret.created_at?.slice(0, 16).replace('T', ' ')}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                            {ret.farmer_name}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {ret.refund_mode?.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-red-600 dark:text-red-400 font-mono">
                            -₹{Number(ret.total_refund_amount || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={ret.reason}>
                            {ret.reason}
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px]">
                            {ret.processed_by}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setExpandedReturnId(isExpanded ? null : ret.return_id)}
                              className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mx-auto hover:underline"
                            >
                              <span>{ret.items?.length || 0} items</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded details row */}
                        {isExpanded && (
                          <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                            <td colSpan="9" className="p-4 pl-12">
                              <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                  Items Credited Under {ret.return_number}
                                </div>
                                <div className="space-y-1.5">
                                  {(ret.items || []).map((it, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400 py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                                      <div>
                                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                                          {it.product_name}
                                        </span>{' '}
                                        <span className="text-[11px] text-slate-400">
                                          (Batch: {it.batch_number})
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <span className="text-[11px]">
                                          Returned: <strong>{it.quantity_returned}</strong> units
                                        </span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                          it.restock_batch ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-red-100 text-red-800'
                                        }`}>
                                          {it.restock_batch ? 'Restocked in Batch' : 'Discarded / Loss'}
                                        </span>
                                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                          ₹{Number(it.refund_line_total || 0).toFixed(2)}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL: ISSUE CREDIT NOTE / RETURN ─────────────────────────────────── */}
      {returnModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
              <div>
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-amber-600" />
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    Issue GST Credit Note / Sales Return
                  </h3>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Invoice <span className="font-mono font-bold">{selectedInvoice.invoice_number}</span> • Customer: {selectedInvoice.farmer_name || 'Walk-in Customer'}
                </div>
              </div>
              <button
                onClick={() => setReturnModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitReturn} className="p-5 overflow-y-auto space-y-5 flex-1">
              {returnModalError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs">
                  {returnModalError}
                </div>
              )}

              {/* Items Table for Return */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Select Items & Quantities to Return
                </label>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Product / Batch</th>
                        <th className="py-2.5 px-3 text-center">Billed Qty</th>
                        <th className="py-2.5 px-3 text-center">Return Qty</th>
                        <th className="py-2.5 px-3 text-center">Restock?</th>
                        <th className="py-2.5 px-3 text-right">Refund Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {returnItemsState.map((it) => {
                        const unitLine = it.qty_billed > 0 ? it.line_total / it.qty_billed : 0;
                        const lineRefund = unitLine * it.quantity_returned;

                        return (
                          <tr key={it.invoice_item_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {it.product_name}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                Batch: {it.batch_number} • ₹{it.unit_price} + {it.gst_rate}% GST
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold">
                              {it.qty_billed}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="number"
                                min="0"
                                max={it.qty_billed}
                                value={it.quantity_returned}
                                onChange={(e) => handleItemReturnQtyChange(it.invoice_item_id, e.target.value, it.qty_billed)}
                                className="w-20 px-2 py-1 text-center font-bold text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={it.restock_batch}
                                onChange={() => handleItemRestockToggle(it.invoice_item_id)}
                                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                              ₹{lineRefund.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Refund Mode Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Refund / Settlement Mode
                  </label>
                  <select
                    value={refundMode}
                    onChange={(e) => setRefundMode(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Cash">Cash (Store Counter)</option>
                    <option value="UPI">UPI / Digital Refund</option>
                    {selectedInvoice.customer_id && (
                      <option value="Khata_Credit_Adjustment">
                        Khata Credit Adjustment (Reduce Farmer Debt)
                      </option>
                    )}
                  </select>
                  {!selectedInvoice.customer_id && (
                    <div className="text-[11px] text-slate-400 mt-1">
                      Walk-in counter customers receive immediate Cash or UPI refund.
                    </div>
                  )}
                </div>

                {/* Refund Total Summary */}
                <div className="bg-amber-50 dark:bg-amber-950/40 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/50 flex flex-col justify-center">
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider">
                    Total Credit Note Value
                  </div>
                  <div className="text-2xl font-bold font-mono text-amber-800 dark:text-amber-300 mt-0.5">
                    ₹{totalCalculatedRefund.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Reason for Return */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Reason for Return / Credit Note *
                </label>
                <textarea
                  rows="2"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g., Unopened packet returned, farmer changed crop plan, defect/leakage, etc."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReturnModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={returnSubmitting || totalCalculatedRefund <= 0}
                  className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-1.5 transition ${
                    returnSubmitting || totalCalculatedRefund <= 0
                      ? 'bg-amber-300 dark:bg-amber-800 cursor-not-allowed'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {returnSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Generating Credit Note...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm & Issue Credit Note (₹{totalCalculatedRefund.toFixed(2)})</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
