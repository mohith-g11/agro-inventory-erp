import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  Boxes, 
  UserX, 
  ShieldAlert, 
  CheckCircle2, 
  X, 
  Phone, 
  MessageCircle, 
  ArrowRight, 
  Trash2, 
  RotateCcw,
  Sparkles,
  History,
  AlertCircle
} from 'lucide-react';
import { fetchInventoryAlerts, adjustBatchStock, fetchStockAdjustments } from '../services/api';

export default function AlertsTab({ onNavigateToPOS, onNavigateToInventory, currentUser, onRefreshData }) {
  const [alerts, setAlerts] = useState(null);
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('expired'); // 'expired' | 'expiring' | 'low_stock' | 'high_credit' | 'history'

  // Sub-filter for expiring (30 vs 90 days)
  const [expiringHorizon, setExpiringHorizon] = useState('30'); // '30' | '90'

  // Stock Adjustment Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [adjustmentType, setAdjustmentType] = useState('Expired_WriteOff');
  const [qtyChange, setQtyChange] = useState(0);
  const [reason, setReason] = useState('');
  const [submittingAdj, setSubmittingAdj] = useState(false);
  const [adjModalError, setAdjModalError] = useState(null);

  const isAdmin = currentUser?.role === 'Admin';

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const [alertData, adjData] = await Promise.all([
        fetchInventoryAlerts(),
        isAdmin ? fetchStockAdjustments() : Promise.resolve([])
      ]);
      setAlerts(alertData);
      setAdjustments(adjData || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load inventory alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  // Open adjustment modal for a batch
  const handleOpenAdjustModal = (batch, defaultType = 'Expired_WriteOff') => {
    setSelectedBatch(batch);
    setAdjustmentType(defaultType);
    if (defaultType === 'Expired_WriteOff' || defaultType === 'Damaged' || defaultType === 'Return_To_Supplier') {
      setQtyChange(-Math.abs(batch.available_qty || 0));
      setReason(defaultType === 'Expired_WriteOff' ? `Expired stock written off (Batch ${batch.batch_number})` : '');
    } else {
      setQtyChange(0);
      setReason('');
    }
    setAdjModalError(null);
    setAdjustModalOpen(true);
  };

  const handleAdjustmentSubmit = async (e) => {
    e.preventDefault();
    setAdjModalError(null);

    const changeVal = Number(qtyChange);
    if (!changeVal || changeVal === 0) {
      setAdjModalError('Quantity change must be non-zero (negative for loss/write-off, positive for found stock).');
      return;
    }

    if (!reason.trim()) {
      setAdjModalError('Please enter a valid reason for this inventory adjustment.');
      return;
    }

    try {
      setSubmittingAdj(true);
      await adjustBatchStock(selectedBatch.batch_id, {
        adjustment_type: adjustmentType,
        quantity_change: changeVal,
        reason: reason.trim()
      });

      setAdjustModalOpen(false);
      loadAlerts();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error(err);
      setAdjModalError(err.message || 'Failed to apply stock adjustment.');
    } finally {
      setSubmittingAdj(false);
    }
  };

  const summary = alerts?.summary || {};

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Expiry Action Center & Loss Prevention
            </h1>
            <span className="text-xs bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 px-2 py-0.5 rounded-full font-bold">
              Real-time Alerts
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Monitor zero-waste inventory, write off dead stock, push near-expiry fertilizers, and reorder critical seeds.
          </p>
        </div>

        <button
          onClick={loadAlerts}
          className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
        >
          Refresh All Alerts
        </button>
      </div>

      {/* KPI ALERT CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Card 1: Expired Batches */}
        <button
          onClick={() => setActiveTab('expired')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeTab === 'expired'
              ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 ring-2 ring-red-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">
              Expired Dead Stock
            </span>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-red-700 dark:text-red-300 mt-2">
            {summary.expired_count || 0}
          </div>
          {isAdmin && summary.total_loss_exposure !== null && (
            <div className="text-[10px] text-red-600 dark:text-red-400 font-medium mt-1">
              ₹{Number(summary.total_loss_exposure).toFixed(2)} cost loss
            </div>
          )}
        </button>

        {/* Card 2: Expiring in 30 Days */}
        <button
          onClick={() => { setActiveTab('expiring'); setExpiringHorizon('30'); }}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeTab === 'expiring' && expiringHorizon === '30'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 ring-2 ring-amber-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Expiring in 30d
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-300 mt-2">
            {summary.expiring_30_count || 0}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-1">
            Priority sell / discount
          </div>
        </button>

        {/* Card 3: Expiring in 90 Days */}
        <button
          onClick={() => { setActiveTab('expiring'); setExpiringHorizon('90'); }}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeTab === 'expiring' && expiringHorizon === '90'
              ? 'bg-yellow-50 dark:bg-yellow-950/40 border-yellow-300 dark:border-yellow-800 ring-2 ring-yellow-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-yellow-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-yellow-700 dark:text-yellow-400 uppercase tracking-wider">
              Expiring in 90d
            </span>
            <Clock className="w-4 h-4 text-yellow-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-yellow-700 dark:text-yellow-300 mt-2">
            {summary.expiring_90_count || 0}
          </div>
          <div className="text-[10px] text-yellow-600 dark:text-yellow-400 font-medium mt-1">
            Watchlist batches
          </div>
        </button>

        {/* Card 4: Low Stock Products */}
        <button
          onClick={() => setActiveTab('low_stock')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeTab === 'low_stock'
              ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800 ring-2 ring-sky-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider">
              Low Stock Reorder
            </span>
            <Boxes className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-sky-700 dark:text-sky-300 mt-2">
            {summary.low_stock_count || 0}
          </div>
          <div className="text-[10px] text-sky-600 dark:text-sky-400 font-medium mt-1">
            Below reorder level
          </div>
        </button>

        {/* Card 5: High Credit Risk Farmers */}
        <button
          onClick={() => setActiveTab('high_credit')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeTab === 'high_credit'
              ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 ring-2 ring-purple-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-purple-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
              Credit Risk (&gt;80%)
            </span>
            <UserX className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-700 dark:text-purple-300 mt-2">
            {summary.high_credit_count || 0}
          </div>
          <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mt-1">
            Recovery reminders
          </div>
        </button>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-bold gap-6">
        <button
          onClick={() => setActiveTab('expired')}
          className={`pb-3 transition flex items-center gap-1.5 ${
            activeTab === 'expired'
              ? 'border-b-2 border-red-600 text-red-600 dark:text-red-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Expired Batches ({alerts?.expired_batches?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('expiring')}
          className={`pb-3 transition flex items-center gap-1.5 ${
            activeTab === 'expiring'
              ? 'border-b-2 border-amber-600 text-amber-600 dark:text-amber-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Near-Expiry Products</span>
        </button>

        <button
          onClick={() => setActiveTab('low_stock')}
          className={`pb-3 transition flex items-center gap-1.5 ${
            activeTab === 'low_stock'
              ? 'border-b-2 border-sky-600 text-sky-600 dark:text-sky-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Low Stock Reorder Desk ({alerts?.low_stock_products?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('high_credit')}
          className={`pb-3 transition flex items-center gap-1.5 ${
            activeTab === 'high_credit'
              ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <UserX className="w-4 h-4" />
          <span>Khata Debt Risk ({alerts?.high_credit_farmers?.length || 0})</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 transition flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-b-2 border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Adjustment Audit Trail ({adjustments.length})</span>
          </button>
        )}
      </div>

      {/* ─── TAB 1: EXPIRED BATCHES (ACTION CENTER) ─────────────────────────── */}
      {activeTab === 'expired' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-red-50/30 dark:bg-red-950/20">
            <div>
              <h2 className="text-sm font-bold text-red-900 dark:text-red-200">
                Action Required: Expired Inventory Batches
              </h2>
              <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">
                Insecticides Act & Fertilizer Control Order prohibit sale of expired agrochemicals. Write off dead stock or return to distributor.
              </p>
            </div>
            {isAdmin && summary.total_loss_exposure !== null && (
              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Cost Impact:</span>
                <div className="text-sm font-bold font-mono text-red-600 dark:text-red-400">
                  ₹{Number(summary.total_loss_exposure).toFixed(2)}
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Loading expired batches...</div>
          ) : (alerts?.expired_batches || []).length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mb-2" />
              <span>Great job! No expired batches found in the store inventory.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Batch Number</th>
                    <th className="py-3 px-4">Expiry Date</th>
                    <th className="py-3 px-4">Overdue By</th>
                    <th className="py-3 px-4 text-center">Dead Stock Qty</th>
                    {isAdmin && <th className="py-3 px-4 text-right">Landing Cost</th>}
                    <th className="py-3 px-4">Distributor</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {alerts.expired_batches.map((b) => (
                    <tr key={b.batch_id} className="hover:bg-red-50/40 dark:hover:bg-red-950/20 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{b.product_name}</div>
                        <div className="text-[11px] text-slate-400">{b.brand} • {b.category?.replace('_', ' ')}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {b.batch_number}
                      </td>
                      <td className="py-3 px-4 text-red-600 font-bold whitespace-nowrap">
                        {b.expiry_date}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
                          {b.days_overdue} days ago
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-red-700 font-mono">
                        {b.available_qty} {b.base_unit}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                          ₹{Number(b.purchase_price || 0).toFixed(2)}
                        </td>
                      )}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{b.supplier_name}</div>
                        {b.supplier_phone && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            <a href={`tel:${b.supplier_phone}`} className="hover:underline">{b.supplier_phone}</a>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isAdmin ? (
                          <button
                            onClick={() => handleOpenAdjustModal(b, 'Expired_WriteOff')}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm flex items-center gap-1 ml-auto transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Write Off / Loss</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">Admin Action Required</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: NEAR-EXPIRY PRODUCTS (30 & 90 DAYS) ───────────────────────── */}
      {activeTab === 'expiring' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Expiry Horizon:</span>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-bold">
                <button
                  onClick={() => setExpiringHorizon('30')}
                  className={`px-3 py-1 rounded-md transition ${
                    expiringHorizon === '30' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Next 30 Days ({alerts?.expiring_30_days?.length || 0})
                </button>
                <button
                  onClick={() => setExpiringHorizon('90')}
                  className={`px-3 py-1 rounded-md transition ${
                    expiringHorizon === '90' ? 'bg-yellow-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  31 to 90 Days ({alerts?.expiring_90_days?.length || 0})
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              {expiringHorizon === '30' ? 'Urgent sale candidates — bill first at counter!' : 'Early warning — push during sowing cycles.'}
            </p>
          </div>

          {(() => {
            const list = expiringHorizon === '30' ? alerts?.expiring_30_days : alerts?.expiring_90_days;
            if (!list || list.length === 0) {
              return (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No batches expiring within this timeframe.
                </div>
              );
            }
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <th className="py-3 px-4">Product</th>
                      <th className="py-3 px-4">Batch #</th>
                      <th className="py-3 px-4">Expiry Date</th>
                      <th className="py-3 px-4">Time Left</th>
                      <th className="py-3 px-4 text-center">Available Stock</th>
                      <th className="py-3 px-4 text-right">Selling Price</th>
                      <th className="py-3 px-4">Distributor</th>
                      <th className="py-3 px-4 text-right">Counter Push</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {list.map((b) => (
                      <tr key={b.batch_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{b.product_name}</div>
                          <div className="text-[11px] text-slate-400">{b.brand} • {b.category?.replace('_', ' ')}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {b.batch_number}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {b.expiry_date}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            b.days_to_expiry <= 15
                              ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                              : b.days_to_expiry <= 30
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300'
                          }`}>
                            {b.days_to_expiry} days left
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold font-mono">
                          {b.available_qty} {b.base_unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                          ₹{Number(b.selling_price || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-[11px]">
                          {b.supplier_name}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => onNavigateToPOS(b.product_id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm flex items-center gap-1 ml-auto transition"
                          >
                            <span>Bill at POS</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* ─── TAB 3: LOW STOCK REORDER DESK ───────────────────────────────────── */}
      {activeTab === 'low_stock' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-sky-50/40 dark:bg-sky-950/20">
            <div>
              <h2 className="text-sm font-bold text-sky-900 dark:text-sky-200">
                Purchase Order Reorder Desk
              </h2>
              <p className="text-[11px] text-sky-600 dark:text-sky-400 mt-0.5">
                Current unexpired stock has fallen below the safety reorder threshold. Contact preferred distributor to restock.
              </p>
            </div>
          </div>

          {(alerts?.low_stock_products || []).length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mb-2" />
              <span>All products have adequate stock above their reorder thresholds!</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Current Active Stock</th>
                    <th className="py-3 px-4 text-center">Safety Reorder Level</th>
                    <th className="py-3 px-4 text-center">Stock Deficit</th>
                    <th className="py-3 px-4">Preferred Distributor</th>
                    <th className="py-3 px-4 text-right">Quick Restock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {alerts.low_stock_products.map((p) => {
                    const deficit = Math.max(0, p.reorder_level - p.current_stock);
                    const isOutOfStock = p.current_stock === 0;

                    return (
                      <tr key={p.product_id} className="hover:bg-sky-50/30 dark:hover:bg-sky-950/20 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{p.name}</div>
                          <div className="text-[11px] text-slate-400">{p.brand} {p.barcode ? `• Barcode: ${p.barcode}` : ''}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {p.category?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold font-mono">
                          <span className={isOutOfStock ? 'text-red-600' : 'text-sky-700 dark:text-sky-400'}>
                            {p.current_stock} {p.base_unit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-500">
                          {p.reorder_level} {p.base_unit}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 font-mono">
                            -{deficit} {p.base_unit}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {p.preferred_supplier_name || 'Mysuru Agro Distributor'}
                          </div>
                          {p.preferred_supplier_phone && (
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-emerald-600" />
                              <a href={`tel:${p.preferred_supplier_phone}`} className="hover:underline font-mono">
                                {p.preferred_supplier_phone}
                              </a>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={onNavigateToInventory}
                            className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm flex items-center gap-1 ml-auto transition"
                          >
                            <span>+ Restock GRN</span>
                          </button>
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

      {/* ─── TAB 4: HIGH CREDIT RISK FARMERS (WHATSAPP REMINDERS) ─────────────── */}
      {activeTab === 'high_credit' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-purple-50/40 dark:bg-purple-950/20">
            <div>
              <h2 className="text-sm font-bold text-purple-900 dark:text-purple-200">
                Farmer Khata Recovery & Debt Aging Watchlist
              </h2>
              <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-0.5">
                Send 1-click WhatsApp reminders in Kannada & English to recover seasonal debts before harvesting cycles.
              </p>
            </div>
          </div>

          {(alerts?.high_credit_farmers || []).length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mb-2" />
              <span>No outstanding farmer debts found! All credit accounts are clean.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-4">Farmer Name</th>
                    <th className="py-3 px-4">Village</th>
                    <th className="py-3 px-4">Primary Crop</th>
                    <th className="py-3 px-4 text-right">Credit Due</th>
                    <th className="py-3 px-4 text-right">Credit Limit</th>
                    <th className="py-3 px-4">Credit Utilization</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {alerts.high_credit_farmers.map((f) => {
                    const pct = f.credit_utilization_pct || 0;
                    const isExceeded = pct >= 100;
                    const isHigh = pct >= 80;

                    const reminderText = encodeURIComponent(
                      `Namaskara ${f.farmer_name} avare, Sri Mathurshree Agro Kendra Mysuru rinda. Nimma khata balance Rs ${Number(f.total_credit_due).toFixed(2)}. Dayavittu marupavati madi. Dhanyavadagalu.`
                    );

                    return (
                      <tr key={f.customer_id} className="hover:bg-purple-50/30 dark:hover:bg-purple-950/20 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{f.farmer_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{f.phone}</div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                          {f.village}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {f.primary_crop}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-red-600 dark:text-red-400 text-sm">
                          ₹{Number(f.total_credit_due).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">
                          ₹{Number(f.credit_limit).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 min-w-[160px]">
                          <div className="flex justify-between text-[10px] font-bold mb-1">
                            <span className={isExceeded ? 'text-red-600' : isHigh ? 'text-amber-600' : 'text-emerald-600'}>
                              {pct}% used
                            </span>
                            <span className="text-slate-400">
                              ₹{(f.credit_limit - f.total_credit_due).toFixed(0)} left
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                isExceeded ? 'bg-red-600' : isHigh ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <a
                            href={`https://wa.me/91${f.phone}?text=${reminderText}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp Reminder</span>
                          </a>
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

      {/* ─── TAB 5: ADJUSTMENT AUDIT TRAIL (ADMIN ONLY) ───────────────────────── */}
      {activeTab === 'history' && isAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Stock Adjustments & Loss Write-Off Ledger
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Immutable audit trail of all manual stock adjustments, write-offs, and count reconciliations.
              </p>
            </div>
          </div>

          {adjustments.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No stock adjustments recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Batch Number</th>
                    <th className="py-3 px-4">Adjustment Type</th>
                    <th className="py-3 px-4 text-center">Qty Change</th>
                    <th className="py-3 px-4 text-right">Cost Impact (₹)</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Performed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {adjustments.map((a) => (
                    <tr key={a.adjustment_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {a.created_at?.slice(0, 16).replace('T', ' ')}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        {a.product_name}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {a.batch_number}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          a.adjustment_type === 'Expired_WriteOff'
                            ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                            : a.adjustment_type === 'Damaged'
                            ? 'bg-amber-100 text-amber-800'
                            : a.adjustment_type === 'Audit_Increase'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {a.adjustment_type?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        <span className={a.quantity_change > 0 ? 'text-emerald-600' : 'text-red-600'}>
                          {a.quantity_change > 0 ? `+${a.quantity_change}` : a.quantity_change} {a.base_unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        ₹{Number(a.cost_impact || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={a.reason}>
                        {a.reason}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {a.performed_by}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL: STOCK ADJUSTMENT / LOSS WRITE OFF ─────────────────────────── */}
      {adjustModalOpen && selectedBatch && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Record Stock Adjustment / Write-Off
                </h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  Product: <span className="font-semibold">{selectedBatch.product_name}</span> (Batch: {selectedBatch.batch_number})
                </div>
              </div>
              <button
                onClick={() => setAdjustModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAdjustmentSubmit} className="p-5 space-y-4">
              {adjModalError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs">
                  {adjModalError}
                </div>
              )}

              {/* Current Batch Info */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-slate-400">Current Stock:</div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 font-mono text-sm">
                    {selectedBatch.available_qty} {selectedBatch.base_unit}
                  </div>
                </div>
                {isAdmin && (
                  <div>
                    <div className="text-slate-400">Landing Cost / unit:</div>
                    <div className="font-bold text-slate-900 dark:text-slate-100 font-mono text-sm">
                      ₹{Number(selectedBatch.purchase_price || 0).toFixed(2)}
                    </div>
                  </div>
                )}
              </div>

              {/* Adjustment Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Adjustment Category *
                </label>
                <select
                  value={adjustmentType}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setAdjustmentType(newType);
                    if (newType === 'Expired_WriteOff' || newType === 'Damaged' || newType === 'Return_To_Supplier') {
                      setQtyChange(-Math.abs(selectedBatch.available_qty || 0));
                    } else if (newType === 'Audit_Increase') {
                      setQtyChange(1);
                    } else if (newType === 'Audit_Decrease') {
                      setQtyChange(-1);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Expired_WriteOff">Expired Dead Stock (Loss Write-Off)</option>
                  <option value="Damaged">Damaged / Leaked Container</option>
                  <option value="Return_To_Supplier">Return to Supplier / Distributor</option>
                  <option value="Audit_Decrease">Stock Audit Discrepancy (Missing)</option>
                  <option value="Audit_Increase">Stock Audit Discrepancy (Found/Surplus)</option>
                </select>
              </div>

              {/* Quantity Change */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Quantity Change ({selectedBatch.base_unit}) *
                </label>
                <input
                  type="number"
                  value={qtyChange}
                  onChange={(e) => setQtyChange(Number(e.target.value))}
                  placeholder="e.g. -10 for loss, +5 for surplus"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <div className="text-[11px] text-slate-400 mt-1">
                  New available batch stock will be:{' '}
                  <strong className="text-slate-900 dark:text-slate-100 font-mono">
                    {Math.max(0, (selectedBatch.available_qty || 0) + (Number(qtyChange) || 0))} {selectedBatch.base_unit}
                  </strong>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Reason / Statutory Remarks *
                </label>
                <textarea
                  rows="2"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Agrochemical past expiry date, packet punctured in transit, annual physical stock count..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdj || qtyChange === 0}
                  className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {submittingAdj ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Applying Adjustment...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Stock Adjustment</span>
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
