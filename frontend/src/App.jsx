import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import DashboardTab from './components/DashboardTab';
import InventoryTab from './components/InventoryTab';
import PosBillingTab from './components/PosBillingTab';
import KhataLedgerTab from './components/KhataLedgerTab';
import PrintableInvoiceModal from './components/PrintableInvoiceModal';
import LoginScreen from './components/LoginScreen';
import { 
  fetchDashboardSummary, 
  fetchInventory, 
  fetchCustomers, 
  fetchInvoices,
  fetchCurrentUser,
  logoutUser
} from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Auth state
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Theme State: Default to 'light' as requested, with localStorage persistence
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('agro_erp_theme') || 'light';
  });

  useEffect(() => {
    localStorage.setItem('agro_erp_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // On mount: verify token, listen for logout events
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const user = await fetchCurrentUser();
        setCurrentUser(user);
      } catch {
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    verifyAuth();

    const handleAgroLogout = () => {
      setCurrentUser(null);
    };
    window.addEventListener('agro_logout', handleAgroLogout);
    return () => window.removeEventListener('agro_logout', handleAgroLogout);
  }, []);

  // Cross-tab interaction
  const [preSelectedProductId, setPreSelectedProductId] = useState(null);
  const [printableInvoiceId, setPrintableInvoiceId] = useState(null);

  // Load all initial ERP data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [sumData, invData, custData, invList] = await Promise.all([
        fetchDashboardSummary(),
        fetchInventory(),
        fetchCustomers(),
        fetchInvoices()
      ]);
      setDashboardSummary(sumData);
      setInventory(invData);
      setCustomers(custData);
      setInvoices(invList);
    } catch (err) {
      console.error(err);
      setError('Unable to load ERP backend services. Please ensure the backend server is running on port 8000.');
    } finally {
      setLoading(false);
    }
  };

  // Load data when user logs in
  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  // Quick navigation from Expiry Alert or Inventory to POS
  const handleNavigateToPOS = (productId) => {
    setPreSelectedProductId(productId);
    setActiveTab('pos');
  };

  // Called when an invoice is successfully finalized in POS
  const handleInvoiceCreated = (invoice) => {
    const invId = invoice?.invoice_id || invoice;
    setPrintableInvoiceId(invId);
    loadData();
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
  };

  // ── Auth Loading Spinner ────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Loading ERP...
          </span>
        </div>
      </div>
    );
  }

  // ── Login Screen ────────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={(user) => {
          setCurrentUser(user);
        }}
      />
    );
  }

  // ── Main ERP Layout ─────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        expiringCount={dashboardSummary?.expiring_batches_count || 0}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header theme={theme} setTheme={setTheme} currentUser={currentUser} />

        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50 dark:bg-slate-950 transition-colors">
          <div className="max-w-7xl mx-auto space-y-6">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-500/50 rounded-xl text-red-700 dark:text-red-200 text-xs flex items-center justify-between">
                <span>{error}</span>
                <button
                  onClick={loadData}
                  className="bg-red-700 hover:bg-red-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
                >
                  Retry Connection
                </button>
              </div>
            )}

            {/* TAB 1: DASHBOARD */}
            {activeTab === 'dashboard' && (
              <DashboardTab
                summaryData={dashboardSummary}
                loading={loading}
                onNavigateToPOS={handleNavigateToPOS}
                onNavigateToInventory={() => setActiveTab('inventory')}
                currentUser={currentUser}
              />
            )}

            {/* TAB 2: STOCK & SUBSTITUTES */}
            {activeTab === 'inventory' && (
              <InventoryTab
                inventory={inventory}
                loading={loading}
                onNavigateToPOS={handleNavigateToPOS}
                onRefresh={loadData}
                onBatchAdded={loadData}
                currentUser={currentUser}
              />
            )}

            {/* TAB 3: BILLING COUNTER (POS) */}
            {activeTab === 'pos' && (
              <PosBillingTab
                inventory={inventory}
                customers={customers}
                preSelectedProductId={preSelectedProductId}
                onInvoiceCreated={handleInvoiceCreated}
                currentUser={currentUser}
              />
            )}

            {/* TAB 4: FARMER KHATA (CREDIT) */}
            {activeTab === 'khata' && (
              <KhataLedgerTab
                customers={customers}
                invoices={invoices}
                loading={loading}
                onNavigateToPOS={handleNavigateToPOS}
                onRefresh={loadData}
                onPrintInvoice={(invoiceId) => setPrintableInvoiceId(invoiceId)}
                currentUser={currentUser}
              />
            )}
          </div>
        </main>
      </div>

      {/* Official Printable GST Tax Invoice Modal (A4 & 80mm Thermal) */}
      {printableInvoiceId && (
        <PrintableInvoiceModal
          invoiceId={printableInvoiceId}
          onClose={() => setPrintableInvoiceId(null)}
        />
      )}
    </div>
  );
}
