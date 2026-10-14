import React from 'react';
import { ShieldCheck, Calendar, FileText, Database, Sparkles } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-3.5 sticky top-0 z-30">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Left: Store identity & License details */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-950/50">
            <Sparkles className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">Sri Mathurshree Agro Kendra</h1>
              <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Phase 1 ERP
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Mysore Division • Retail & Wholesale Agricultural Inputs
            </p>
          </div>
        </div>

        {/* Center/Right: Statutory Compliance Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60 text-slate-300">
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Fertilizer Lic:</span>
            <span className="font-mono font-medium text-emerald-300">MYS/AGR/FERT/2024/7821</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60 text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Insecticide Lic:</span>
            <span className="font-mono font-medium text-amber-300">KA/MYS/INS/2023/4510</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60 text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-400">Date:</span>
            <span className="font-medium text-sky-200">Oct 14, 2026</span>
          </div>

          <div className="flex items-center gap-1.5 bg-emerald-950/40 px-2.5 py-1.5 rounded-lg border border-emerald-800/40 text-emerald-300">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium">3NF SQLite Active</span>
          </div>
        </div>
      </div>
    </header>
  );
}
