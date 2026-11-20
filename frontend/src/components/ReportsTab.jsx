import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  FileText, 
  Download, 
  ShieldAlert, 
  TrendingUp, 
  Calendar, 
  Layers, 
  CheckCircle2, 
  Building2, 
  Users, 
  Boxes, 
  Receipt, 
  Banknote, 
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { fetchAnalyticsReport, fetchGstReports, fetchAuditLogs, downloadCsvReport } from '../services/api';

export default function ReportsTab({ currentUser }) {
  const [activeSubTab, setActiveSubTab] = useState('analytics'); // 'analytics' | 'gst' | 'exports' | 'audit'
  const [analytics, setAnalytics] = useState(null);
  const [gstData, setGstData] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exportingType, setExportingType] = useState(null);

  const isAdmin = currentUser?.role === 'Admin';

  const loadAllReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const [ana, gst, logs] = await Promise.all([
        fetchAnalyticsReport(),
        fetchGstReports(),
        fetchAuditLogs(100)
      ]);
      setAnalytics(ana);
      setGstData(gst);
      setAuditLogs(logs || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load enterprise reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadAllReports();
    }
  }, [isAdmin]);

  const handleDownload = async (reportType) => {
    try {
      setExportingType(reportType);
      await downloadCsvReport(reportType);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExportingType(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center max-w-lg mx-auto mt-12 shadow-sm">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
          Admin Access Required
        </h2>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          The Enterprise Analytics, GST Tax Registers, and Statutory CA Export desks contain confidential business margin data and are restricted to administrators.
        </p>
      </div>
    );
  }

  const kpis = analytics?.kpis || {};
  const trend = analytics?.daily_sales_trend || [];
  const paymentSplit = analytics?.payment_mode_split || {};
  const categories = analytics?.category_breakdown || [];
  const topProducts = analytics?.top_products || [];
  const villages = analytics?.village_demand || [];

  // Trend math for pure SVG
  const maxSale = trend.reduce((m, d) => Math.max(m, d.sales || 0), 1000);
  const chartHeight = 160;
  const chartWidth = 500;

  // Payment split totals
  const totalSplitSales = (paymentSplit.Cash || 0) + (paymentSplit.UPI || 0) + (paymentSplit.Credit_Khata || 0) + (paymentSplit.Partial_Credit || 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Enterprise Analytics & GST Tax Desk
            </h1>
            <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
              CA & Audit Ready
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Store Performance KPIs, Pure SVG Trends, GSTR-1 & HSN Tax Registers, and One-Click UTF-8 Excel CSV Exports.
          </p>
        </div>

        {/* Sub-tab pills */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setActiveSubTab('analytics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'analytics'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>BI Analytics</span>
          </button>
          <button
            onClick={() => setActiveSubTab('gst')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'gst'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>GST / CA Filing</span>
          </button>
          <button
            onClick={() => setActiveSubTab('exports')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'exports'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV Exports</span>
          </button>
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'audit'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Audit Trail</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center text-slate-400 text-xs">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading enterprise data...
        </div>
      ) : (
        <>
          {/* ─── SUB-TAB 1: BI ANALYTICS ────────────────────────────────────────── */}
          {activeSubTab === 'analytics' && (
            <div className="space-y-6">
              {/* Top 6 KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Today's Sales</div>
                  <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                    ₹{Number(kpis.today_sales || 0).toFixed(2)}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">This Month Sales</div>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
                    ₹{Number(kpis.month_sales || 0).toFixed(2)}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Revenue</div>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
                    ₹{Number(kpis.total_revenue || 0).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{kpis.total_invoices || 0} invoices billed</div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="text-[11px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Khata Outstanding</div>
                  <div className="text-xl font-bold font-mono text-red-600 dark:text-red-400 mt-1">
                    ₹{Number(kpis.total_outstanding_khata || 0).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{kpis.active_khata_farmers || 0} active farmers</div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Stock Valuation</div>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
                    ₹{Number(kpis.total_inventory_valuation || 0).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Landing cost basis</div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Gross Margin (COGS)</div>
                  <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                    ₹{Number(kpis.gross_profit || 0).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Realized sales profit</div>
                </div>
              </div>

              {/* Grid: 14-Day Sales Trend (Pure SVG) & Payment Split */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* 14-Day Sales Trend Bar Chart (Pure SVG) */}
                <div className="lg:col-span-8 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        14-Day Sales Revenue Trend
                      </h3>
                      <p className="text-[11px] text-slate-400">Daily gross counter turnover</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                      Peak: ₹{maxSale.toFixed(0)}
                    </span>
                  </div>

                  {trend.length === 0 ? (
                    <div className="h-44 flex items-center justify-center text-xs text-slate-400">
                      No sales recorded in the past 14 days.
                    </div>
                  ) : (
                    <div className="w-full overflow-x-auto">
                      <svg 
                        viewBox={`0 0 ${chartWidth} ${chartHeight + 30}`} 
                        className="w-full h-48 select-none"
                      >
                        {/* Grid lines */}
                        <line x1="0" y1="20" x2={chartWidth} y2="20" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeDasharray="3 3" />
                        <line x1="0" y1="80" x2={chartWidth} y2="80" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeDasharray="3 3" />
                        <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="currentColor" className="text-slate-200 dark:text-slate-700" />

                        {/* Bars */}
                        {trend.map((d, idx) => {
                          const barWidth = 22;
                          const spacing = (chartWidth - 40) / Math.max(1, trend.length);
                          const x = 20 + idx * spacing;
                          const heightRatio = d.sales / maxSale;
                          const barHeight = Math.max(4, heightRatio * (chartHeight - 30));
                          const y = chartHeight - barHeight;

                          return (
                            <g key={idx} className="group">
                              {/* Hover tooltip / Label */}
                              <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={barHeight}
                                rx="4"
                                className="fill-emerald-600 hover:fill-emerald-500 transition-colors cursor-pointer"
                              />
                              {/* Value label on top of bar */}
                              <text
                                x={x + barWidth / 2}
                                y={y - 5}
                                textAnchor="middle"
                                className="text-[9px] fill-slate-500 dark:fill-slate-400 font-mono font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                ₹{d.sales.toFixed(0)}
                              </text>
                              {/* Date label under chart */}
                              <text
                                x={x + barWidth / 2}
                                y={chartHeight + 15}
                                textAnchor="middle"
                                className="text-[10px] fill-slate-400 font-mono"
                              >
                                {d.date?.slice(5)}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  )}
                </div>

                {/* Payment Mode Breakdown */}
                <div className="lg:col-span-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Payment Mode Distribution
                    </h3>
                    <p className="text-[11px] text-slate-400">Cash vs UPI vs Seasonal Credit</p>

                    {/* Stacked Bar */}
                    <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex mt-4 shadow-inner">
                      {totalSplitSales > 0 && (
                        <>
                          <div
                            style={{ width: `${((paymentSplit.Cash || 0) / totalSplitSales) * 100}%` }}
                            className="bg-emerald-500 h-full"
                            title={`Cash: ₹${(paymentSplit.Cash || 0).toFixed(2)}`}
                          />
                          <div
                            style={{ width: `${((paymentSplit.UPI || 0) / totalSplitSales) * 100}%` }}
                            className="bg-purple-500 h-full"
                            title={`UPI: ₹${(paymentSplit.UPI || 0).toFixed(2)}`}
                          />
                          <div
                            style={{ width: `${((paymentSplit.Credit_Khata || 0) / totalSplitSales) * 100}%` }}
                            className="bg-amber-500 h-full"
                            title={`Credit Khata: ₹${(paymentSplit.Credit_Khata || 0).toFixed(2)}`}
                          />
                          <div
                            style={{ width: `${((paymentSplit.Partial_Credit || 0) / totalSplitSales) * 100}%` }}
                            className="bg-blue-500 h-full"
                            title={`Partial Credit: ₹${(paymentSplit.Partial_Credit || 0).toFixed(2)}`}
                          />
                        </>
                      )}
                    </div>

                    {/* Legend */}
                    <div className="mt-4 space-y-2.5 text-xs">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-emerald-500" />
                          <span className="text-slate-700 dark:text-slate-300 font-semibold">Cash</span>
                        </div>
                        <span className="font-mono font-bold">₹{Number(paymentSplit.Cash || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-purple-500" />
                          <span className="text-slate-700 dark:text-slate-300 font-semibold">UPI (PhonePe / GPay)</span>
                        </div>
                        <span className="font-mono font-bold">₹{Number(paymentSplit.UPI || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-amber-500" />
                          <span className="text-slate-700 dark:text-slate-300 font-semibold">Credit (Khata)</span>
                        </div>
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                          ₹{Number(paymentSplit.Credit_Khata || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-blue-500" />
                          <span className="text-slate-700 dark:text-slate-300 font-semibold">Partial Credit</span>
                        </div>
                        <span className="font-mono font-bold">₹{Number(paymentSplit.Partial_Credit || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex justify-between">
                    <span>Total Sales Split:</span>
                    <strong className="font-mono text-slate-900 dark:text-slate-100">₹{totalSplitSales.toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              {/* Grid: Category Breakdown & Top 5 Products */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Category Performance */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
                    Category Revenue Contribution
                  </h3>
                  <div className="space-y-3">
                    {categories.map((c, i) => {
                      const maxCat = categories[0]?.total_revenue || 1;
                      const pct = ((c.total_revenue || 0) / maxCat) * 100;
                      return (
                        <div key={i} className="text-xs">
                          <div className="flex justify-between font-semibold mb-1">
                            <span className="text-slate-800 dark:text-slate-200">{c.category?.replace(/_/g, ' ')}</span>
                            <span className="font-mono">₹{Number(c.total_revenue || 0).toFixed(2)} ({c.total_quantity} sold)</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top 5 Best-Selling Products */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
                    Top 5 Best-Selling Products
                  </h3>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {topProducts.map((p, i) => (
                      <div key={p.product_id} className="py-2.5 flex justify-between items-center">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span className="text-[10px] w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono">
                              {i + 1}
                            </span>
                            <span>{p.name}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 pl-5.5">{p.brand} • {p.category?.replace(/_/g, ' ')}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                            ₹{Number(p.revenue || 0).toFixed(2)}
                          </div>
                          <div className="text-[11px] text-slate-400">{p.quantity_sold} sold</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Village Demand & Debt Concentration */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Mysuru Village Demand & Farmer Khata Concentration
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                        <th className="py-3 px-4">Village Name</th>
                        <th className="py-3 px-4 text-center">Active Farmers</th>
                        <th className="py-3 px-4 text-right">Total Purchases (₹)</th>
                        <th className="py-3 px-4 text-right">Khata Debt Concentration (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {villages.map((v, i) => (
                        <tr key={i} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">{v.village}</td>
                          <td className="py-3 px-4 text-center font-semibold">{v.farmer_count}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                            ₹{Number(v.total_purchase || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-red-600 dark:text-red-400">
                            ₹{Number(v.village_credit_due || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── SUB-TAB 2: GST / CA TAX DESK ─────────────────────────────────── */}
          {activeSubTab === 'gst' && gstData && (
            <div className="space-y-6">
              {/* Store & Tax Slabs Summary */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {gstData.store?.name}
                    </h2>
                    <div className="text-xs text-slate-500 mt-0.5">
                      GSTIN: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{gstData.store?.gstin}</span> • State Code: 29 (Karnataka)
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDownload('gstr1')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm flex items-center gap-1.5 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export GSTR-1 CSV</span>
                    </button>
                    <button
                      onClick={() => handleDownload('hsn')}
                      className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm flex items-center gap-1.5 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export HSN CSV</span>
                    </button>
                  </div>
                </div>

                {/* GST Slab Totals Cards */}
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Slab-wise GST Liability Summary
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(gstData.slab_totals || []).map((slab, i) => (
                      <div key={i} className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          GST Slab {slab.gst_slab}%
                        </div>
                        <div className="text-xs text-slate-500 mt-1">Taxable: ₹{Number(slab.taxable_value || 0).toFixed(2)}</div>
                        <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                          Total Tax: ₹{Number(slab.total_tax || 0).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* HSN Summary Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    HSN / SAC Summary (Table 12 of GSTR-1)
                  </h3>
                  <span className="text-xs text-slate-400">Total HSN Codes: {gstData.hsn_summary?.length || 0}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                        <th className="py-3 px-4">HSN Code</th>
                        <th className="py-3 px-4">Description / Active Ingredient</th>
                        <th className="py-3 px-4 text-center">UQC Unit</th>
                        <th className="py-3 px-4 text-center">Total Qty</th>
                        <th className="py-3 px-4 text-right">Taxable Value (₹)</th>
                        <th className="py-3 px-4 text-right">CGST (₹)</th>
                        <th className="py-3 px-4 text-right">SGST (₹)</th>
                        <th className="py-3 px-4 text-right">Total Tax (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(gstData.hsn_summary || []).map((hsn, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {hsn.hsn_code}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                            {hsn.description}
                          </td>
                          <td className="py-3 px-4 text-center">{hsn.uqc}</td>
                          <td className="py-3 px-4 text-center font-bold font-mono">{hsn.total_qty}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold">
                            ₹{Number(hsn.total_taxable_value || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-500">
                            ₹{Number(hsn.total_cgst || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-500">
                            ₹{Number(hsn.total_sgst || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            ₹{Number(hsn.total_tax || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* GSTR-1 Sales Register Preview */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    GSTR-1 Outward Sales Register (B2C & Registered)
                  </h3>
                  <span className="text-xs text-slate-400">Showing {gstData.gstr1_sales_register?.length || 0} Invoices</span>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800 sticky top-0">
                      <tr>
                        <th className="py-3 px-4">Invoice #</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Customer Name</th>
                        <th className="py-3 px-4">Place of Supply</th>
                        <th className="py-3 px-4 text-right">Taxable (₹)</th>
                        <th className="py-3 px-4 text-right">CGST (₹)</th>
                        <th className="py-3 px-4 text-right">SGST (₹)</th>
                        <th className="py-3 px-4 text-right">Total Invoice (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(gstData.gstr1_sales_register || []).map((inv) => (
                        <tr key={inv.invoice_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                            {inv.invoice_number}
                          </td>
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{inv.invoice_date?.slice(0, 10)}</td>
                          <td className="py-3 px-4 font-semibold">{inv.customer_name}</td>
                          <td className="py-3 px-4 text-slate-600">{inv.place_of_supply}</td>
                          <td className="py-3 px-4 text-right font-mono">₹{Number(inv.taxable_value || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-mono text-slate-500">₹{Number(inv.total_cgst || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-mono text-slate-500">₹{Number(inv.total_sgst || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                            ₹{Number(inv.grand_total || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── SUB-TAB 3: ONE-CLICK CSV EXPORT CENTER ────────────────────────── */}
          {activeSubTab === 'exports' && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Statutory CA & Excel CSV Export Center
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Downloads preformatted UTF-8 BOM CSV files with complete Kannada / Rupee (₹) symbol integrity.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Sales Register */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition space-y-3">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100">Sales Register CSV</h3>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Complete invoice-by-invoice audit trail with customer info, payment modes, and tax amounts.
                  </p>
                  <button
                    onClick={() => handleDownload('sales')}
                    disabled={exportingType === 'sales'}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{exportingType === 'sales' ? 'Exporting...' : 'Download Sales CSV'}</span>
                  </button>
                </div>

                {/* 2. GSTR-1 Format */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100">GSTR-1 Tax Return CSV</h3>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Official GST portal upload format with B2C supply rates, invoice dates, and state tax codes.
                  </p>
                  <button
                    onClick={() => handleDownload('gstr1')}
                    disabled={exportingType === 'gstr1'}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{exportingType === 'gstr1' ? 'Exporting...' : 'Download GSTR-1 CSV'}</span>
                  </button>
                </div>

                {/* 3. HSN Summary */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition space-y-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100">HSN Summary CSV</h3>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Table 12 summary grouped by HSN code, chemical composition, UQC units, and slab tax.
                  </p>
                  <button
                    onClick={() => handleDownload('hsn')}
                    disabled={exportingType === 'hsn'}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{exportingType === 'hsn' ? 'Exporting...' : 'Download HSN CSV'}</span>
                  </button>
                </div>

                {/* 4. Inventory Master */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition space-y-3">
                  <div className="flex items-center gap-2">
                    <Boxes className="w-5 h-5 text-sky-600" />
                    <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100">Inventory Master CSV</h3>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Full product & batch inventory with barcodes, batch numbers, expiry dates, and landing costs.
                  </p>
                  <button
                    onClick={() => handleDownload('inventory')}
                    disabled={exportingType === 'inventory'}
                    className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{exportingType === 'inventory' ? 'Exporting...' : 'Download Inventory CSV'}</span>
                  </button>
                </div>

                {/* 5. Khata Debt Aging */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-600" />
                    <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100">Farmer Khata Aging CSV</h3>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Farmer credit balances, phone numbers, villages, and credit utilization percentages.
                  </p>
                  <button
                    onClick={() => handleDownload('khata_aging')}
                    disabled={exportingType === 'khata_aging'}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{exportingType === 'khata_aging' ? 'Exporting...' : 'Download Khata Aging CSV'}</span>
                  </button>
                </div>

                {/* 6. Stock Adjustments */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-600" />
                    <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100">Stock Adjustments Audit CSV</h3>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Full ledger of dead stock write-offs, damages, and audit discrepancies with cost impacts.
                  </p>
                  <button
                    onClick={() => handleDownload('stock_adjustments')}
                    disabled={exportingType === 'stock_adjustments'}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{exportingType === 'stock_adjustments' ? 'Exporting...' : 'Download Adjustments CSV'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── SUB-TAB 4: AUDIT TRAIL VIEWER ─────────────────────────────────── */}
          {activeSubTab === 'audit' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    System Security & Accountability Audit Trail
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Immutable event log of sales, repayments, stock adjustments, credit limit changes, and product updates.
                  </p>
                </div>
                <span className="text-xs text-slate-400">Recent {auditLogs.length} events</span>
              </div>

              {auditLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No audit logs recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Action Type</th>
                        <th className="py-3 px-4">Entity</th>
                        <th className="py-3 px-4">Summary</th>
                        <th className="py-3 px-4">Performed By</th>
                        <th className="py-3 px-4">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {auditLogs.map((log) => (
                        <tr key={log.log_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                            {log.created_at?.slice(0, 19).replace('T', ' ')}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {log.action_type}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                            {log.entity_type} {log.entity_id ? `(${log.entity_id})` : ''}
                          </td>
                          <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium max-w-md truncate" title={log.summary}>
                            {log.summary}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                            {log.performed_by}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              log.role === 'Admin' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                            }`}>
                              {log.role}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
