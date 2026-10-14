import React from 'react';
import { Printer, X, CheckCircle, ShieldCheck, Sprout } from 'lucide-react';

export default function InvoiceModal({ invoice, onClose }) {
  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Top Control Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-white text-sm">
              GST Tax Invoice Generated Successfully
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Container */}
        <div className="p-6 overflow-y-auto bg-white text-slate-900 font-sans print:p-0">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Sprout className="w-6 h-6 text-emerald-700" />
              <h1 className="text-xl font-extrabold tracking-tight text-slate-950 uppercase">
                Sri Mathurshree Agro Kendra
              </h1>
            </div>
            <p className="text-xs font-semibold text-slate-700">
              Retail & Wholesale Agricultural Inputs • Mysore - Nanjangud Main Road, Karnataka - 571301
            </p>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-600 mt-2">
              <span><strong>GSTIN:</strong> 29AAACS1234F1Z5</span>
              <span><strong>Fertilizer Lic:</strong> MYS/AGR/FERT/2024/7821</span>
              <span><strong>Insecticide Lic:</strong> KA/MYS/INS/2023/4510</span>
            </div>
          </div>

          {/* Invoice Meta & Farmer Details */}
          <div className="grid grid-cols-2 gap-4 py-3 border-b border-slate-200 text-xs">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500">Billed To (Farmer):</div>
              <div className="font-bold text-sm text-slate-900">{invoice.farmer_name}</div>
              <div className="text-slate-600">Village: {invoice.village || 'Mysuru District'}</div>
              <div className="text-slate-600">Phone: {invoice.phone || 'Farmer Khata Account'}</div>
            </div>

            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-slate-500">Tax Invoice No:</div>
              <div className="font-mono font-bold text-sm text-emerald-800">{invoice.invoice_number}</div>
              <div className="text-slate-600 font-mono">Date: {invoice.invoice_date || new Date().toLocaleString()}</div>
              <div className="text-slate-600 font-semibold">Payment: {invoice.payment_mode?.replace('_', ' ')}</div>
            </div>
          </div>

          {/* Line Items Table with Batch No & Expiry */}
          <div className="py-3">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                  <th className="py-2 px-2">#</th>
                  <th className="py-2 px-2">Description & Batch Lot</th>
                  <th className="py-2 px-2">Expiry</th>
                  <th className="py-2 px-2 text-right">Qty</th>
                  <th className="py-2 px-2 text-right">Rate (₹)</th>
                  <th className="py-2 px-2 text-right">Taxable</th>
                  <th className="py-2 px-2 text-right">GST</th>
                  <th className="py-2 px-2 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoice.items && invoice.items.map((item, idx) => (
                  <tr key={idx} className="text-slate-800">
                    <td className="py-2 px-2 font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-2">
                      <div className="font-bold text-slate-900">{item.product_name}</div>
                      <div className="font-mono text-[11px] text-slate-600">Batch: {item.batch_number}</div>
                    </td>
                    <td className="py-2 px-2 font-mono text-[11px] text-slate-700">
                      {item.expiry_date}
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-bold">
                      {item.qty_billed}
                    </td>
                    <td className="py-2 px-2 text-right font-mono">
                      {item.unit_price?.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono">
                      {(item.qty_billed * item.unit_price)?.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-[11px]">
                      {item.gst_rate}% (CGST {item.gst_rate/2}% + SGST {item.gst_rate/2}%)
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-slate-950">
                      {item.line_total?.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Invoice Totals & Settlement */}
          <div className="border-t-2 border-slate-300 pt-3 flex flex-col md:flex-row justify-between gap-4 text-xs">
            <div className="space-y-1.5 md:w-1/2">
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-[10px] text-slate-600 space-y-1">
                <div className="font-bold text-slate-800 uppercase">Statutory Regulatory Compliance Declaration:</div>
                <p>
                  Certified that the agro-chemicals, bio-fertilizers, and certified seeds sold herein are delivered in original manufacturer tamper-evident packaging and are compliant with the Insecticides Act 1968 and Fertilizer Control Order 1985.
                </p>
              </div>

              {invoice.balance_added_to_khata > 0 && (
                <div className="p-2 bg-sky-50 border border-sky-200 rounded text-sky-900 font-medium text-[11px]">
                  ₹{invoice.balance_added_to_khata.toFixed(2)} posted to Farmer Seasonal Credit Khata.
                </div>
              )}
            </div>

            <div className="md:w-5/12 space-y-1 font-mono">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-sans">Subtotal (Taxable):</span>
                <span className="font-bold">₹{invoice.subtotal?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-sans">Central GST (CGST 50%):</span>
                <span>₹{invoice.total_cgst?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-sans">State GST (SGST 50%):</span>
                <span>₹{invoice.total_sgst?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1.5 text-sm font-extrabold text-slate-950 border-b-2 border-slate-900">
                <span className="font-sans">Grand Total:</span>
                <span>₹{invoice.grand_total?.toFixed(2)}</span>
              </div>

              <div className="flex justify-between py-1 text-slate-700">
                <span className="font-sans">Amount Paid ({invoice.payment_mode?.replace('_', ' ')}):</span>
                <span>₹{invoice.amount_paid?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-700">
                <span className="font-sans">Balance to Khata:</span>
                <span className="font-bold text-emerald-700">₹{invoice.balance_added_to_khata?.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-8 pt-4 border-t border-slate-300 flex justify-between text-xs text-slate-600">
            <div className="text-center">
              <div className="w-36 border-b border-slate-400 mb-1"></div>
              <span>Farmer's Signature</span>
            </div>
            <div className="text-center">
              <div className="w-48 border-b border-slate-400 mb-1"></div>
              <span className="font-bold">For Sri Mathurshree Agro Kendra</span>
              <div className="text-[10px] text-slate-500">Authorized Signatory</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
