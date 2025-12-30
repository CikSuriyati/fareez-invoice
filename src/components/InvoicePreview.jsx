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

  // Logic to fill empty rows if fewer than minRows
  const minRows = 13;
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
            Phone: +6019-8961029<br />
            Email: fareezfauzimy@gmail.com
          </div>
        </div>

        {/* Dynamic Stamp */}
        {(type === 'INVOICE' || type === 'RECEIPT') && (
          <div className={`stamp ${status.toLowerCase()}`}>
            {status === 'PAID' ? 'PAID' : status === 'PARTIAL' ? 'PARTIALLY PAID' : 'UNPAID'}
          </div>
        )}

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
            <strong>STATUS:</strong> Generated
          </div>
        </div>

        <table className="invoice-table">
          <thead>
            <tr>
              <th width="15%">Room / Area</th>
              <th width="20%">Installation Type</th>
              <th width="30%">Description</th>
              <th width="12%">Unit Price (RM)</th>
              <th width="8%">Qty</th>
              <th width="15%">Total (RM)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              // Simple logic to show Room/Type only if different from previous
              // In a real app, you might want to pre-process this list to handle grouping more robustly
              const prevItem = items[index - 1] || {};
              const showRoom = item.room !== prevItem.room;
              const showType = item.type !== prevItem.type || showRoom;

              const itemTotal = Number(item.unitPrice || 0) * Number(item.qty || 0);

              return (
                <tr key={index}>
                  <td>{showRoom ? <strong>{item.room}</strong> : ''}</td>
                  <td>{showType ? item.type : ''}</td>
                  <td>{item.desc}</td>
                  <td>{formatCurrency(item.unitPrice)}</td>
                  <td>{item.qty}</td>
                  <td><strong>{formatCurrency(itemTotal)}</strong></td>
                </tr>
              );
            })}

            {/* Fill empty rows */}
            {Array.from({ length: emptyRows }).map((_, i) => (
              <tr key={`empty-${i}`} style={{ height: '22px' }}>
                <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="total-section">
          <div>
            <span className="total-label">TOTAL AMOUNT:</span>
            <span className="total-amount">RM {formatCurrency(totals.total)}</span>
          </div>

          {type === 'INVOICE' && (
            <>
              <div style={{ marginTop: '5px' }}>
                <span className="total-label">DEPOSIT PAID:</span>
                <span><strong>RM {formatCurrency(totals.deposit)}</strong></span>
              </div>
              <div style={{ marginTop: '8px' }}>
                <span className="total-label">BALANCE DUE:</span>
                <span className="total-amount">RM {formatCurrency(totals.balance)}</span>
              </div>
            </>
          )}

          {type === 'QUOTATION' && (
            <div style={{ color: '#666', marginTop: '5px' }}>
              <span className="total-label">Deposit Required (50%):</span>
              <span><strong>RM {formatCurrency(totals.total * 0.5)}</strong></span>
            </div>
          )}
        </div>

        {/* Payment & Legal Section */}
        <div style={{ marginTop: '30px', borderTop: '2px solid #ddd', paddingTop: '15px' }}>
          <div style={{ marginBottom: '15px' }}>
            <div style={{ width: '48%', float: 'left', fontSize: '11px' }}>
              <strong>PAYMENT DETAILS</strong><br />
              Name: MUHAMMAD FAREEZ BIN MOHD FAUZI<br />
              Bank: Maybank<br />
              Account Number: 001141316728
            </div>
            <div style={{ width: '48%', float: 'right', fontSize: '10px', color: '#666', textAlign: 'justify', lineHeight: '1.2' }}>
              <strong>DISCLAIMER</strong><br />
              All payments must be made to the name and account number provided.
              Please ensure that the account details are entered correctly.
              We (Fareez Installation Services) will not be held responsible for any payments made to an incorrect account due to errors in entering the account number or recipient information.
            </div>
            <div style={{ clear: 'both' }}></div>
          </div>

          <div style={{ borderTop: '1px solid #ddd', paddingTop: '10px', fontSize: '9px', lineHeight: '1.4' }}>
            <strong>TERMS & CONDITIONS</strong>
            <ul style={{ paddingLeft: '15px', margin: '2px 0' }}>
              <li><strong>Inclusions:</strong> Prices listed are for labor and installation services only.</li>
              <li><strong>Exclusions:</strong> Cost of light bulbs, fans, and external wiring materials are not included unless specified.</li>
              <li><strong>Transportation:</strong> A transportation fee applies based on project location. Charges exclude parking fees, toll charges, building entry fees, condo access fees, or special permits. If incurred, they will be added as separate line items.</li>
              <li><strong>Liability:</strong> Fareez Installation Services is not responsible for payments made to incorrect account details.</li>
              <li><strong>Working Hours & After-Hours Charges:</strong>
                <ul style={{ paddingLeft: '15px', margin: '2px 0' }}>
                  <li><strong>Standard working hours:</strong> 9:00 AM – 6:00 PM (Friday–Sunday)</li>
                  <li><strong>Service Availability:</strong> All jobs must be booked in advance. Same-day or urgent appointments are subject to availability.</li>
                </ul>
              </li>
              <li><strong>Workmanship Warranty:</strong>
                <ul style={{ paddingLeft: '15px', margin: '2px 0' }}>
                  <li><strong>Period:</strong> 30-day warranty starting from the date of completion.</li>
                  <li><strong>Scope:</strong> Covers issues directly related to installation.</li>
                  <li><strong>Exclusions:</strong> This warranty does not cover manufacturer defects or internal component failures of the appliances.</li>
                </ul>
              </li>
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
