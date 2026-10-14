import React, { useState } from 'react';
import { 
  Users, 
  MapPin, 
  Sprout, 
  IndianRupee, 
  ShieldCheck, 
  AlertTriangle, 
  Phone, 
  CheckCircle2, 
  ArrowUpRight,
  Receipt,
  Search
} from 'lucide-react';

export default function KhataLedgerTab({ 
  customers = [], 
  invoices = [], 
  loading,
  onNavigateToPOS
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCustomers = customers.filter(c => 
    c.farmer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.village.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.primary_crop.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  const totalOutstanding = customers.reduce((sum, c) => sum + (c.total_credit_due || 0), 0);
  const totalLimit = customers.reduce((sum, c) => sum + (c.credit_limit || 0), 0);
  const overallUtilization = totalLimit > 0 ? ((totalOutstanding / totalLimit) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Farmer Khata Ledger & Seasonal Credit Control
          </h2>
          <p className="text-xs text-slate-400">
            Mysuru Belt Agricultural Accounts • Post-Harvest Settlement Cycle
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Farmer, Village, or Crop..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Top 3 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Total Outstanding Farmer Credit
          </div>
          <div className="text-2xl font-extrabold text-sky-300">
            ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Across {customers.length} registered agrarian khata accounts
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Total Authorized Credit Facility
          </div>
          <div className="text-2xl font-extrabold text-white">
            ₹{totalLimit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-emerald-400 mt-2 flex items-center gap-1 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            Seasonal Credit Guarantee Active
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Overall Credit Exposure Ratio
          </div>
          <div className="text-2xl font-extrabold text-amber-300">
            {overallUtilization}%
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Remaining Buffer: ₹{(totalLimit - totalOutstanding).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Farmer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((farmer) => {
          const utilPct = Number(farmer.credit_utilization_pct || 0);
          const isHighRisk = utilPct >= 75;
          const isModerate = utilPct >= 40 && utilPct < 75;
          const isClear = farmer.total_credit_due === 0;

          return (
            <div
              key={farmer.customer_id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-white text-base">
                    {farmer.farmer_name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                    <Phone className="w-3 h-3 text-slate-500" />
                    <span className="font-mono">{farmer.phone}</span>
                  </div>
                </div>

                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isClear
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : isHighRisk
                    ? 'bg-red-500/10 text-red-400 border-red-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                  {isClear ? 'Khata Clear' : isHighRisk ? 'High Due' : 'Active Khata'}
                </span>
              </div>

              {/* Village & Crop Badges */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700/60 font-medium">
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  {farmer.village}
                </span>

                <span className="inline-flex items-center gap-1 bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700/60 font-medium">
                  <Sprout className="w-3 h-3 text-emerald-400" />
                  {farmer.primary_crop}
                </span>
              </div>

              {/* Credit Status & Meter */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Outstanding Due:</span>
                  <span className="font-bold font-mono text-sky-400">
                    ₹{farmer.total_credit_due.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Credit Limit:</span>
                  <span className="font-mono text-slate-300">
                    ₹{farmer.credit_limit.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Available Limit:</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    ₹{farmer.available_credit.toFixed(2)}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="pt-1">
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>Credit Utilization</span>
                    <span>{utilPct}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isHighRisk 
                          ? 'bg-red-500' 
                          : isModerate 
                          ? 'bg-amber-500' 
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(utilPct, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Historical Invoices Ledger */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Khata Billing Ledger & Recent Invoices
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {invoices.length} Invoices Recorded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px]">
                <th className="py-2.5 px-4">Invoice #</th>
                <th className="py-2.5 px-4">Farmer Name & Village</th>
                <th className="py-2.5 px-4">Date & Time</th>
                <th className="py-2.5 px-4 text-right">Grand Total (₹)</th>
                <th className="py-2.5 px-4">Payment Mode</th>
                <th className="py-2.5 px-4 text-right">Amount Paid</th>
                <th className="py-2.5 px-4 text-right">Added to Khata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {invoices.map((inv) => (
                <tr key={inv.invoice_id} className="hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-mono font-semibold text-emerald-400">
                    {inv.invoice_number}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-200">{inv.farmer_name}</div>
                    <div className="text-[11px] text-slate-400">{inv.village}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400">
                    {inv.invoice_date}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-white">
                    ₹{inv.grand_total.toFixed(2)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                      inv.payment_mode === 'Cash' || inv.payment_mode === 'UPI'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                    }`}>
                      {inv.payment_mode.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-300">
                    ₹{inv.amount_paid.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-sky-400">
                    {inv.balance_added_to_khata > 0 ? `+₹${inv.balance_added_to_khata.toFixed(2)}` : '₹0.00'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
