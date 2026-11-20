import React, { useState, useEffect } from 'react';
import { 
  Users, 
  MapPin, 
  Sprout, 
  Phone, 
  Receipt, 
  Search,
  Plus,
  UserPlus,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  X,
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  History,
  CreditCard,
  Building,
  Printer,
  Pencil,
  MessageCircle
} from 'lucide-react';
import { 
  createCustomer, 
  recordRepayment, 
  fetchCustomerLedger,
  updateCreditLimit
} from '../services/api';

export default function KhataLedgerTab({ 
  customers = [], 
  invoices = [], 
  loading,
  onNavigateToPOS,
  onRefresh,
  onPrintInvoice,
  currentUser
}) {
  const isAdmin = currentUser?.role === 'Admin';
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState(null);

  // 1. Add Farmer Modal State
  const [addFarmerOpen, setAddFarmerOpen] = useState(false);
  const [farmerForm, setFarmerForm] = useState({
    farmer_name: '',
    phone: '',
    village: 'Nanjangud',
    primary_crop: 'Paddy & Sugarcane',
    credit_limit: '25000'
  });
  const [farmerSubmitting, setFarmerSubmitting] = useState(false);
  const [farmerError, setFarmerError] = useState(null);

  // 2. Repayment Modal State
  const [repaymentModalOpen, setRepaymentModalOpen] = useState(false);
  const [repayingCustomer, setRepayingCustomer] = useState(null);
  const [repaymentForm, setRepaymentForm] = useState({
    amount: '',
    payment_mode: 'UPI',
    remarks: ''
  });
  const [repaymentSubmitting, setRepaymentSubmitting] = useState(false);
  const [repaymentError, setRepaymentError] = useState(null);

  // 3. View Ledger Drawer / Modal State
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [ledgerCustomer, setLedgerCustomer] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState(null);

  // 4. Edit Credit Limit Modal State (Admin only)
  const [editLimitModalOpen, setEditLimitModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [newCreditLimit, setNewCreditLimit] = useState('');
  const [editLimitSubmitting, setEditLimitSubmitting] = useState(false);
  const [editLimitError, setEditLimitError] = useState(null);

  const handleOpenEditLimit = (farmer) => {
    setEditingCustomer(farmer);
    setNewCreditLimit(String(farmer.credit_limit));
    setEditLimitError(null);
    setEditLimitModalOpen(true);
  };

  const handleSaveCreditLimit = async (e) => {
    e.preventDefault();
    if (!editingCustomer) return;
    const limitVal = parseFloat(newCreditLimit);
    if (isNaN(limitVal) || limitVal < 0) {
      setEditLimitError('Credit limit must be a valid number greater than or equal to 0.');
      return;
    }
    try {
      setEditLimitSubmitting(true);
      setEditLimitError(null);
      await updateCreditLimit(editingCustomer.customer_id, limitVal);
      setEditLimitModalOpen(false);
      setNotification({
        type: 'success',
        title: 'Credit Limit Updated',
        message: `Credit limit for ${editingCustomer.farmer_name} updated to ₹${limitVal.toLocaleString('en-IN')}`
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      setEditLimitError(err.message || 'Failed to update credit limit');
    } finally {
      setEditLimitSubmitting(false);
    }
  };

  // Auto-dismiss notification after 5s
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const filteredCustomers = customers.filter(c => 
    c.farmer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.village.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.primary_crop.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  const totalOutstanding = customers.reduce((sum, c) => sum + (c.total_credit_due || 0), 0);
  const farmersWithDueCount = customers.filter(c => (c.total_credit_due || 0) > 0).length;

  // Open Add Farmer Modal
  const handleOpenAddFarmer = () => {
    setFarmerError(null);
    setFarmerForm({
      farmer_name: '',
      phone: '',
      village: 'Nanjangud',
      primary_crop: 'Paddy & Sugarcane',
      credit_limit: '25000'
    });
    setAddFarmerOpen(true);
  };

  // Submit Add Farmer
  const handleAddFarmerSubmit = async (e) => {
    e.preventDefault();
    setFarmerError(null);

    const { farmer_name, phone, village, primary_crop, credit_limit } = farmerForm;
    if (!farmer_name.trim()) {
      setFarmerError('Farmer name is required.');
      return;
    }
    if (!phone.trim() || !/^\+?[0-9]{10,15}$/.test(phone.trim())) {
      setFarmerError('Please enter a valid 10-15 digit phone number.');
      return;
    }
    if (!village.trim()) {
      setFarmerError('Village is required.');
      return;
    }
    if (!primary_crop.trim()) {
      setFarmerError('Primary crop profile is required.');
      return;
    }
    const limit = parseFloat(credit_limit);
    if (isNaN(limit) || limit < 0) {
      setFarmerError('Credit limit must be 0 or greater.');
      return;
    }

    try {
      setFarmerSubmitting(true);
      const res = await createCustomer({
        farmer_name: farmer_name.trim(),
        phone: phone.trim(),
        village: village.trim(),
        primary_crop: primary_crop.trim(),
        credit_limit: limit
      });

      setAddFarmerOpen(false);
      if (onRefresh) {
        onRefresh();
      }

      setNotification({
        type: 'success',
        message: `Farmer "${res.farmer_name}" onboarded successfully! Khata account activated.`
      });
    } catch (err) {
      setFarmerError(err.message || 'Failed to onboard farmer.');
    } finally {
      setFarmerSubmitting(false);
    }
  };

  // Open Repayment Modal
  const handleOpenRepayment = (farmer) => {
    setRepayingCustomer(farmer);
    setRepaymentError(null);
    setRepaymentForm({
      amount: '',
      payment_mode: 'UPI',
      remarks: ''
    });
    setRepaymentModalOpen(true);
  };

  // Submit Repayment
  const handleRepaymentSubmit = async (e) => {
    e.preventDefault();
    setRepaymentError(null);

    if (!repayingCustomer) return;

    const amt = parseFloat(repaymentForm.amount);
    const maxDue = repayingCustomer.total_credit_due;

    if (isNaN(amt) || amt <= 0) {
      setRepaymentError('Repayment amount must be greater than 0.');
      return;
    }
    if (amt > maxDue) {
      setRepaymentError(`Repayment amount (₹${amt.toFixed(2)}) cannot exceed current due (₹${maxDue.toFixed(2)}).`);
      return;
    }

    try {
      setRepaymentSubmitting(true);
      const res = await recordRepayment(repayingCustomer.customer_id, {
        amount: amt,
        payment_mode: repaymentForm.payment_mode,
        remarks: repaymentForm.remarks ? repaymentForm.remarks.trim() : null
      });

      setRepaymentModalOpen(false);
      if (onRefresh) {
        onRefresh();
      }

      // If ledger is open for this customer, refresh ledger data too
      if (ledgerModalOpen && ledgerCustomer?.customer_id === repayingCustomer.customer_id) {
        loadCustomerLedger(repayingCustomer);
      }

      setNotification({
        type: 'success',
        message: `Repayment of ₹${amt.toFixed(2)} recorded for ${repayingCustomer.farmer_name} (${res.receipt_number}). Updated due: ₹${res.updated_credit_due.toFixed(2)}.`
      });
    } catch (err) {
      setRepaymentError(err.message || 'Failed to record repayment.');
    } finally {
      setRepaymentSubmitting(false);
    }
  };

  // Open Ledger Modal & Fetch statement
  const loadCustomerLedger = async (farmer) => {
    setLedgerCustomer(farmer);
    setLedgerModalOpen(true);
    setLedgerLoading(true);
    setLedgerError(null);

    try {
      const data = await fetchCustomerLedger(farmer.customer_id);
      setLedgerData(data);
    } catch (err) {
      setLedgerError(err.message || 'Failed to fetch customer ledger.');
    } finally {
      setLedgerLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-xl border flex items-center justify-between shadow-md transition-all ${
          notification.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100'
            : 'bg-red-50 dark:bg-red-950/80 border-red-300 dark:border-red-700 text-red-900 dark:text-red-100'
        }`}>
          <div className="flex items-center gap-2.5 text-sm font-semibold">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button 
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Farmer Khata (Credit Ledger)
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Track seasonal credit balances, authorized credit limits, repayments, and harvest settlements
          </p>
        </div>

        {/* Action Bar: Search & + Add Farmer Button */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Farmer, Village, Crop..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-sm"
            />
          </div>

          <button
            onClick={handleOpenAddFarmer}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition active:scale-95 shrink-0 inline-flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add Farmer</span>
          </button>
        </div>
      </div>

      {/* Top 2 Essential Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Total Pending Market Credit</span>
            <IndianRupee className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
            ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Outstanding seasonal khata credit across Mysuru taluks
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Farmers with Pending Dues</span>
            <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
            {farmersWithDueCount} <span className="text-sm font-normal text-slate-500">of {customers.length} Accounts</span>
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Accounts with active seasonal balances
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
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    No farmer accounts match your search. Click "+ Add Farmer" above to onboard one.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((farmer) => {
                  const isClear = farmer.total_credit_due === 0;

                  return (
                    <tr key={farmer.customer_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                          {farmer.farmer_name}
                        </div>
                        <div className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {farmer.phone}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {farmer.village}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Sprout className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          {farmer.primary_crop}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400 text-xs">
                        ₹{farmer.credit_limit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className={`text-sm font-extrabold font-mono ${
                          isClear 
                            ? 'text-slate-400' 
                            : 'text-slate-900 dark:text-white'
                        }`}>
                          ₹{farmer.total_credit_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        {!isClear && farmer.credit_limit > 0 && (
                          <div className="w-24 ml-auto mt-1">
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  (farmer.total_credit_due / farmer.credit_limit) >= 1
                                    ? 'bg-red-600'
                                    : (farmer.total_credit_due / farmer.credit_limit) >= 0.8
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.round((farmer.total_credit_due / farmer.credit_limit) * 100))}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {Math.round((farmer.total_credit_due / farmer.credit_limit) * 100)}% used
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${
                          isClear
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}>
                          {isClear ? 'Clear (No Due)' : 'Pending Due'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* WhatsApp Reminder Link */}
                          {!isClear && (
                            <a
                              href={`https://wa.me/91${farmer.phone}?text=${encodeURIComponent(
                                `Namaskara ${farmer.farmer_name} avare, Sri Mathurshree Agro Kendra Mysuru rinda. Nimma khata balance Rs ${farmer.total_credit_due.toFixed(2)}. Dayavittu marupavati madi. Dhanyavadagalu.`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-1.5 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1"
                              title="Send WhatsApp Reminder (Kannada/English)"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>WhatsApp</span>
                            </a>
                          )}

                          {/* 1. Record Repayment Button */}
                          <button
                            onClick={() => handleOpenRepayment(farmer)}
                            disabled={isClear}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 inline-flex items-center gap-1 ${
                              isClear
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-60'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                            }`}
                            title={isClear ? 'No pending balance to repay' : 'Record Repayment'}
                          >
                            <HandCoins className="w-3.5 h-3.5" />
                            <span>Repay</span>
                          </button>

                          {/* 2. View Ledger Button */}
                          <button
                            onClick={() => loadCustomerLedger(farmer)}
                            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1"
                            title="View Unified Invoices & Repayments Ledger"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                            <span>Ledger</span>
                          </button>

                          {/* 3. Edit Limit (Admin Only) */}
                          {isAdmin && (
                            <button
                              onClick={() => handleOpenEditLimit(farmer)}
                              className="bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 inline-flex items-center gap-1"
                              title="Edit Credit Limit (Admin Only)"
                            >
                              <Pencil className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              <span>Edit Limit</span>
                            </button>
                          )}

                          {/* 4. New Bill at Counter */}
                          <button
                            onClick={() => onNavigateToPOS(null)}
                            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1.5 rounded-lg text-xs font-medium transition inline-flex items-center gap-1"
                            title="Open Billing Counter (POS)"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
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
                <th className="py-2.5 px-4 text-center">Action</th>
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
                  <td className="py-2.5 px-4 text-center">
                    <button
                      onClick={() => onPrintInvoice && onPrintInvoice(inv.invoice_id)}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 text-slate-700 dark:text-slate-300 rounded text-xs font-semibold transition inline-flex items-center gap-1 shadow-xs"
                      title="Print Official GST Tax Invoice"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Print Bill</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: + Add Farmer                                                     */}
      {/* ========================================================================= */}
      {addFarmerOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto transition-colors">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    + Onboard New Farmer
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Create seasonal khata credit account with village profile
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAddFarmerOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddFarmerSubmit} className="p-5 space-y-4">
              {farmerError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-200 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="font-medium">{farmerError}</div>
                </div>
              )}

              {/* Farmer Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Farmer Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={farmerForm.farmer_name}
                  onChange={(e) => setFarmerForm({ ...farmerForm, farmer_name: e.target.value })}
                  placeholder="e.g. Basavaraju K"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Mobile Number (Unique) <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={farmerForm.phone}
                  onChange={(e) => setFarmerForm({ ...farmerForm, phone: e.target.value })}
                  placeholder="e.g. 9845011223"
                  required
                  className="w-full font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Village & Primary Crop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Village / Taluk <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={farmerForm.village}
                    onChange={(e) => setFarmerForm({ ...farmerForm, village: e.target.value })}
                    placeholder="e.g. Nanjangud, Bannur"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Primary Crop Profile <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={farmerForm.primary_crop}
                    onChange={(e) => setFarmerForm({ ...farmerForm, primary_crop: e.target.value })}
                    placeholder="e.g. Paddy & Sugarcane"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Credit Limit */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Seasonal Credit Limit (₹) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                  <input
                    type="number"
                    step="1000"
                    min="0"
                    value={farmerForm.credit_limit}
                    onChange={(e) => setFarmerForm({ ...farmerForm, credit_limit: e.target.value })}
                    required
                    className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Default limit is ₹25,000 for verified Mysuru growers.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAddFarmerOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={farmerSubmitting}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-sm transition active:scale-95 inline-flex items-center gap-1.5"
                >
                  {farmerSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Activating...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Onboard Farmer</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Record Repayment                                                 */}
      {/* ========================================================================= */}
      {repaymentModalOpen && repayingCustomer && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto transition-colors">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                  <HandCoins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Record Khata Repayment
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Settle seasonal debt with receipt number & atomic ledger deduction
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRepaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Farmer Overview Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {repayingCustomer.farmer_name}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {repayingCustomer.village} • {repayingCustomer.phone}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  Current Outstanding Due
                </div>
                <div className="text-lg font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                  ₹{repayingCustomer.total_credit_due.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleRepaymentSubmit} className="p-5 space-y-4">
              {repaymentError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-200 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="font-medium">{repaymentError}</div>
                </div>
              )}

              {/* Payment Mode Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Payment Mode <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'UPI', label: 'UPI / PhonePe', icon: CreditCard },
                    { id: 'Cash', label: 'Cash at Counter', icon: IndianRupee },
                    { id: 'Bank_Transfer', label: 'Bank Transfer', icon: Building }
                  ].map((mode) => {
                    const Icon = mode.icon;
                    const isSelected = repaymentForm.payment_mode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setRepaymentForm({ ...repaymentForm, payment_mode: mode.id })}
                        className={`p-2.5 rounded-lg border text-left transition flex flex-col items-center justify-center gap-1 ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[11px] font-semibold">{mode.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Repayment Amount & Quick Full Pay Button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Repayment Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setRepaymentForm({ ...repaymentForm, amount: repayingCustomer.total_credit_due.toFixed(2) })}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Pay Full Due (₹{repayingCustomer.total_credit_due.toFixed(2)})
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={repayingCustomer.total_credit_due}
                    placeholder="Enter amount"
                    value={repaymentForm.amount}
                    onChange={(e) => setRepaymentForm({ ...repaymentForm, amount: e.target.value })}
                    required
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-base font-extrabold text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Remaining Balance Preview */}
                {repaymentForm.amount && !isNaN(parseFloat(repaymentForm.amount)) && (
                  <div className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
                    <span>Remaining Due after payment:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      ₹{Math.max(0, repayingCustomer.total_credit_due - parseFloat(repaymentForm.amount)).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Remarks / Note (Optional)
                </label>
                <input
                  type="text"
                  value={repaymentForm.remarks}
                  onChange={(e) => setRepaymentForm({ ...repaymentForm, remarks: e.target.value })}
                  placeholder="e.g. Harvest settlement, Paddy yield advance"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRepaymentModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={repaymentSubmitting}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-sm transition active:scale-95 inline-flex items-center gap-1.5"
                >
                  {repaymentSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <HandCoins className="w-3.5 h-3.5" />
                      <span>Confirm & Record Repayment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: View Ledger Drawer / Unified Statement                           */}
      {/* ========================================================================= */}
      {ledgerModalOpen && ledgerCustomer && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto transition-colors">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Khata Statement: {ledgerCustomer.farmer_name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {ledgerCustomer.village} • Phone: {ledgerCustomer.phone} • Crop: {ledgerCustomer.primary_crop}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {ledgerCustomer.total_credit_due > 0 && (
                  <button
                    onClick={() => handleOpenRepayment(ledgerCustomer)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition active:scale-95 inline-flex items-center gap-1"
                  >
                    <HandCoins className="w-3.5 h-3.5" />
                    <span>+ Repay</span>
                  </button>
                )}
                <button
                  onClick={() => setLedgerModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 4 Summary Stat Badges */}
            {ledgerData && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50/70 dark:bg-slate-950/30 border-b border-slate-200 dark:border-slate-800 text-xs">
                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Total Credit Borrowed</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                    ₹{ledgerData.summary.total_credit_incurred.toFixed(2)}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Total Repaid</div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                    ₹{ledgerData.summary.total_repaid.toFixed(2)}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Outstanding Due</div>
                  <div className="text-sm font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                    ₹{ledgerData.summary.total_credit_due.toFixed(2)}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Credit Limit Remaining</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                    ₹{ledgerData.summary.available_credit.toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            {/* Statement Table Body */}
            <div className="p-4 overflow-y-auto flex-1">
              {ledgerLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400 text-sm">
                  <div className="w-7 h-7 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading reverse-chronological statement...</span>
                </div>
              ) : ledgerError ? (
                <div className="p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs">
                  {ledgerError}
                </div>
              ) : !ledgerData || ledgerData.statement.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  No invoice purchases or repayments recorded for this farmer yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Reference #</th>
                        <th className="py-2.5 px-3">Description & Notes</th>
                        <th className="py-2.5 px-3">Mode</th>
                        <th className="py-2.5 px-3 text-right">Debit (+) Borrowed</th>
                        <th className="py-2.5 px-3 text-right">Credit (-) Repaid</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {ledgerData.statement.map((entry) => {
                        const isInvoice = entry.type === 'INVOICE';
                        return (
                          <tr key={entry.entry_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300">
                            <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                              {entry.date}
                            </td>

                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                                isInvoice
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              }`}>
                                {isInvoice ? (
                                  <>
                                    <ArrowDownLeft className="w-3 h-3 text-amber-600" />
                                    <span>Invoice</span>
                                  </>
                                ) : (
                                  <>
                                    <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                                    <span>Repayment</span>
                                  </>
                                )}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {entry.reference}
                            </td>

                            <td className="py-2.5 px-3">
                              <div className="font-medium text-slate-800 dark:text-slate-200">
                                {entry.description}
                              </div>
                              {entry.items && entry.items.length > 0 && (
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {entry.items.map(it => `${it.product_name} (${it.qty_billed})`).join(', ')}
                                </div>
                              )}
                              {entry.recorded_by && (
                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                                  Recorded by: {entry.recorded_by}
                                </div>
                              )}
                              {entry.billed_by && (
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                  Billed by: {entry.billed_by}
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                              {entry.payment_mode ? entry.payment_mode.replace('_', ' ') : '—'}
                            </td>

                            <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                              {entry.debit > 0 ? `+₹${entry.debit.toFixed(2)}` : '—'}
                            </td>

                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              {entry.credit > 0 ? `-₹${entry.credit.toFixed(2)}` : '—'}
                            </td>

                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {isInvoice && entry.invoice_id ? (
                                <button
                                  onClick={() => onPrintInvoice && onPrintInvoice(entry.invoice_id)}
                                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 text-slate-700 dark:text-slate-300 rounded text-[11px] font-semibold transition inline-flex items-center gap-1 shadow-xs"
                                  title="Print GST Tax Invoice"
                                >
                                  <Printer className="w-3 h-3 text-emerald-600" />
                                  <span>Print Bill</span>
                                </button>
                              ) : (
                                <span className="text-slate-400 text-[11px]">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex justify-end">
              <button
                onClick={() => setLedgerModalOpen(false)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: Edit Credit Limit (Admin only)                                   */}
      {/* ========================================================================= */}
      {editLimitModalOpen && editingCustomer && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden my-auto transition-colors">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                    Edit Farmer Credit Limit
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {editingCustomer.farmer_name} • {editingCustomer.village}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditLimitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCreditLimit} className="p-5 space-y-4">
              {editLimitError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                  <span>{editLimitError}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Current Outstanding Due:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    ₹{editingCustomer.total_credit_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Current Credit Limit:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    ₹{editingCustomer.credit_limit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  New Credit Limit (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  required
                  value={newCreditLimit}
                  onChange={(e) => setNewCreditLimit(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600 transition"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  Proprietor authorization required. Seasonal maximum credit extended for inputs.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditLimitModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLimitSubmitting}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition active:scale-95 disabled:opacity-60 flex items-center gap-1.5"
                >
                  {editLimitSubmitting ? (
                    <span>Saving...</span>
                  ) : (
                    <span>Update Credit Limit</span>
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