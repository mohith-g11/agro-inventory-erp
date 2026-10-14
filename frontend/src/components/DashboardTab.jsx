import React from 'react';
import { 
  AlertTriangle, 
  IndianRupee, 
  Package, 
  Users, 
  Clock, 
  CheckCircle, 
  ArrowRight,
  TrendingUp,
  ShieldAlert,
  Flame,
  BadgeAlert
} from 'lucide-react';

export default function DashboardTab({ 
  summaryData, 
  loading, 
  onNavigateToPOS, 
  onNavigateToInventory 
}) {
  if (loading || !summaryData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm">Loading Live Agro Kendra ERP Data...</p>
        </div>
      </div>
    );
  }

  const {
    total_stock_value,
    total_cost_value,
    total_units_in_stock,
    expiring_batches_count,
    expiring_batches,
    low_stock_count,
    low_stock_items,
    total_khata_pending,
    total_credit_limit_extended,
    category_breakdown
  } = summaryData;

  const khataUtilizationPct = total_credit_limit_extended > 0 
    ? Math.round((total_khata_pending / total_credit_limit_extended) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Page Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Executive Agro Operations Dashboard</h2>
          <p className="text-xs text-slate-400">
            Real-time FEFO batch clearance monitoring, stock valuation, and farmer credit ledger
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-medium text-emerald-400">Live Synchronized</span>
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Stock Value */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Stock Value</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">
            ₹{total_stock_value?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>{total_units_in_stock} Units in Store</span>
            <span className="text-slate-500 font-mono">Cost: ₹{total_cost_value?.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</span>
          </div>
          <div className="absolute top-0 right-0 h-1 w-full bg-emerald-500"></div>
        </div>

        {/* KPI 2: PROMINENT RED ALERT CARD for Batches Expiring in < 30 Days */}
        <div className="bg-gradient-to-br from-red-950/60 via-slate-900 to-slate-900 border-2 border-red-500/60 rounded-2xl p-5 shadow-lg shadow-red-950/40 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-red-400 animate-pulse" />
              Expiring &lt; 30 Days
            </span>
            <div className="w-9 h-9 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/40 animate-pulse">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-red-300">{expiring_batches_count}</span>
            <span className="text-xs font-semibold text-red-400 uppercase">Batches at Risk</span>
          </div>
          <div className="mt-2 text-xs text-red-200/80 font-medium">
            Requires immediate FEFO clearance billing!
          </div>
          <div className="absolute top-0 right-0 h-1 w-full bg-red-500 animate-pulse"></div>
        </div>

        {/* KPI 3: Low Stock Count */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Low Stock Items</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">
            {low_stock_count} <span className="text-sm font-normal text-slate-400">Products</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>Below reorder point</span>
            <button 
              onClick={onNavigateToInventory}
              className="text-amber-400 hover:text-amber-300 font-medium"
            >
              View list →
            </button>
          </div>
          <div className="absolute top-0 right-0 h-1 w-full bg-amber-500"></div>
        </div>

        {/* KPI 4: Total Farmer Khata Pending */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Farmer Khata Dues</span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-sky-300">
            ₹{total_khata_pending?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>{khataUtilizationPct}% Limit Utilized</span>
            <span className="text-slate-500">Max ₹{total_credit_limit_extended?.toLocaleString('en-IN')}</span>
          </div>
          <div className="absolute top-0 right-0 h-1 w-full bg-sky-500"></div>
        </div>
      </div>

      {/* Main Section: LIVE FEFO EXPIRY WATCHLIST TABLE */}
      <div className="bg-slate-900 border border-red-500/30 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800/80 bg-gradient-to-r from-red-950/40 via-slate-900 to-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-red-500/20 text-red-400">
                <BadgeAlert className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">
                FEFO Expiry Watchlist — High Risk Batches (&lt; 30 Days)
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Under the Insecticides Act & Fertilizer Control Order, expired stock cannot be sold legally. First-Expired First-Out (FEFO) prioritizes these batches for immediate dispatch.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-red-400 font-mono bg-red-500/10 px-3 py-1.5 rounded-xl border border-red-500/20">
              5 Critical Batches Detected
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 uppercase font-semibold tracking-wider border-b border-slate-800">
                <th className="py-3 px-4">Priority / Batch #</th>
                <th className="py-3 px-4">Product Name & Brand</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Available Stock</th>
                <th className="py-3 px-4 text-right">Selling Price</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Days Left</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {expiring_batches && expiring_batches.length > 0 ? (
                expiring_batches.map((batch, idx) => {
                  const isUltraCritical = batch.days_to_expiry <= 15;
                  return (
                    <tr 
                      key={batch.batch_id} 
                      className="hover:bg-slate-800/40 transition group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            idx === 0 ? 'bg-red-500 text-white shadow-sm shadow-red-500/50' : 'bg-slate-800 text-slate-300'
                          }`}>
                            #{idx + 1}
                          </span>
                          <span className="font-mono text-xs font-semibold text-emerald-400">
                            {batch.batch_number}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-100">{batch.product_name}</div>
                        <div className="text-[11px] text-slate-400">{batch.brand}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700/60">
                          {batch.category.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-bold text-white text-sm">
                          {batch.available_qty}
                        </span>
                        <span className="text-[11px] text-slate-400 ml-1">
                          {batch.base_unit}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-200">
                        ₹{batch.selling_price?.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {batch.expiry_date}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold font-mono ${
                            isUltraCritical
                              ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          }`}>
                            <Clock className="w-3 h-3" />
                            {batch.days_to_expiry} Days
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => onNavigateToPOS(batch.product_id)}
                          className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition active:scale-95"
                          title="Open in POS counter to bill this batch first"
                        >
                          Bill Now
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    All active inventory batches are within healthy validity periods (&gt; 30 Days).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Grid: Category Stock Breakdown & Low Stock Watch */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Inventory Valuation by Category
            </h3>
            <span className="text-xs text-slate-400">5 Agro Sectors</span>
          </div>

          <div className="space-y-4">
            {category_breakdown && category_breakdown.map((cat) => {
              const pct = total_stock_value > 0 ? (cat.category_value / total_stock_value) * 100 : 0;
              return (
                <div key={cat.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">
                      {cat.category.replace('_', ' ')} ({cat.products_count} Items)
                    </span>
                    <span className="font-mono font-semibold text-emerald-400">
                      ₹{cat.category_value?.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Low Stock Items Quick View */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-400" />
              Reorder Watchlist (&lt;= Reorder Level)
            </h3>
            <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              {low_stock_count} Items
            </span>
          </div>

          <div className="divide-y divide-slate-800/80">
            {low_stock_items && low_stock_items.slice(0, 4).map((item) => (
              <div key={item.product_id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-slate-100">{item.name}</div>
                  <div className="text-[11px] text-slate-400">{item.brand} • {item.category.replace('_', ' ')}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-amber-400 font-mono">
                    {item.current_stock} / {item.reorder_level} {item.base_unit}
                  </div>
                  <div className="text-[10px] text-slate-400">Stock vs Reorder Limit</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-center">
            <button
              onClick={onNavigateToInventory}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1"
            >
              Browse Complete Inventory & Batch Records →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
