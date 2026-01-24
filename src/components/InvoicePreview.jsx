import React from 'react';
import '../invoice.css'; // Import the raw CSS provided

const InvoicePreview = ({ data }) => {
  const {
    type = 'INVOICE', // INVOICE, RECEIPT, QUOTATION
    status = 'UNPAID', // PAID, PARTIAL, UNPAID
    project = {},     // { customer, address, email, phone, date, id }
    items = [],       // Array of { room, type, desc, unitPrice, qty, total }
    totals = {}       // { total, deposit, balance }
  } = data;

  // Logic to fill empty rows if fewer than minRows - restored to 12 per user preference
  const minRows = 12;
  const emptyRows = Math.max(0, minRows - items.length);

  // Helper to render currency
  const formatCurrency = (val) => Number(val || 0).toFixed(2);

  return (
    <div className="invoice-preview-container" id="printable-invoice">
      <div className="invoice-header">
        <div className="logo-container">
          <div className="text-logo">FF</div>
          <div className="company-info">
            <strong>FAREEZ INSTALLATION SERVICES</strong><br />
            No 9 Jalan PJU10/1 Damansara Damai<br />
            47830 Petaling Jaya Selangor<br />
            Phone: +60 11-2549 5182<br />
            Email: fareezfauzimy@gmail.com
          </div>
        </div>

        <h1 className="invoice-title">{type}</h1>
      </div>

      <div className="invoice-body">
        <div className="info-section">
          <div className="client-box">
            <strong>BILL TO:</strong><br />
            {project.customer || 'Customer Name'}<br />
            {project.address || 'Address Line 1'}<br />
            {project.email}<br />
            {project.phone}
          </div>

          <div className="meta-box">
            <strong>DATE:</strong> {project.date}<br />
            <strong>DOC ID:</strong> {project.id ? (() => {
              const prefix = type === 'INVOICE' ? 'INV' :
                type === 'QUOTATION' ? 'QTN' :
                  type === 'RECEIPT' ? 'RCT' : 'JOB';
              return project.id.replace(/^[A-Z]+/, prefix);
            })() : ''}<br />
            <strong>STATUS:</strong> <span className={`font-bold uppercase ${status === 'PAID' ? 'text-emerald-600' :
              status === 'PARTIAL' ? 'text-orange-500' :
                'text-red-600'
              }`}>{status}</span>
          </div>
        </div>

        {/* Items Table - Explicit Alignment */}
        <table className="invoice-table">
          <thead>
            <tr>
              <th width="15%">Room / Area</th>
              <th width="20%">Installation Type</th>
              <th width="30%">Description</th>
              <th width="12%" className="text-right">Price (RM)</th>
              <th width="8%" className="text-center">Qty</th>
              <th width="15%" className="text-right">Total (RM)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const prevItem = items[index - 1] || {};
              const showRoom = item.room !== prevItem.room;
              const showType = item.type !== prevItem.type || showRoom;
              const itemTotal = Number(item.unitPrice || 0) * Number(item.qty || 0);

              return (
                <tr key={index}>
                  <td>{showRoom ? <strong>{item.room}</strong> : ''}</td>
                  <td>{showType ? item.type : ''}</td>
                  <td>{item.desc}</td>
                  <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="text-center">{item.qty}</td>
                  <td className="text-right font-bold">{formatCurrency(itemTotal)}</td>
                </tr>
              );
            })}
            {Array.from({ length: emptyRows }).map((_, i) => (
              <tr key={`empty-${i}`} style={{ height: '18px' }}>
                <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals Section - Aligned to Table Columns */}
        <div className="mt-1 space-y-0.5 font-jakarta text-[11px] w-full">
          {/* Subtotal Row */}
          <div className="grid grid-cols-[85%_15%] w-full">
            <div className="text-right pr-4 text-slate-500 font-medium border-b border-slate-100 pb-0.5">Subtotal</div>
            <div className="text-right font-bold text-slate-900 border-b border-slate-100 pb-0.5 px-2">RM {formatCurrency(totals.total)}</div>
          </div>

          {/* Discount Row */}
          {Number(totals.discount) > 0 && (
            <div className="grid grid-cols-[85%_15%] w-full text-red-600">
              <div className="text-right pr-4 font-medium border-b border-slate-100 pb-0.5">Discount</div>
              <div className="text-right font-bold border-b border-slate-100 pb-0.5 px-2">- RM {formatCurrency(totals.discount)}</div>
            </div>
          )}

          {/* Total Amount Row - Neutral Highlight */}
          <div className="grid grid-cols-[85%_15%] w-full my-0.5">
            <div className="flex justify-end">
              <div className="bg-slate-900 border-t-2 border-slate-900 px-4 py-1 font-bold text-white uppercase tracking-tighter rounded-bl-md">
                Total Amount
              </div>
            </div>
            <div className="bg-slate-50 border-t-2 border-slate-900 px-2 py-1 text-right font-black text-slate-900 rounded-br-md">
              RM {formatCurrency(Number(totals.total) - Number(totals.discount || 0))}
            </div>
          </div>

          {/* Deposit Row */}
          {type !== 'QUOTATION' && (
            <div className="grid grid-cols-[85%_15%] w-full">
              <div className="text-right pr-4 font-bold text-emerald-700 py-1 uppercase">{type === 'RECEIPT' ? 'Total Paid' : 'Deposit Paid'}</div>
              <div className="text-right font-bold text-emerald-700 py-1 px-2 bg-emerald-50/50 rounded-md border border-emerald-100/50">RM {formatCurrency(totals.deposit)}</div>
            </div>
          )}

          {/* Balance Due Row - Strong Accented Style (Cell-only highlight) */}
          {type === 'INVOICE' && (
            <div className="grid grid-cols-[85%_15%] w-full mt-0.5">
              <div className="flex justify-end items-center">
                <div className="bg-blue-600 px-4 py-1.5 font-black text-white uppercase italic rounded-l-lg shadow-sm">
                  Balance Due
                </div>
              </div>
              <div className="bg-blue-50 border-2 border-blue-600 border-l-0 px-2 py-1.5 text-right font-black text-blue-700 rounded-r-lg shadow-sm flex items-center justify-end">
                RM {formatCurrency(totals.balance)}
              </div>
            </div>
          )}

          {/* Quotation Deposit Hint */}
          {type === 'QUOTATION' && (
            <div className="grid grid-cols-[85%_15%] w-full mt-1 pt-1 border-t border-slate-100">
              <div className="text-right pr-4 font-bold text-slate-500 uppercase tracking-tight">Deposit Required (50%)</div>
              <div className="text-right font-bold text-slate-900 px-2 bg-slate-50/50 rounded-md">RM {formatCurrency(Number(totals.total - (totals.discount || 0)) * 0.5)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Payment & Legal Section - Pushed to bottom of A4 */}
      <div className="legal-footer">
        <div style={{ borderTop: '2px solid #ddd', paddingTop: '8px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ width: '45%', fontSize: '10.5px' }}>
              <strong>PAYMENT DETAILS</strong><br />
              Name: MUHAMMAD FAREEZ BIN MOHD FAUZI<br />
              Bank: Maybank<br />
              Account Number: 001141316728
            </div>
            <div style={{ width: '50%', fontSize: '9.5px', color: '#666', borderLeft: '1px solid #eee', paddingLeft: '12px' }}>
              <strong>DISCLAIMER</strong><br />
              All payments must be made to the name/account provided. We (Fareez Installation Services) will not be held responsible for errors in entering account details or recipient information.
            </div>
          </div>

          <div style={{ borderTop: '1px solid #eee', paddingTop: '6px', fontSize: '8.5px', color: '#444' }}>
            <strong>TERMS & CONDITIONS</strong>
            <ul style={{ paddingLeft: '18px', margin: '0', lineHeight: '1.2' }}>
              <li><strong>Inclusions:</strong> Prices listed are for labor and installation services only.</li>
              <li><strong>Exclusions:</strong> Cost of bulbs, fans, and external wiring materials are not included unless specified.</li>
              <li><strong>Transportation:</strong> A transportation fee applies based on location. RM20 base + RM1.50/km. Excludes parking, tolls, building entry, condo access, or permits. If incurred, they will be added as separate items.</li>
              <li><strong>Liability:</strong> Fareez Installation Services is not responsible for payments made to incorrect account details.</li>
              <li><strong>Working Hours:</strong> Standard hours: 9:00 AM – 6:00 PM (Fri–Sun). Jobs must be booked in advance. Same-day or urgent appointments subject to availability.</li>
              <li><strong>Warranty:</strong> 30-day workmanship warranty from completion. Does not cover manufacturer defects or internal component failures of appliances.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="footer">
        This document is computer generated and no signature is required.
      </div>
    </div>
  );
};

export default InvoicePreview;
