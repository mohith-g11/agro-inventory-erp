import React from 'react';
import { 
  LayoutDashboard, 
  Boxes, 
  Receipt, 
  BookOpenText, 
  Sprout, 
  AlertCircle,
  HelpCircle,
  TrendingUp
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, expiringCount = 0 }) {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      sublabel: 'KPIs & Expiry Alerts',
      icon: LayoutDashboard,
      badge: expiringCount > 0 ? `${expiringCount} Alert` : null,
      badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30'
    },
    {
      id: 'inventory',
      label: 'Inventory & Substitutes',
      sublabel: 'FEFO Batches & Formulas',
      icon: Boxes,
      badge: '10 Items',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    },
    {
      id: 'pos',
      label: 'GST POS Billing Counter',
      sublabel: 'Auto FEFO Multi-Batch Split',
      icon: Receipt,
      badge: 'Live',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
    },
    {
      id: 'khata',
      label: 'Farmer Khata Ledger',
      sublabel: 'Mysore Belt Credit Control',
      icon: BookOpenText,
      badge: '5 Farmers',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    }
  ];

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/40">
              <Sprout className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-slate-100 tracking-wide">
                SRI MATHURSHREE
              </div>
              <div className="text-[11px] text-emerald-400 font-medium">
                Agro Kendra ERP
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1.5">
          <div className="px-3 py-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            Main Modules
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all duration-150 text-left group ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-950/60 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-emerald-400'}`} />
                  <div>
                    <div className="text-xs font-semibold leading-tight">{item.label}</div>
                    <div className={`text-[10px] ${isActive ? 'text-emerald-100' : 'text-slate-500'}`}>
                      {item.sublabel}
                    </div>
                  </div>
                </div>

                {item.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-medium ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info Box */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/40 m-3 rounded-xl">
        <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-200">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span>Agricultural Compliance</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Compliant with Insecticides Act 1968 & Fertilizer Control Order 1985 batch traceability.
        </p>
      </div>
    </aside>
  );
}
