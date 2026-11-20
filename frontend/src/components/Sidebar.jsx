import React from 'react';
import { 
  LayoutDashboard, 
  Boxes, 
  Receipt, 
  BookOpenText, 
  Sprout,
  LogOut
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, expiringCount = 0, currentUser, onLogout }) {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: expiringCount > 0 ? `${expiringCount}` : null,
      badgeColor: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800'
    },
    {
      id: 'inventory',
      label: 'Stock & Substitutes',
      icon: Boxes,
      badge: null
    },
    {
      id: 'pos',
      label: 'Billing Counter (POS)',
      icon: Receipt,
      badge: null
    },
    {
      id: 'khata',
      label: 'Farmer Khata (Credit)',
      icon: BookOpenText,
      badge: null
    }
  ];

  const isAdmin = currentUser?.role === 'Admin';

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0 select-none transition-colors">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight">
                Sri Mathurshree
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Agro Kendra ERP
              </div>
            </div>
          </div>
        </div>

        {/* 4 Large Clean Navigation Links */}
        <nav className="p-3 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-150 text-left font-semibold text-sm ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    isActive ? 'bg-white text-emerald-800' : item.badgeColor
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        {currentUser ? (
          <div className="space-y-2.5">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                {currentUser.full_name}
              </div>
              <div className="mt-1">
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                  isAdmin
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                }`}>
                  {currentUser.role}
                </span>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-400 dark:text-slate-500">
            <div>Mysore District, Karnataka</div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Quick Counter POS v1.0</div>
          </div>
        )}
      </div>
    </aside>
  );
}
