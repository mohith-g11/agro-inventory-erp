import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Sparkles, 
  X, 
  ChevronDown, 
  ChevronUp,
  Receipt,
  RotateCcw,
  Plus,
  PackagePlus,
  Layers,
  AlertCircle,
  CheckCircle2,
  Truck
} from 'lucide-react';
import { 
  searchSubstitutes, 
  createBatch, 
  createProduct, 
  fetchSuppliers 
} from '../services/api';

export default function InventoryTab({ 
  inventory = [], 
  loading, 
  onNavigateToPOS, 
  initialSearch = '',
  onRefresh,
  onBatchAdded
}) {
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [expandedProduct, setExpandedProduct] = useState(null);
  
  // Notification banner state
  const [notification, setNotification] = useState(null);

  // Substitute Modal State
  const [substituteModal, setSubstituteModal] = useState({
    isOpen: false,
    composition: '',
    sourceProduct: null,
    loading: false,
    results: []
  });

  // Suppliers list for GRN batch inward
  const [suppliers, setSuppliers] = useState([]);

  // 1. Add Stock Batch Modal State
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchForm, setBatchForm] = useState({
    product_id: '',
    batch_number: '',
    mfg_date: '',
    expiry_date: '',
    purchase_price: '',
    mrp: '',
    selling_price: '',
    quantity: '',
    supplier_id: ''
  });
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchError, setBatchError] = useState(null);

  // 2. New Product Modal State
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productForm, setProductForm] = useState({
    name: '',
    brand: '',
    category: 'NPK_Fertilizer',
    chemical_composition: '',
    hsn_code: '31052000',
    gst_slab: '5',
    base_unit: 'Kg',
    bulk_unit: 'Bag',
    conversion_factor: '50.0',
    reorder_level: '10.0'
  });
  const [productSubmitting, setProductSubmitting] = useState(false);
  const [productError, setProductError] = useState(null);

  const categories = [
    { id: 'ALL', label: 'All Items' },
    { id: 'Seeds', label: 'Seeds' },
    { id: 'NPK_Fertilizer', label: 'NPK Fertilizers' },
    { id: 'Bio_Fertilizer', label: 'Bio Fertilizers' },
    { id: 'Insecticide', label: 'Insecticides' },
    { id: 'Pesticide', label: 'Pesticides' },
  ];

  // Auto-dismiss notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Load suppliers lazily when batch modal opens
  const loadSuppliersList = async () => {
    try {
      const sups = await fetchSuppliers();
      setSuppliers(sups);
    } catch (err) {
      console.warn('Could not load suppliers list:', err);
    }
  };

  const handleOpenAddBatch = (productId = null) => {
    setBatchError(null);
    loadSuppliersList();
    const defaultProdId = productId ? String(productId) : (inventory[0] ? String(inventory[0].product_id) : '');
    setBatchForm({
      product_id: defaultProdId,
      batch_number: '',
      mfg_date: new Date().toISOString().split('T')[0],
      expiry_date: '',
      purchase_price: '',
      mrp: '',
      selling_price: '',
      quantity: '',
      supplier_id: suppliers[0] ? String(suppliers[0].supplier_id) : ''
    });
    setBatchModalOpen(true);
  };

  const handleOpenNewProduct = () => {
    setProductError(null);
    setProductForm({
      name: '',
      brand: '',
      category: 'NPK_Fertilizer',
      chemical_composition: '',
      hsn_code: '31052000',
      gst_slab: '5',
      base_unit: 'Kg',
      bulk_unit: 'Bag',
      conversion_factor: '50.0',
      reorder_level: '10.0'
    });
    setProductModalOpen(true);
  };

  // Helper when category changes in Product Form
  const handleCategoryChange = (newCat) => {
    let defaultGst = '5';
    let defaultBase = 'Kg';
    let defaultBulk = 'Bag';
    let defaultFactor = '50.0';
    let defaultHsn = '31052000';

    if (newCat === 'Seeds') {
      defaultGst = '0';
      defaultBase = 'Packet';
      defaultBulk = 'Box';
      defaultFactor = '20.0';
      defaultHsn = '12072100';
    } else if (newCat === 'Insecticide' || newCat === 'Pesticide') {
      defaultGst = '18';
      defaultBase = 'Bottle';
      defaultBulk = 'Box';
      defaultFactor = '20.0';
      defaultHsn = '38089199';
    } else if (newCat === 'Bio_Fertilizer') {
      defaultGst = '5';
      defaultBase = 'Liter';
      defaultBulk = 'Box';
      defaultFactor = '10.0';
      defaultHsn = '31010099';
    }

    setProductForm(prev => ({
      ...prev,
      category: newCat,
      gst_slab: defaultGst,
      base_unit: defaultBase,
      bulk_unit: defaultBulk,
      conversion_factor: defaultFactor,
      hsn_code: defaultHsn
    }));
  };

  // Handle Add Batch Submission
  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    setBatchError(null);

    // Front-end constraint enforcement
    const { product_id, batch_number, mfg_date, expiry_date, purchase_price, mrp, selling_price, quantity } = batchForm;

    if (!product_id) {
      setBatchError('Please select a catalog product.');
      return;
    }
    if (!batch_number.trim()) {
      setBatchError('Batch number is required.');
      return;
    }
    if (!mfg_date || !expiry_date) {
      setBatchError('Both manufacturing date and expiry date are required.');
      return;
    }
    if (expiry_date <= mfg_date) {
      setBatchError(`Expiry date (${expiry_date}) must be after manufacturing date (${mfg_date}).`);
      return;
    }

    const pp = parseFloat(purchase_price);
    const sp = parseFloat(selling_price);
    const maxRetail = parseFloat(mrp);
    const qty = parseFloat(quantity);

    if (isNaN(pp) || isNaN(sp) || isNaN(maxRetail) || pp <= 0 || sp <= 0 || maxRetail <= 0) {
      setBatchError('Purchase price, selling price, and MRP must be positive numbers.');
      return;
    }
    if (pp > sp) {
      setBatchError(`Purchase price (₹${pp.toFixed(2)}) cannot be greater than selling price (₹${sp.toFixed(2)}).`);
      return;
    }
    if (sp > maxRetail) {
      setBatchError(`Selling price (₹${sp.toFixed(2)}) cannot exceed MRP (₹${maxRetail.toFixed(2)}).`);
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setBatchError('Available quantity must be greater than 0.');
      return;
    }

    try {
      setBatchSubmitting(true);
      const payload = {
        product_id: parseInt(product_id, 10),
        batch_number: batch_number.trim(),
        mfg_date,
        expiry_date,
        purchase_price: pp,
        mrp: maxRetail,
        selling_price: sp,
        available_qty: qty
      };

      const result = await createBatch(payload);
      setBatchModalOpen(false);

      // Trigger immediate refresh of inventory and dashboard KPIs
      if (onBatchAdded) {
        onBatchAdded();
      } else if (onRefresh) {
        onRefresh();
      }

      setNotification({
        type: 'success',
        message: `Batch "${result.batch_number}" added successfully! Stock & dashboard KPIs updated.`
      });
    } catch (err) {
      setBatchError(err.message || 'Failed to add batch. Please check inputs.');
    } finally {
      setBatchSubmitting(false);
    }
  };

  // Handle New Product Submission
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setProductError(null);

    const { name, brand, category, chemical_composition, hsn_code, gst_slab, base_unit, bulk_unit, conversion_factor, reorder_level } = productForm;

    if (!name.trim()) {
      setProductError('Product name is required.');
      return;
    }
    if (!brand.trim()) {
      setProductError('Brand name is required.');
      return;
    }
    if (!chemical_composition.trim()) {
      setProductError('Chemical composition is required for substitute lookup.');
      return;
    }
    if (!hsn_code.trim()) {
      setProductError('HSN code is required.');
      return;
    }

    const factor = parseFloat(conversion_factor);
    const reorder = parseFloat(reorder_level);

    if (isNaN(factor) || factor <= 0) {
      setProductError('Conversion factor must be greater than 0.');
      return;
    }
    if (isNaN(reorder) || reorder < 0) {
      setProductError('Reorder level must be 0 or greater.');
      return;
    }

    try {
      setProductSubmitting(true);
      const payload = {
        name: name.trim(),
        brand: brand.trim(),
        category,
        chemical_composition: chemical_composition.trim(),
        hsn_code: hsn_code.trim(),
        gst_slab,
        base_unit,
        bulk_unit,
        conversion_factor: factor,
        reorder_level: reorder
      };

      const createdProd = await createProduct(payload);
      setProductModalOpen(false);

      // Trigger refresh
      if (onRefresh) {
        onRefresh();
      }

      setNotification({
        type: 'success',
        message: `Product "${createdProd.name}" added to catalog successfully!`
      });

      // Convenience: Ask if they want to add a batch for this new product
      setTimeout(() => {
        handleOpenAddBatch(createdProd.product_id);
      }, 300);

    } catch (err) {
      setProductError(err.message || 'Failed to create product.');
    } finally {
      setProductSubmitting(false);
    }
  };

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

  // Find currently selected product in batch modal for inline helper display
  const selectedBatchProduct = inventory.find(p => String(p.product_id) === String(batchForm.product_id));

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

      {/* Page Header with Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Stock & Substitutes
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Search products, view batch stock, and find alternative brands with identical chemical compounds
          </p>
        </div>

        {/* Action Buttons: New Product & Add Stock Batch */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleOpenNewProduct}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition active:scale-95 shadow-sm inline-flex items-center gap-1.5"
          >
            <PackagePlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            + New Product
          </button>

          <button
            onClick={() => handleOpenAddBatch()}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition active:scale-95 shadow-sm inline-flex items-center gap-1.5"
          >
            <Layers className="w-4 h-4" />
            + Add Stock Batch
          </button>
        </div>
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
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition active:scale-95 inline-flex items-center gap-1"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              + Bill
                            </button>

                            <button
                              onClick={() => handleOpenAddBatch(product.product_id)}
                              className="bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 inline-flex items-center gap-1"
                              title="Add New Batch for this product"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              + Batch
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

                              {product.batches.length === 0 ? (
                                <div className="py-4 text-center text-xs text-slate-400">
                                  No active batches recorded for this item. Click "+ Batch" above to inward stock.
                                </div>
                              ) : (
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
                              )}
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

      {/* ========================================================================= */}
      {/* MODAL 1: + Add Stock Batch (GRN Inward)                                    */}
      {/* ========================================================================= */}
      {batchModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto transition-colors">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    + Add Stock Batch (GRN Inward)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Inward new stock batch with FEFO dates and pricing constraints
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBatchModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleBatchSubmit} className="p-5 overflow-y-auto space-y-4">
              {/* Error Banner */}
              {batchError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-200 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="font-medium">{batchError}</div>
                </div>
              )}

              {/* 1. Product Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Target Product <span className="text-red-500">*</span>
                </label>
                <select
                  value={batchForm.product_id}
                  onChange={(e) => setBatchForm({ ...batchForm, product_id: e.target.value })}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Choose Product from Catalog --</option>
                  {inventory.map((p) => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.name} ({p.brand}) • {p.category.replace('_', ' ')} • Base: {p.base_unit}
                    </option>
                  ))}
                </select>

                {/* Selected Product Context Badge */}
                {selectedBatchProduct && (
                  <div className="mt-1.5 p-2 bg-slate-100 dark:bg-slate-800/60 rounded-lg text-xs text-slate-600 dark:text-slate-300 flex flex-wrap gap-x-3 gap-y-1">
                    <span><strong>Active Compound:</strong> {selectedBatchProduct.chemical_composition}</span>
                    <span><strong>HSN:</strong> {selectedBatchProduct.hsn_code}</span>
                    <span><strong>GST Slab:</strong> {selectedBatchProduct.gst_slab}%</span>
                    <span><strong>Unit Ratio:</strong> 1 {selectedBatchProduct.bulk_unit} = {selectedBatchProduct.conversion_factor} {selectedBatchProduct.base_unit}</span>
                  </div>
                )}
              </div>

              {/* 2. Batch Number & Optional Supplier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Batch Number / Lot No <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={batchForm.batch_number}
                    onChange={(e) => setBatchForm({ ...batchForm, batch_number: e.target.value })}
                    placeholder="e.g., IFF-2026-B02"
                    required
                    className="w-full font-mono uppercase bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-slate-400" />
                    Supplier / Distributor
                  </label>
                  <select
                    value={batchForm.supplier_id}
                    onChange={(e) => setBatchForm({ ...batchForm, supplier_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Direct Mfr / Stock Inward --</option>
                    {suppliers.map(s => (
                      <option key={s.supplier_id} value={s.supplier_id}>
                        {s.name} ({s.city})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Mfg Date & Expiry Date (Constraint: expiry_date > mfg_date) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Mfg Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={batchForm.mfg_date}
                    onChange={(e) => setBatchForm({ ...batchForm, mfg_date: e.target.value })}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Expiry Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={batchForm.expiry_date}
                    onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  {batchForm.mfg_date && batchForm.expiry_date && batchForm.expiry_date <= batchForm.mfg_date && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-1">
                      ⚠️ Expiry date must be after manufacturing date
                    </p>
                  )}
                </div>
              </div>

              {/* 4. Pricing (Constraint: purchase_price <= selling_price <= mrp) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Batch Pricing Tier (₹ per {selectedBatchProduct ? selectedBatchProduct.base_unit : 'base unit'}) <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Landing Cost (PP)</span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Cost"
                        value={batchForm.purchase_price}
                        onChange={(e) => setBatchForm({ ...batchForm, purchase_price: e.target.value })}
                        required
                        className="w-full pl-6 pr-2 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Store Selling Price</span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Retail"
                        value={batchForm.selling_price}
                        onChange={(e) => setBatchForm({ ...batchForm, selling_price: e.target.value })}
                        required
                        className="w-full pl-6 pr-2 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Max Retail Price (MRP)</span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="MRP"
                        value={batchForm.mrp}
                        onChange={(e) => setBatchForm({ ...batchForm, mrp: e.target.value })}
                        required
                        className="w-full pl-6 pr-2 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Inline price constraint hints */}
                {batchForm.purchase_price && batchForm.selling_price && Number(batchForm.purchase_price) > Number(batchForm.selling_price) && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-1">
                    ⚠️ Purchase price (₹{Number(batchForm.purchase_price).toFixed(2)}) cannot exceed selling price (₹{Number(batchForm.selling_price).toFixed(2)})
                  </p>
                )}
                {batchForm.selling_price && batchForm.mrp && Number(batchForm.selling_price) > Number(batchForm.mrp) && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-1">
                    ⚠️ Selling price (₹{Number(batchForm.selling_price).toFixed(2)}) cannot exceed MRP (₹{Number(batchForm.mrp).toFixed(2)})
                  </p>
                )}
              </div>

              {/* 5. Inward Quantity (Constraint: available_qty > 0) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Inward Quantity (in {selectedBatchProduct ? selectedBatchProduct.base_unit : 'base unit'}) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder={`e.g. 50 ${selectedBatchProduct ? selectedBatchProduct.base_unit : ''}`}
                    value={batchForm.quantity}
                    onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                    {selectedBatchProduct ? selectedBatchProduct.base_unit : 'Units'}
                  </span>
                </div>
                {selectedBatchProduct && batchForm.quantity && Number(batchForm.quantity) > 0 && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Equivalent to ~{(Number(batchForm.quantity) / selectedBatchProduct.conversion_factor).toFixed(2)} {selectedBatchProduct.bulk_unit}s
                  </p>
                )}
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setBatchModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={batchSubmitting}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-sm transition active:scale-95 inline-flex items-center gap-1.5"
                >
                  {batchSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Inwarding Batch...</span>
                    </>
                  ) : (
                    <>
                      <Layers className="w-3.5 h-3.5" />
                      <span>+ Add Stock Batch</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: + New Product (Catalog Item)                                     */}
      {/* ========================================================================= */}
      {productModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto transition-colors">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    + New Product (Catalog Item)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Add new agrochemical, seed, or fertilizer to 3NF inventory catalog
                  </p>
                </div>
              </div>
              <button
                onClick={() => setProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleProductSubmit} className="p-5 overflow-y-auto space-y-4">
              {/* Error Banner */}
              {productError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-200 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="font-medium">{productError}</div>
                </div>
              )}

              {/* Row 1: Product Name & Brand */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Product Trade Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="e.g. Coromandel Gromor 14:35:14"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Brand / Manufacturer <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={productForm.brand}
                    onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
                    placeholder="e.g. Coromandel, Bayer, IFFCO"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Row 2: Category & GST Slab */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={productForm.category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="NPK_Fertilizer">NPK Fertilizer</option>
                    <option value="Bio_Fertilizer">Bio Fertilizer</option>
                    <option value="Insecticide">Insecticide</option>
                    <option value="Pesticide">Pesticide / Fungicide</option>
                    <option value="Seeds">Certified Seeds</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    GST Slab <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={productForm.gst_slab}
                    onChange={(e) => setProductForm({ ...productForm, gst_slab: e.target.value })}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="0">0% (Certified Seeds)</option>
                    <option value="5">5% (Fertilizers & Bio Inputs)</option>
                    <option value="12">12% (Micronutrients / Special)</option>
                    <option value="18">18% (Agrochemicals & Pesticides)</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Active Chemical Composition / Formula */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Active Chemical Ingredient / Formula <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={productForm.chemical_composition}
                  onChange={(e) => setProductForm({ ...productForm, chemical_composition: e.target.value })}
                  placeholder="e.g. Imidacloprid 17.8% SL, NPK 19:19:19, Chlorantraniliprole 18.5% SC"
                  required
                  className="w-full font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Used by the Chemical Substitute Recommendation Engine to identify generic equivalents in stock.
                </p>
              </div>

              {/* Row 4: HSN Code & Reorder Alert Level */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    HSN Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={productForm.hsn_code}
                    onChange={(e) => setProductForm({ ...productForm, hsn_code: e.target.value })}
                    placeholder="e.g. 31052000, 38089199"
                    required
                    className="w-full font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Low Stock Alert Level <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={productForm.reorder_level}
                    onChange={(e) => setProductForm({ ...productForm, reorder_level: e.target.value })}
                    required
                    className="w-full font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Row 5: Packaging Units & Conversion Factor */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Base Unit (Retail) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={productForm.base_unit}
                    onChange={(e) => setProductForm({ ...productForm, base_unit: e.target.value })}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Kg">Kg</option>
                    <option value="Liter">Liter</option>
                    <option value="Packet">Packet</option>
                    <option value="Bottle">Bottle</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Bulk Unit (Purchase) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={productForm.bulk_unit}
                    onChange={(e) => setProductForm({ ...productForm, bulk_unit: e.target.value })}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Bag">Bag</option>
                    <option value="Quintal">Quintal</option>
                    <option value="Box">Box</option>
                    <option value="Drum">Drum</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Units per Bulk Unit <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={productForm.conversion_factor}
                    onChange={(e) => setProductForm({ ...productForm, conversion_factor: e.target.value })}
                    required
                    className="w-full font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={productSubmitting}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-sm transition active:scale-95 inline-flex items-center gap-1.5"
                >
                  {productSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating Product...</span>
                    </>
                  ) : (
                    <>
                      <PackagePlus className="w-3.5 h-3.5" />
                      <span>Create Product</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clean Substitute Modal (Existing Phase 1 feature preserved intact) */}
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