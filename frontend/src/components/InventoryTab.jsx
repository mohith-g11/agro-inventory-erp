import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle, 
  Layers, 
  ShieldCheck, 
  X, 
  ChevronDown, 
  ChevronUp,
  Receipt,
  RotateCcw
} from 'lucide-react';
import { searchSubstitutes } from '../services/api';

export default function InventoryTab({ 
  inventory, 
  loading, 
  onNavigateToPOS, 
  initialSearch = '' 
}) {
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [expandedProduct, setExpandedProduct] = useState(null);
  
  // Substitute Modal State
  const [substituteModal, setSubstituteModal] = useState({
    isOpen: false,
    composition: '',
    sourceProduct: null,
    loading: false,
    results: []
  });

  const categories = [
    { id: 'ALL', label: 'All Categories' },
    { id: 'Seeds', label: 'Seeds (0% GST)' },
    { id: 'NPK_Fertilizer', label: 'NPK Fertilizers (5% GST)' },
    { id: 'Bio_Fertilizer', label: 'Bio Fertilizers (5% GST)' },
    { id: 'Insecticide', label: 'Insecticides (18% GST)' },
    { id: 'Pesticide', label: 'Pesticides (18% GST)' },
  ];

  // Filter products based on search term and category
  const filteredProducts = inventory.filter((prod) => {
    const matchesSearch = 
      prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.chemical_composition.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.hsn_code.includes(searchTerm);

    const matchesCategory = selectedCategory === 'ALL' || prod.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleOpenSubstitutes = async (prod) => {
    setSubstituteModal({
      isOpen: true,
      composition: prod.chemical_composition,
      sourceProduct: prod,
      loading: true,
      results: []
    });

    try {
      const data = await searchSubstitutes(prod.chemical_composition);
      setSubstituteModal((prev) => ({
        ...prev,
        loading: false,
        results: data.results || []
      }));
    } catch (err) {
      console.error(err);
      setSubstituteModal((prev) => ({
        ...prev,
        loading: false,
        results: []
      }));
    }
  };

  const handleQuickFilter = (comp) => {
    setSearchTerm(comp);
    setSelectedCategory('ALL');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Inventory & Chemical Substitute Engine
          </h2>
          <p className="text-xs text-slate-400">
            3NF Normalized Product Catalog, Multi-Batch FEFO Allocation, and Active Compound Substitutes
          </p>
        </div>

        {/* Quick Demo Test Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">Quick Test Formulas:</span>
          <button
            onClick={() => handleQuickFilter('Imidacloprid 17.8% SL')}
            className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg font-medium transition active:scale-95 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Imidacloprid 17.8% SL
          </button>
          <button
            onClick={() => handleQuickFilter('NPK 19:19:19')}
            className="text-xs bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 px-3 py-1.5 rounded-lg font-medium transition active:scale-95 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            NPK 19:19:19
          </button>
          {(searchTerm || selectedCategory !== 'ALL') && (
            <button
              onClick={() => { setSearchTerm(''); setSelectedCategory('ALL'); }}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Product Name, Brand, HSN, or Active Composition (e.g. Chlorantraniliprole, NPK)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/60">
          <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`text-xs px-3 py-1.5 rounded-lg transition font-medium ${
                selectedCategory === cat.id
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Product List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Product Catalog & Batch Traceability
            </span>
            <span className="text-xs text-slate-500">
              ({filteredProducts.length} matching items)
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Sorted by FEFO (First-Expired, First-Out)
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Loading products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No products match the search criteria.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredProducts.map((product) => {
              const isExpanded = expandedProduct === product.product_id;
              const hasAlert = product.has_expiring_soon;
              const isLowStock = product.is_low_stock;

              return (
                <div key={product.product_id} className="transition">
                  {/* Master Product Row */}
                  <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-800/30">
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono text-slate-500">
                          #{product.product_id}
                        </span>
                        <h3 className="font-bold text-white text-sm">
                          {product.name}
                        </h3>
                        <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                          {product.brand}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700/60">
                          {product.category.replace('_', ' ')}
                        </span>
                        <span className="text-[11px] font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                          GST: {product.gst_slab}%
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          HSN: {product.hsn_code}
                        </span>
                      </div>

                      {/* Chemical Formula / Active Ingredient */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                        <span className="text-slate-400">Active Compound:</span>
                        <span className="font-semibold text-amber-300 font-mono bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                          {product.chemical_composition}
                        </span>
                        <button
                          onClick={() => handleOpenSubstitutes(product)}
                          className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 ml-1"
                        >
                          <Sparkles className="w-3 h-3" />
                          Find Chemical Substitutes
                        </button>
                      </div>
                    </div>

                    {/* Stock & Batch Summary */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {hasAlert && (
                            <span className="text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/40 px-2 py-0.5 rounded-full animate-pulse">
                              Batch Expiring &lt;30d
                            </span>
                          )}
                          {isLowStock && (
                            <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded-full">
                              Low Stock
                            </span>
                          )}
                          <div className="text-base font-extrabold text-white">
                            {product.total_stock} <span className="text-xs font-normal text-slate-400">{product.base_unit}</span>
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {product.batches.length} Active {product.batches.length === 1 ? 'Batch' : 'Batches'} • Reorder: {product.reorder_level} {product.base_unit}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onNavigateToPOS(product.product_id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition active:scale-95 flex items-center gap-1"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          Bill
                        </button>

                        <button
                          onClick={() => setExpandedProduct(isExpanded ? null : product.product_id)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-lg transition"
                          title="Toggle Batch Details"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Batches Sub-Table (FEFO Ordered) */}
                  {isExpanded && (
                    <div className="bg-slate-950/80 p-4 border-t border-slate-800/80">
                      <div className="text-xs font-bold text-slate-400 mb-2 flex items-center justify-between">
                        <span>FEFO BATCH LEDGER (Sorted by Earliest Expiry Date)</span>
                        <span className="text-[11px] text-emerald-400">
                          1 Bulk Unit = {product.conversion_factor} {product.base_unit} ({product.bulk_unit})
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-500">
                              <th className="py-2 px-3">Batch Number</th>
                              <th className="py-2 px-3">Mfg Date</th>
                              <th className="py-2 px-3">Expiry Date</th>
                              <th className="py-2 px-3">Validity Status</th>
                              <th className="py-2 px-3 text-right">Cost Price</th>
                              <th className="py-2 px-3 text-right">MRP</th>
                              <th className="py-2 px-3 text-right">Selling Price</th>
                              <th className="py-2 px-3 text-right">Available Qty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/40">
                            {product.batches.map((batch) => {
                              const isSoon = batch.is_expiring_soon;
                              return (
                                <tr key={batch.batch_id} className={`hover:bg-slate-900/60 ${isSoon ? 'bg-red-950/20' : ''}`}>
                                  <td className="py-2 px-3 font-mono font-semibold text-emerald-400">
                                    {batch.batch_number}
                                  </td>
                                  <td className="py-2 px-3 font-mono text-slate-400">
                                    {batch.mfg_date}
                                  </td>
                                  <td className="py-2 px-3 font-mono text-slate-200">
                                    {batch.expiry_date}
                                  </td>
                                  <td className="py-2 px-3">
                                    {isSoon ? (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                                        Expiring in {batch.days_to_expiry}d
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                                        Valid ({batch.days_to_expiry}d left)
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-slate-400">
                                    ₹{batch.purchase_price.toFixed(2)}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-slate-400 line-through">
                                    ₹{batch.mrp.toFixed(2)}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-white">
                                    ₹{batch.selling_price.toFixed(2)}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                                    {batch.available_qty} {product.base_unit}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CHEMICAL SUBSTITUTE MODAL */}
      {substituteModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-white text-base">
                    Active Chemical Substitute Lookup
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Active Formula: <span className="font-mono text-amber-300 font-semibold">{substituteModal.composition}</span>
                </p>
              </div>
              <button
                onClick={() => setSubstituteModal({ ...substituteModal, isOpen: false })}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {substituteModal.loading ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Querying brand inventory for matching active compounds...
                </div>
              ) : substituteModal.results.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No other stocked brands found with this exact active composition.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-slate-400 font-medium">
                    Found {substituteModal.results.length} brand{substituteModal.results.length > 1 ? 's' : ''} with identical bio-chemical activity:
                  </div>

                  {substituteModal.results.map((sub) => {
                    const isCurrent = substituteModal.sourceProduct?.product_id === sub.product_id;
                    return (
                      <div
                        key={sub.product_id}
                        className={`p-4 rounded-xl border transition ${
                          isCurrent 
                            ? 'bg-slate-950/60 border-slate-800' 
                            : 'bg-slate-800/40 border-emerald-500/30 hover:border-emerald-500/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-white text-sm">{sub.name}</h4>
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-semibold">
                                {sub.brand}
                              </span>
                              {isCurrent && (
                                <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono">
                                  Current Selected
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              HSN: {sub.hsn_code} • GST: {sub.gst_slab}% • Category: {sub.category}
                            </div>
                            <div className="text-xs text-slate-300 mt-1">
                              Active Batches: {sub.active_batches?.length || 0} batches in stock
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-base font-extrabold text-emerald-400">
                              {sub.total_stock} <span className="text-xs font-normal text-slate-400">{sub.base_unit}</span>
                            </div>
                            <div className="text-xs font-mono text-slate-300">
                              ₹{sub.min_selling_price?.toFixed(2)}
                            </div>
                            {!isCurrent && (
                              <button
                                onClick={() => {
                                  setSubstituteModal({ ...substituteModal, isOpen: false });
                                  onNavigateToPOS(sub.product_id);
                                }}
                                className="mt-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1 rounded-lg transition"
                              >
                                Bill Substitute
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
              <button
                onClick={() => setSubstituteModal({ ...substituteModal, isOpen: false })}
                className="text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl transition"
              >
                Close Substitute Finder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
