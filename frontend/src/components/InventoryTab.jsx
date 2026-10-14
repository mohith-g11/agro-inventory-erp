import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Sparkles, 
  X, 
  ChevronDown, 
  ChevronUp,
  Receipt,
  RotateCcw
} from 'lucide-react';
import { searchSubstitutes } from '../services/api';

export default function InventoryTab({ 
  inventory = [], 
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
    { id: 'ALL', label: 'All Items' },
    { id: 'Seeds', label: 'Seeds' },
    { id: 'NPK_Fertilizer', label: 'NPK Fertilizers' },
    { id: 'Bio_Fertilizer', label: 'Bio Fertilizers' },
    { id: 'Insecticide', label: 'Insecticides' },
    { id: 'Pesticide', label: 'Pesticides' },
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
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Stock & Substitutes
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Search products, view batch stock, and find alternative brands with identical chemical compounds
          </p>
        </div>

        {/* Quick Demo Test Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Quick Filters:</span>
          <button
            onClick={() => handleQuickFilter('Imidacloprid 17.8% SL')}
            className="text-xs bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-lg font-medium transition active:scale-95 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Imidacloprid 17.8% SL
          </button>
          <button
            onClick={() => handleQuickFilter('NPK 19:19:19')}
            className="text-xs bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 px-3 py-1.5 rounded-lg font-medium transition active:scale-95 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            NPK 19:19:19
          </button>
          {(searchTerm || selectedCategory !== 'ALL') && (
            <button
              onClick={() => { setSearchTerm(''); setSelectedCategory('ALL'); }}
              className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
        {/* Large Search Input */}
        <div className="relative w-full">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Product Name, Brand, Formula (e.g., Imidacloprid, NPK), or HSN..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-11 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Category:
          </span>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`text-xs px-3 py-1.5 rounded-lg transition font-medium ${
                selectedCategory === cat.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clean Structured Product Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Available Inventory ({filteredProducts.length} Products)
          </span>
          <span className="text-xs text-slate-400">
            Batches sorted by earliest expiry date
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Loading products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No matching products found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-4">1. Product & Brand</th>
                  <th className="py-3 px-4">2. Category & GST</th>
                  <th className="py-3 px-4">3. Active Chemical / Formula</th>
                  <th className="py-3 px-4 text-right">4. Price (₹)</th>
                  <th className="py-3 px-4 text-right">5. Available Stock</th>
                  <th className="py-3 px-4 text-center">6. Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredProducts.map((product) => {
                  const isExpanded = expandedProduct === product.product_id;
                  const hasAlert = product.has_expiring_soon;
                  const isLowStock = product.is_low_stock;
                  const samplePrice = product.batches.length > 0 ? product.batches[0].selling_price : 0;

                  return (
                    <React.Fragment key={product.product_id}>
                      {/* Product Main Row */}
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        {/* 1. Product & Brand */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {product.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {product.brand} • <span className="font-mono text-slate-400">HSN: {product.hsn_code}</span>
                          </div>
                        </td>

                        {/* 2. Category & GST */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            {product.category.replace('_', ' ')}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {product.gst_slab}% GST
                          </div>
                        </td>

                        {/* 3. Active Chemical / Formula */}
                        <td className="py-3.5 px-4">
                          <div className="inline-block bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-1 rounded text-xs font-mono font-medium border border-slate-200 dark:border-slate-700">
                            {product.chemical_composition}
                          </div>
                          <div className="mt-1">
                            <button
                              onClick={() => handleOpenSubstitutes(product)}
                              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium inline-flex items-center gap-1"
                            >
                              <Sparkles className="w-3 h-3" />
                              Find Substitute
                            </button>
                          </div>
                        </td>

                        {/* 4. Selling Price */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          ₹{samplePrice?.toFixed(2)}
                          <div className="text-[11px] font-normal text-slate-400">per {product.base_unit}</div>
                        </td>

                        {/* 5. Available Stock */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="text-base font-extrabold text-slate-900 dark:text-white">
                            {product.total_stock} <span className="text-xs font-normal text-slate-500">{product.base_unit}</span>
                          </div>
                          <div className="flex items-center justify-end gap-1.5 mt-0.5">
                            {hasAlert && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                                Expiring Soon
                              </span>
                            )}
                            {isLowStock && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                Low Stock
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 6. Action */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => onNavigateToPOS(product.product_id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition active:scale-95 inline-flex items-center gap-1"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              + Add to Bill
                            </button>

                            <button
                              onClick={() => setExpandedProduct(isExpanded ? null : product.product_id)}
                              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1.5 rounded-lg text-xs font-medium transition inline-flex items-center gap-1"
                              title="Toggle Batch Details"
                            >
                              <span>Batches</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Batches Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50 dark:bg-slate-950/60">
                          <td colSpan={6} className="p-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-800 space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                                <span>Batch Stock Ledger (First-Expired First-Out Order)</span>
                                <span>Bulk Unit: 1 {product.bulk_unit} = {product.conversion_factor} {product.base_unit}</span>
                              </div>

                              <table className="w-full text-xs text-left">
                                <thead>
                                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                                    <th className="py-1.5">Batch Number</th>
                                    <th className="py-1.5">Mfg Date</th>
                                    <th className="py-1.5">Expiry Date</th>
                                    <th className="py-1.5">Validity</th>
                                    <th className="py-1.5 text-right">Cost (₹)</th>
                                    <th className="py-1.5 text-right">MRP (₹)</th>
                                    <th className="py-1.5 text-right">Selling Price (₹)</th>
                                    <th className="py-1.5 text-right">Available Qty</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                  {product.batches.map((b) => (
                                    <tr key={b.batch_id} className="text-slate-700 dark:text-slate-300">
                                      <td className="py-1.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                                        {b.batch_number}
                                      </td>
                                      <td className="py-1.5 font-mono text-slate-500">{b.mfg_date}</td>
                                      <td className="py-1.5 font-mono text-slate-700 dark:text-slate-300">{b.expiry_date}</td>
                                      <td className="py-1.5">
                                        {b.is_expiring_soon ? (
                                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                                            {b.days_to_expiry} days left
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-slate-500">
                                            {b.days_to_expiry} days left
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-1.5 text-right font-mono text-slate-500">₹{b.purchase_price.toFixed(2)}</td>
                                      <td className="py-1.5 text-right font-mono text-slate-500 line-through">₹{b.mrp.toFixed(2)}</td>
                                      <td className="py-1.5 text-right font-mono font-bold text-slate-900 dark:text-white">₹{b.selling_price.toFixed(2)}</td>
                                      <td className="py-1.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                        {b.available_qty} {product.base_unit}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Clean Substitute Modal */}
      {substituteModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Chemical Substitutes
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Formula: <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{substituteModal.composition}</span>
                </p>
              </div>
              <button
                onClick={() => setSubstituteModal({ ...substituteModal, isOpen: false })}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-3">
              {substituteModal.loading ? (
                <div className="py-8 text-center text-slate-400 text-sm">
                  Finding alternative stocked brands...
                </div>
              ) : substituteModal.results.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">
                  No other brands found with this exact chemical formula.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {substituteModal.results.map((sub) => {
                    const isCurrent = substituteModal.sourceProduct?.product_id === sub.product_id;
                    return (
                      <div
                        key={sub.product_id}
                        className={`p-3.5 rounded-lg border transition flex items-center justify-between gap-3 ${
                          isCurrent 
                            ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700' 
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-500'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white text-sm">{sub.name}</span>
                            <span className="text-xs text-slate-500">({sub.brand})</span>
                            {isCurrent && (
                              <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded font-medium">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            HSN: {sub.hsn_code} • GST: {sub.gst_slab}% • Category: {sub.category}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {sub.total_stock} {sub.base_unit}
                          </div>
                          <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                            ₹{sub.min_selling_price?.toFixed(2)}
                          </div>
                          {!isCurrent && (
                            <button
                              onClick={() => {
                                setSubstituteModal({ ...substituteModal, isOpen: false });
                                onNavigateToPOS(sub.product_id);
                              }}
                              className="mt-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-2.5 py-1 rounded transition"
                            >
                              Bill This
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex justify-end">
              <button
                onClick={() => setSubstituteModal({ ...substituteModal, isOpen: false })}
                className="text-xs font-medium bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
