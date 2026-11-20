import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  X, 
  FileText, 
  Receipt, 
  CheckCircle, 
  Sprout, 
  AlertCircle, 
  RefreshCw,
  Building,
  Calendar,
  CreditCard,
  UserCheck
} from 'lucide-react';
import { fetchInvoiceById } from '../services/api';

export default function PrintableInvoiceModal({ invoiceId, onClose }) {
  const [format, setFormat] = useState('a4'); // 'a4' | 'thermal'
  const [invoiceData, setInvoiceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadInvoice = async () => {
    if (!invoiceId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchInvoiceById(invoiceId);
      setInvoiceData(data);
    } catch (err) {
      console.error('Error fetching invoice details:', err);
      setError(err.message || `Failed to load invoice #${invoiceId}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto print-modal-backdrop">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden my-auto print-modal-container">
        
        {/* ========================================================================= */}
        {/* TOP ACTION / CONTROL BAR (Always Hidden on Print: .no-print)              */}
        {/* ========================================================================= */}
        <div className="no-print p-3 sm:p-4 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <span className="font-bold text-white text-sm sm:text-base block">
                Official GST Tax Invoice
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {invoiceData ? invoiceData.invoice.invoice_number : `Loading #${invoiceId}...`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Format Toggle: A4 Tax Invoice vs 80mm Thermal */}
            <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setFormat('a4')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                  format === 'a4'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">A4 Tax Invoice</span>
                <span className="sm:hidden">A4</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('thermal')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                  format === 'thermal'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">80mm Thermal</span>
                <span className="sm:hidden">Thermal</span>
              </button>
            </div>

            {/* Print / Save PDF Button */}
            <button
              onClick={handlePrint}
              disabled={loading || !!error}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 ${
                loading || !!error
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-1.5 rounded-lg transition"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PREVIEW CONTAINER: Crisp White Paper Sheet (Forces Light on Paper)        */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-800/60 dark:bg-slate-950 flex justify-center items-start">
          
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
              <span className="text-sm font-medium">Fetching official GST invoice details...</span>
            </div>
          ) : error ? (
            <div className="p-6 bg-red-950/40 border border-red-800/80 rounded-xl text-red-200 max-w-md text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
              <div className="font-bold text-sm">Failed to Load Invoice</div>
              <div className="text-xs text-red-300">{error}</div>
              <button
                onClick={loadInvoice}
                className="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : !invoiceData ? null : (
            
            /* ===================================================================== */
            /* #printable-invoice (The exact target extracted for print)             */
            /* ===================================================================== */
            <div
              id="printable-invoice"
              className={`bg-white text-slate-900 shadow-2xl rounded-sm transition-all duration-200 ${
                format === 'thermal'
                  ? 'thermal-print w-[310px] sm:w-[320px] p-4 text-[11px] font-mono leading-tight'
                  : 'w-full max-w-[820px] p-6 sm:p-8 text-xs font-sans leading-normal'
              }`}
            >
              {format === 'a4' ? (
                /* ================================================================= */
                /* A4 GST TAX INVOICE LAYOUT                                         */
                /* ================================================================= */
                <div className="space-y-4">
                  {/* Top Store Header */}
                  <div className="border-b-2 border-slate-900 pb-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Sprout className="w-7 h-7 text-emerald-700 inline-block" />
                      <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 uppercase">
                        {invoiceData.store.name}
                      </h1>
                    </div>
                    <p className="text-xs font-semibold text-slate-700 mt-0.5">
                      Retail & Wholesale Agricultural Inputs • Mysore - Nanjangud Main Road, Mysuru, Karnataka - 571301
                    </p>
                    <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-700 mt-2">
                      <span><strong>GSTIN:</strong> {invoiceData.store.gstin}</span>
                      <span><strong>State:</strong> Karnataka ({invoiceData.store.state_code})</span>
                      <span><strong>Fertilizer Lic:</strong> {invoiceData.store.fertilizer_license}</span>
                      <span><strong>Insecticide Lic:</strong> {invoiceData.store.insecticide_license}</span>
                    </div>

                    <div className="mt-2.5 inline-block bg-slate-950 text-white font-black text-[10px] tracking-widest uppercase px-3 py-0.5 rounded">
                      TAX INVOICE (ORIGINAL FOR RECIPIENT)
                    </div>
                  </div>

                  {/* Customer (Farmer) & Invoice Details Grid */}
                  <div className="grid grid-cols-2 gap-4 border border-slate-300 rounded p-3 text-xs bg-slate-50/50">
                    {/* Left: Farmer Details */}
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Billed To (Farmer):
                      </div>
                      <div className="text-sm font-extrabold text-slate-950">
                        {invoiceData.invoice.customer.farmer_name}
                      </div>
                      <div className="text-slate-700">
                        <span className="font-semibold">Village:</span> {invoiceData.invoice.customer.village}
                      </div>
                      <div className="text-slate-700 font-mono">
                        <span className="font-semibold font-sans">Phone:</span> {invoiceData.invoice.customer.phone}
                      </div>
                      <div className="text-slate-700">
                        <span className="font-semibold">Primary Crop:</span> {invoiceData.invoice.customer.primary_crop}
                      </div>
                    </div>

                    {/* Right: Invoice Metadata */}
                    <div className="space-y-1 text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Invoice Particulars:
                      </div>
                      <div className="text-sm font-black font-mono text-emerald-800">
                        #{invoiceData.invoice.invoice_number}
                      </div>
                      <div className="text-slate-700 font-mono">
                        <span className="font-semibold font-sans">Date:</span> {invoiceData.invoice.invoice_date}
                      </div>
                      <div className="text-slate-700">
                        <span className="font-semibold">Place of Supply:</span> Karnataka (29)
                      </div>
                      <div className="text-slate-700">
                        <span className="font-semibold">Payment Mode:</span>{' '}
                        <span className="font-bold text-slate-900 bg-emerald-100 px-1.5 py-0.5 rounded text-[11px]">
                          {invoiceData.invoice.payment_mode.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Itemized Products Table */}
                  <div>
                    <table className="w-full text-xs text-left border border-slate-300 border-collapse">
                      <thead>
                        <tr className="bg-slate-200/80 text-slate-800 font-bold uppercase text-[10px] border-b border-slate-300">
                          <th className="py-2 px-2 border-r border-slate-300 w-8 text-center">#</th>
                          <th className="py-2 px-2 border-r border-slate-300">Product & Brand</th>
                          <th className="py-2 px-2 border-r border-slate-300 font-mono text-center">HSN</th>
                          <th className="py-2 px-2 border-r border-slate-300 font-mono">Batch & Exp</th>
                          <th className="py-2 px-2 border-r border-slate-300 text-right">Qty</th>
                          <th className="py-2 px-2 border-r border-slate-300 text-right">Rate (₹)</th>
                          <th className="py-2 px-2 border-r border-slate-300 text-right">Taxable (₹)</th>
                          <th className="py-2 px-2 border-r border-slate-300 text-right">GST %</th>
                          <th className="py-2 px-2 text-right">Total (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {invoiceData.items.map((item, idx) => (
                          <tr key={item.item_id || idx} className="text-slate-800">
                            <td className="py-1.5 px-2 border-r border-slate-200 text-center font-mono text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-200">
                              <div className="font-bold text-slate-950">{item.product_name}</div>
                              <div className="text-[11px] text-slate-600">{item.brand}</div>
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-200 font-mono text-center text-slate-700">
                              {item.hsn_code}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-200 font-mono text-[11px] text-slate-700">
                              <div>{item.batch_number}</div>
                              <div className="text-[10px] text-slate-500">Exp: {item.expiry_date}</div>
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-200 text-right font-mono font-bold">
                              {item.quantity} {item.unit}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-200 text-right font-mono">
                              {item.unit_price.toFixed(2)}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-200 text-right font-mono">
                              {item.taxable_value.toFixed(2)}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-200 text-right font-mono text-[11px]">
                              {item.gst_rate}%
                              <div className="text-[9px] text-slate-500">
                                ({item.cgst_rate}%+{item.sgst_rate}%)
                              </div>
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-950">
                              {item.line_total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Slab-wise GST Summary Breakdown */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      GST Slab-wise Tax Breakdown (CGST & SGST)
                    </div>
                    <table className="w-full text-[11px] text-left border border-slate-300 border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[9px] border-b border-slate-300">
                          <th className="py-1.5 px-2 border-r border-slate-300">GST Slab Rate</th>
                          <th className="py-1.5 px-2 border-r border-slate-300 text-right">Taxable Value (₹)</th>
                          <th className="py-1.5 px-2 border-r border-slate-300 text-right">CGST Amount (₹)</th>
                          <th className="py-1.5 px-2 border-r border-slate-300 text-right">SGST Amount (₹)</th>
                          <th className="py-1.5 px-2 text-right">Total Tax (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {invoiceData.gst_summary.map((slab) => (
                          <tr key={slab.gst_rate} className="font-mono text-slate-800">
                            <td className="py-1.5 px-2 border-r border-slate-200 font-bold">
                              GST {slab.gst_rate}% (CGST {slab.gst_rate/2}% + SGST {slab.gst_rate/2}%)
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-200 text-right">
                              ₹{slab.taxable_value.toFixed(2)}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-200 text-right">
                              ₹{slab.cgst_amount.toFixed(2)}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-200 text-right">
                              ₹{slab.sgst_amount.toFixed(2)}
                            </td>
                            <td className="py-1.5 px-2 text-right font-bold">
                              ₹{slab.total_tax.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-mono font-bold text-slate-900 border-t border-slate-300">
                          <td className="py-1.5 px-2 border-r border-slate-300">Total Tax Breakdown:</td>
                          <td className="py-1.5 px-2 border-r border-slate-300 text-right">
                            ₹{invoiceData.totals.taxable_subtotal.toFixed(2)}
                          </td>
                          <td className="py-1.5 px-2 border-r border-slate-300 text-right">
                            ₹{invoiceData.totals.total_cgst.toFixed(2)}
                          </td>
                          <td className="py-1.5 px-2 border-r border-slate-300 text-right">
                            ₹{invoiceData.totals.total_sgst.toFixed(2)}
                          </td>
                          <td className="py-1.5 px-2 text-right text-emerald-800">
                            ₹{invoiceData.totals.total_tax.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Totals Summary & Words */}
                  <div className="grid grid-cols-12 gap-4 pt-1">
                    {/* Left: Words & Payment Details (7 Cols) */}
                    <div className="col-span-7 space-y-2 border border-slate-200 rounded p-3 bg-slate-50/50">
                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-500">
                          Amount Chargeable in Words:
                        </div>
                        <div className="font-bold text-slate-900 text-xs mt-0.5 italic">
                          {invoiceData.totals.amount_in_words}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200 space-y-1 text-[11px]">
                        <div className="flex justify-between text-slate-700">
                          <span>Payment Settlement:</span>
                          <span className="font-bold font-mono">
                            {invoiceData.invoice.payment_mode.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-700">
                          <span>Amount Paid at Counter:</span>
                          <span className="font-bold font-mono text-emerald-700">
                            ₹{invoiceData.invoice.amount_paid.toFixed(2)}
                          </span>
                        </div>
                        {invoiceData.invoice.balance_added_to_khata > 0 && (
                          <div className="flex justify-between text-sky-800 font-semibold">
                            <span>Balance Added to Khata (Credit):</span>
                            <span className="font-bold font-mono">
                              ₹{invoiceData.invoice.balance_added_to_khata.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="text-[9px] text-slate-500 pt-2 border-t border-slate-200 space-y-0.5">
                        <p>1. Certified that the agro-inputs supplied are of original manufacturer batch packing.</p>
                        <p>2. Subject to Mysuru jurisdiction. E. & O.E.</p>
                      </div>
                    </div>

                    {/* Right: Totals Box (5 Cols) */}
                    <div className="col-span-5 bg-slate-50 border border-slate-300 rounded p-3 space-y-1.5 font-mono text-xs">
                      <div className="flex justify-between text-slate-700">
                        <span>Taxable Subtotal:</span>
                        <span>₹{invoiceData.totals.taxable_subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>Total CGST:</span>
                        <span>₹{invoiceData.totals.total_cgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>Total SGST:</span>
                        <span>₹{invoiceData.totals.total_sgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-700 pb-1 border-b border-slate-300">
                        <span>Total Tax Amount:</span>
                        <span>₹{invoiceData.totals.total_tax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-baseline pt-1 text-slate-950 font-bold">
                        <span className="text-sm font-sans">Grand Total:</span>
                        <span className="text-base text-emerald-800 font-black">
                          ₹{invoiceData.totals.grand_total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Signatory Footer */}
                  <div className="pt-6 grid grid-cols-2 gap-4 border-t border-slate-300 text-xs">
                    <div className="flex flex-col justify-end">
                      <div className="border-t border-dashed border-slate-400 w-44 pt-1 text-[11px] text-slate-600">
                        Customer / Farmer Signature
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end justify-end">
                      <div className="font-bold text-slate-900 text-xs">
                        For Sri Mathurshree Agro Kendra
                      </div>
                      {invoiceData.invoice.billed_by && (
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Billed by: {invoiceData.invoice.billed_by}
                        </div>
                      )}
                      <div className="h-8"></div>
                      <div className="border-t border-dashed border-slate-400 w-44 pt-1 text-[11px] text-slate-600 text-center">
                        Authorized Signatory
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ================================================================= */
                /* 80mm THERMAL RECEIPT LAYOUT                                       */
                /* ================================================================= */
                <div className="space-y-2 text-slate-900 font-mono">
                  {/* Thermal Header */}
                  <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-slate-400">
                    <div className="font-extrabold text-sm uppercase tracking-tight">
                      {invoiceData.store.name}
                    </div>
                    <div className="text-[10px] text-slate-700">
                      Mysore - Nanjangud Main Rd, Mysuru
                    </div>
                    <div className="text-[10px] text-slate-700">
                      GSTIN: {invoiceData.store.gstin} (State: 29)
                    </div>
                    <div className="text-[9px] text-slate-600">
                      Fert: {invoiceData.store.fertilizer_license}
                    </div>
                    <div className="text-[9px] text-slate-600">
                      Ins: {invoiceData.store.insecticide_license}
                    </div>
                    <div className="pt-1 font-bold text-xs uppercase tracking-wider">
                      *** TAX INVOICE ***
                    </div>
                  </div>

                  {/* Invoice & Farmer Info */}
                  <div className="space-y-0.5 text-[10px] py-1 border-b border-dashed border-slate-400">
                    <div className="flex justify-between">
                      <span className="font-bold">INV #:</span>
                      <span className="font-bold">{invoiceData.invoice.invoice_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>DATE:</span>
                      <span>{invoiceData.invoice.invoice_date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>FARMER:</span>
                      <span className="font-bold">{invoiceData.invoice.customer.farmer_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>VILLAGE:</span>
                      <span>{invoiceData.invoice.customer.village}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>PAY MODE:</span>
                      <span className="font-bold">{invoiceData.invoice.payment_mode.replace('_', ' ')}</span>
                    </div>
                  </div>

                  {/* Items Condensed List */}
                  <div className="py-1 border-b border-dashed border-slate-400 space-y-2">
                    <div className="text-[10px] font-bold flex justify-between border-b border-slate-200 pb-0.5">
                      <span>ITEM / BATCH</span>
                      <span>QTY x RATE</span>
                      <span>TOTAL</span>
                    </div>
                    {invoiceData.items.map((item, idx) => (
                      <div key={item.item_id || idx} className="text-[10px] space-y-0.5">
                        <div className="font-bold text-slate-950">
                          {idx + 1}. {item.product_name}
                        </div>
                        <div className="text-[9px] text-slate-600 flex justify-between">
                          <span>B:{item.batch_number} (Exp:{item.expiry_date})</span>
                          <span>GST {item.gst_rate}%</span>
                        </div>
                        <div className="flex justify-between items-baseline font-mono">
                          <span>{item.quantity} {item.unit} @ ₹{item.unit_price.toFixed(2)}</span>
                          <span className="font-bold">₹{item.line_total.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals Summary */}
                  <div className="space-y-1 text-[11px] py-1 border-b border-dashed border-slate-400">
                    <div className="flex justify-between">
                      <span>Taxable Subtotal:</span>
                      <span>₹{invoiceData.totals.taxable_subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total CGST:</span>
                      <span>₹{invoiceData.totals.total_cgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total SGST:</span>
                      <span>₹{invoiceData.totals.total_sgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-slate-300">
                      <span>GRAND TOTAL:</span>
                      <span>₹{invoiceData.totals.grand_total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Words & Payment Details */}
                  <div className="space-y-1 text-[10px] py-1 border-b border-dashed border-slate-400">
                    <div className="italic text-[9px] leading-tight">
                      {invoiceData.totals.amount_in_words}
                    </div>
                    <div className="flex justify-between pt-1">
                      <span>Paid at Counter:</span>
                      <span className="font-bold">₹{invoiceData.invoice.amount_paid.toFixed(2)}</span>
                    </div>
                    {invoiceData.invoice.balance_added_to_khata > 0 && (
                      <div className="flex justify-between font-bold text-sky-800">
                        <span>Balance to Khata:</span>
                        <span>₹{invoiceData.invoice.balance_added_to_khata.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Slab GST Summary */}
                  <div className="text-[9px] space-y-0.5 py-1 border-b border-dashed border-slate-400">
                    <div className="font-bold text-[9px] uppercase">GST Summary:</div>
                    {invoiceData.gst_summary.map((s) => (
                      <div key={s.gst_rate} className="flex justify-between">
                        <span>GST {s.gst_rate}% (Taxable ₹{s.taxable_value.toFixed(0)}):</span>
                        <span>Tax ₹{s.total_tax.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Thermal Footer */}
                  <div className="text-center pt-2 space-y-1 text-[10px]">
                    <div className="font-semibold">Thank you for your purchase!</div>
                    <div className="text-[9px] text-slate-600">Goods once sold cannot be returned.</div>
                    <div className="pt-2 text-[9px] font-bold">Authorized Signatory</div>
                    {invoiceData.invoice.billed_by && (
                      <div className="text-[8px] text-slate-500 font-mono">
                        Billed by: {invoiceData.invoice.billed_by}
                      </div>
                    )}
                    <div>Sri Mathurshree Agro Kendra</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
