import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import DashboardTab from './components/DashboardTab';
import InventoryTab from './components/InventoryTab';
import PosBillingTab from './components/PosBillingTab';
import KhataLedgerTab from './components/KhataLedgerTab';
import InvoiceModal from './components/InvoiceModal';
import { 
  fetchDashboardSummary, 
  fetchInventory, 
  fetchCustomers, 
  fetchInvoices 
} from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  // Cross-tab interaction
  const [preSelectedProductId, setPreSelectedProductId] = useState(null);
  const [activeInvoiceModal, setActiveInvoiceModal] = useState(null);

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

  useEffect(() => {
    loadData();
  }, []);

  // Quick navigation from Expiry Alert or Inventory to POS
  const handleNavigateToPOS = (productId) => {
    setPreSelectedProductId(productId);
    setActiveTab('pos');
  };

  // Called when an invoice is successfully finalized in POS
  const handleInvoiceCreated = (invoice) => {
    setActiveInvoiceModal(invoice);
    loadData();
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        expiringCount={dashboardSummary?.expiring_batches_count || 0}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header theme={theme} setTheme={setTheme} />

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
              />
            )}

            {/* TAB 3: BILLING COUNTER (POS) */}
            {activeTab === 'pos' && (
              <PosBillingTab
                inventory={inventory}
                customers={customers}
                preSelectedProductId={preSelectedProductId}
                onInvoiceCreated={handleInvoiceCreated}
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
              />
            )}
          </div>
        </main>
      </div>

      {/* Completed Invoice View / Print Modal */}
      {activeInvoiceModal && (
        <InvoiceModal
          invoice={activeInvoiceModal}
          onClose={() => setActiveInvoiceModal(null)}
        />
      )}
    </div>
  );
}
