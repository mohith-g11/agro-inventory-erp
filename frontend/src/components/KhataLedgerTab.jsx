import React, { useState } from 'react';
import { 
  Users, 
  MapPin, 
  Sprout, 
  Phone, 
  Receipt, 
  Search,
  Plus
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
  const farmersWithDueCount = customers.filter(c => (c.total_credit_due || 0) > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Farmer Khata (Credit Ledger)
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Track seasonal credit balances, authorized credit limits, and harvest settlements
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Farmer, Village, or Crop..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-600"
          />
        </div>
      </div>

      {/* Top 2 Essential Summary Cards (Clutter Removed) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Total Pending Market Credit
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
            ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Outstanding seasonal khata dues across Mysuru region
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Farmers with Pending Dues
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
            {farmersWithDueCount} <span className="text-sm font-normal text-slate-500">of {customers.length} Accounts</span>
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Accounts with active credit balances
          </div>
        </div>
      </div>

      {/* Clean Structured Farmer Ledger Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Farmer Khata Accounts ({filteredCustomers.length} Farmers)
          </span>
          <span className="text-xs text-slate-400">
            Nanjangud, T. Narasipura, Hunsur, Bannur, HD Kote
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4">Farmer Name & Phone</th>
                <th className="py-3 px-4">Village</th>
                <th className="py-3 px-4">Primary Crop</th>
                <th className="py-3 px-4 text-right">Credit Limit</th>
                <th className="py-3 px-4 text-right">Amount Due</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCustomers.map((farmer) => {
                const isClear = farmer.total_credit_due === 0;

                return (
                  <tr key={farmer.customer_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-white text-base">
                        {farmer.farmer_name}
                      </div>
                      <div className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {farmer.phone}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                      {farmer.village}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {farmer.primary_crop}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                      ₹{farmer.credit_limit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <span className={`text-base font-extrabold font-mono ${
                        isClear 
                          ? 'text-slate-400' 
                          : 'text-slate-900 dark:text-white'
                      }`}>
                        ₹{farmer.total_credit_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                        isClear
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}>
                        {isClear ? 'Clear (No Due)' : 'Pending Due'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => onNavigateToPOS(null)}
                        className="bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        New Bill
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historical Invoices Ledger */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Recent Invoices & Khata Additions
          </span>
          <span className="text-xs text-slate-500 font-mono">
            {invoices.length} Invoices
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase">
                <th className="py-2.5 px-4">Invoice #</th>
                <th className="py-2.5 px-4">Farmer Name & Village</th>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4 text-right">Grand Total (₹)</th>
                <th className="py-2.5 px-4">Payment Mode</th>
                <th className="py-2.5 px-4 text-right">Amount Paid</th>
                <th className="py-2.5 px-4 text-right">Added to Khata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {invoices.map((inv) => (
                <tr key={inv.invoice_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300">
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                    {inv.invoice_number}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="font-semibold text-slate-900 dark:text-white">{inv.farmer_name}</span> ({inv.village})
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-500">
                    {inv.invoice_date}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                    ₹{inv.grand_total.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      {inv.payment_mode.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                    ₹{inv.amount_paid.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-sky-700 dark:text-sky-400">
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
