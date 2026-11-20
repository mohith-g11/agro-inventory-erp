import React from 'react';
import { 
  IndianRupee, 
  Package, 
  Users, 
  Clock, 
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2
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
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 text-sm">Loading Store Summary...</p>
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
    category_breakdown
  } = summaryData;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Store Overview
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Quick summary of stock, expiring batches, and farmer credit dues
        </p>
      </div>

      {/* 4 Clean Minimalist KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Stock Value */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Stock Value</span>
            <IndianRupee className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            ₹{total_stock_value?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {total_units_in_stock} total units in shop
          </div>
        </div>

        {/* KPI 2: Expiring Soon (< 30 Days) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Expiring &lt; 30 Days</span>
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {expiring_batches_count}
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
              Sell First
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Prioritize at billing counter
          </div>
        </div>

        {/* KPI 3: Low Stock Items */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Low Stock Items</span>
            <Package className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {low_stock_count} <span className="text-sm font-normal text-slate-500">Products</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Below reorder point</span>
            <button 
              onClick={onNavigateToInventory}
              className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
            >
              View →
            </button>
          </div>
        </div>

        {/* KPI 4: Total Farmer Credit Due */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Farmer Credit Due</span>
            <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            ₹{total_khata_pending?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Khata receivables pending
          </div>
        </div>
      </div>

      {/* Expiring Stock Watchlist (Sell First) Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Expiring Stock Watchlist (Sell First)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Earliest expiring batches that should be billed first to prevent dead stock
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/50">
            {expiring_batches_count} Batches
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4">Product & Brand</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Available</th>
                <th className="py-3 px-4 text-right">Price (₹)</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Days Left</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {expiring_batches && expiring_batches.length > 0 ? (
                expiring_batches.map((batch) => {
                  const isVeryUrgent = batch.days_to_expiry <= 15;
                  return (
                    <tr 
                      key={batch.batch_id} 
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {batch.batch_number}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {batch.product_name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {batch.brand}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {batch.category.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                        {batch.available_qty} {batch.base_unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium">
                        ₹{batch.selling_price?.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {batch.expiry_date}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
                          isVeryUrgent
                            ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}>
                          <Clock className="w-3.5 h-3.5" />
                          {batch.days_to_expiry} Days
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onNavigateToPOS(batch.product_id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 inline-flex items-center gap-1 shadow-sm"
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
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                    All active inventory batches have more than 30 days of shelf life.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Row: Compact Category Summary & Low Stock Reorder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category Breakdown */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Stock Valuation by Category
            </h3>
            <span className="text-xs text-slate-500">5 Categories</span>
          </div>

          <div className="space-y-3">
            {category_breakdown && category_breakdown.map((cat) => (
              <div key={cat.category} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {cat.category.replace('_', ' ')} ({cat.products_count} items)
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  ₹{cat.category_value?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Low Stock Reorder List
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              {low_stock_count} Items
            </span>
          </div>

          <div className="space-y-2.5">
            {low_stock_items && low_stock_items.slice(0, 4).map((item) => (
              <div key={item.product_id} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <div>
                  <div className="font-medium text-slate-800 dark:text-slate-200">{item.name}</div>
                  <div className="text-[11px] text-slate-500">{item.brand}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-amber-700 dark:text-amber-400">
                    {item.current_stock} / {item.reorder_level} {item.base_unit}
                  </div>
                  <div className="text-[10px] text-slate-400">Available / Reorder</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
