import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import InvoiceForm from './components/InvoiceForm';
import InvoicePreview from './components/InvoicePreview';
import Dashboard from './components/Dashboard';
import Expenses from './components/Expenses';
import PrintableReport from './components/PrintableReport';
import Reports from './components/Reports';
import QuickUpdate from './components/QuickUpdate';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveInvoiceToSheet, fetchNextId, fetchProjectById, sendInvoiceEmail } from './services/sheetApi';
import { FileText, LayoutDashboard, ShoppingBag, BarChart, Zap } from 'lucide-react';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [view, setView] = useState('DASHBOARD'); // 'DASHBOARD', 'EDITOR', 'EXPENSES', 'REPORTS', 'QUICK_UPDATE', 'PRINTABLE_REPORT'

  const [isSending, setIsSending] = useState(false);


  const [invoiceData, setInvoiceData] = useState({
    type: 'INVOICE',
    status: 'UNPAID',
    project: {
      // defaults
      id: `INV-${new Date().getFullYear()}-XX-XXX`,
      date: new Date().toISOString().split('T')[0]
    },
    items: [],
    totals: { total: 0, deposit: 0, balance: 0 }
  });

  const [initialData, setInitialData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [baseId, setBaseId] = useState('');

  // Check for existing session
  useEffect(() => {
    const savedEmail = localStorage.getItem('user_email');
    if (savedEmail) {
      setUserEmail(savedEmail);
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = ({ email }) => {
    setUserEmail(email);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('user_email');
    localStorage.removeItem('google_credential');
    setUserEmail(null);
    setIsAuthenticated(false);
    setView('DASHBOARD');
  };

  // Load URL Params & Next ID on Mount
  useEffect(() => {
    // Check for View params (e.g. ?view=PRINTABLE_REPORT)
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (viewParam) {
      setView(viewParam);
    }

    const loadId = async () => {
      const nextId = await fetchNextId();
      setBaseId(nextId);
      setInvoiceData(prev => ({
        ...prev,
        project: { ...prev.project, id: nextId }
      }));
      setInitialData(prev => ({
        ...invoiceData,
        project: { ...invoiceData.project, id: nextId }
      }));
    };
    loadId();
  }, []);

  // Sync document title with Displayed Doc ID (for PDF filename)
  useEffect(() => {
    if (invoiceData?.project?.id) {
      const type = invoiceData.type || 'INVOICE';
      const prefix = type === 'INVOICE' ? 'INV' :
        type === 'QUOTATION' ? 'QTN' :
          type === 'RECEIPT' ? 'RCT' : 'JOB';

      const displayId = invoiceData.project.id.replace(/^[A-Z]+/, prefix);
      document.title = displayId;
    }
  }, [invoiceData.project.id, invoiceData.type]);

  const handleFormChange = React.useCallback((newData) => {
    setInvoiceData(newData);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleLoadProject = async (id) => {
    if (!id) return alert("Please enter a Project ID to search.");

    try {
      const data = await fetchProjectById(id);
      if (data.error) {
        alert("Project not found: " + data.error);
        return;
      }

      setInvoiceData(data);
      setInitialData(data);
      setView('EDITOR');
    } catch (e) {
      console.error(e);
      alert("Failed to load project.");
    }
  };

  const handleSave = async (data) => {
    setIsSaving(true);
    console.log("Saving to sheet...", data);

    try {
      const result = await saveInvoiceToSheet(data);
      if (result) {
        alert("Invoice saved successfully!");
        setView('DASHBOARD');
      }
    } catch (e) {
      alert("Error saving: " + e.message);
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const gotoNewProject = async () => {
    let newId = baseId;
    try {
      const freshId = await fetchNextId();
      if (freshId && freshId.startsWith("JOB-")) {
        newId = freshId;
        setBaseId(freshId);
      }
    } catch (e) {
      console.error("Failed to fetch fresh ID, using cached:", e);
    }

    const resetState = {
      type: 'INVOICE',
      status: 'UNPAID',
      project: {
        id: newId,
        date: new Date().toISOString().split('T')[0],
        customer: '',
        email: '',
        phone: '',
        address: ''
      },
      items: [{ room: 'Living Room', type: 'Fan', desc: 'Install Ceiling Fan', unitPrice: 80, qty: 1 }],
      totals: { total: 0, deposit: 0, balance: 0 },
      depositPaid: 0
    };
    setInvoiceData(resetState);
    setInitialData(resetState);
    setView('EDITOR');
  };

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');

  const handleSendEmail = () => {
    if (!invoiceData.project.id) return alert("Please generate/load a project first.");
    setRecipientEmail(invoiceData.project.email || "");
    setShowEmailModal(true);
  };

  const confirmSendEmail = async () => {
    if (!recipientEmail) return alert("Please enter an email address.");

    setIsSending(true);
    try {
      // 1. Capture Node
      const input = document.getElementById('printable-invoice');
      if (!input) throw new Error("Preview element not found. Please switch to Editor View.");

      // 2. Generate Canvas
      const canvas = await html2canvas(input, { scale: 1.5, useCORS: true, logging: false });

      // 3. Generate PDF
      // 3. Generate PDF (Multi-page support)
      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      const pageHeight = pdf.internal.pageSize.getHeight();

      let heightLeft = pdfHeight;
      let position = 0;

      // First Page
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      // Additional Pages
      while (heightLeft > 0) {
        position = heightLeft - pdfHeight; // Negative position shifts image up
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      const pdfBase64 = pdf.output('datauristring');

      // 4. Send to Backend
      const emailBody = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #312e81; padding: 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Fareez Installation Services</h1>
          </div>
          <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
            <p>Dear <strong>${invoiceData.project.customer || 'Valued Customer'}</strong>,</p>
            
            <p>Please find attached your <strong>${invoiceData.type}</strong> (${invoiceData.project.id}) for the recent services.</p>
            
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px;"><strong>Document ID:</strong> ${invoiceData.project.id}</p>
              
              ${/* If Receipt or Paid, emphasize PAID amount */ Number(invoiceData.totals.balance) === 0 ? `
                  <p style="margin: 5px 0 0; font-size: 14px;"><strong>Total Amount:</strong> RM ${Number(invoiceData.totals.total).toFixed(2)}</p>
                  <p style="margin: 5px 0 0; font-size: 16px; color: #166534; font-weight: bold; border-top: 1px solid #ccc; padding-top: 5px; margin-top: 5px;">
                      ${invoiceData.type === 'RECEIPT' ? 'TOTAL PAID' : 'FULLY PAID'}: RM ${Number(invoiceData.totals.deposit).toFixed(2)}
                  </p>
                  <p style="margin: 5px 0 0; font-size: 14px; color: #666;">Balance Due: RM 0.00</p>
              ` : `
                  ${/* Standard Invoice with Potential Discount/Deposit */ ''}
                  ${Number(invoiceData.totals.discount) > 0 ? `
                    <p style="margin: 5px 0 0; font-size: 14px;"><strong>Subtotal:</strong> RM ${(Number(invoiceData.totals.total) + Number(invoiceData.totals.discount)).toFixed(2)}</p>
                    <p style="margin: 5px 0 0; font-size: 14px; color: #d32f2f;"><strong>Discount:</strong> - RM ${Number(invoiceData.totals.discount).toFixed(2)}</p>
                  ` : ''}
                  
                  <p style="margin: 5px 0 0; font-size: 14px;"><strong>Total Amount:</strong> RM ${Number(invoiceData.totals.total).toFixed(2)}</p>
                  
                  ${Number(invoiceData.totals.deposit) > 0 ? `
                    <p style="margin: 5px 0 0; font-size: 14px;"><strong>Paid/Deposit:</strong> RM ${Number(invoiceData.totals.deposit).toFixed(2)}</p>
                  ` : ''}

                  <p style="margin: 5px 0 0; font-size: 16px; border-top: 1px solid #ccc; padding-top: 5px; margin-top: 5px;">
                    <strong>Balance Due:</strong> RM ${Number(invoiceData.totals.balance).toFixed(2)}
                  </p>
              `}
            </div>
            
            <p>If you have any questions or require further assistance, please do not hesitate to contact us.</p>
            
            <br/>
            <p>Best regards,</p>
            <p><strong>Muhammad Fareez</strong><br/>
            Fareez Installation Services<br/>
            Phone: +60 11-2549 5182</p>
          </div>
          <div style="text-align: center; padding: 15px; color: #666; font-size: 12px;">
            Thank you for your business!
          </div>
        </div>
      `;

      const payload = {
        to: recipientEmail,
        subject: `${invoiceData.type} ${invoiceData.project.id} - Fareez Installation`,
        body: emailBody,
        filename: `${invoiceData.project.id}.pdf`,
        base64: pdfBase64
      };

      await sendInvoiceEmail(payload);
      alert("Email sent successfully!");
      setShowEmailModal(false);

    } catch (e) {
      console.error(e);
      alert("Failed to send email: " + e.message);
    } finally {
      setIsSending(false);
    }
  };

  // If Printable Report, bypass the entire App Shell layout to prevent Print CSS issues
  if (view === 'PRINTABLE_REPORT') {
    return <PrintableReport />;
  }

  return (
    <div className="h-full min-h-screen bg-slate-50 flex flex-col font-jakarta pb-20 md:pb-0">
      {/* Top Header - Professional Business Branding */}
      {view !== 'PRINTABLE_REPORT' && (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo/Brand - Original Name Maintained */}
              <div className="flex items-center cursor-pointer group" onClick={() => setView('DASHBOARD')}>
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md group-hover:bg-indigo-700 transition-colors">
                  <Zap size={22} fill="currentColor" />
                </div>
                <div className="ml-3">
                  <h1 className="text-lg font-bold text-slate-900 leading-none">Fareez Invoice Generator</h1>
                  <p className="text-[10px] font-bold text-slate-400 tracking-widest mt-1 uppercase">Installation Services</p>
                </div>
              </div>

              {/* Desktop Menu (md and up) */}
              <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl space-x-1">
                <button
                  onClick={() => setView('DASHBOARD')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'DASHBOARD' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
                >
                  Dashboard
                </button>
                <button
                  onClick={gotoNewProject}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'EDITOR' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
                >
                  New Project
                </button>
                <button
                  onClick={() => setView('EXPENSES')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'EXPENSES' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
                >
                  Expenses
                </button>
                <button
                  onClick={() => setView('REPORTS')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'REPORTS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
                >
                  Reports
                </button>
                <button
                  onClick={() => setView('QUICK_UPDATE')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'QUICK_UPDATE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
                >
                  Quick Update
                </button>
              </div>

              {/* Right Side Actions */}
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right mr-2">
                  <span className="text-xs font-bold text-slate-700">{userEmail?.split('@')[0]}</span>
                  <span className="text-[10px] text-slate-400 font-medium italic">Administrator</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 p-2.5 rounded-xl transition-all border border-slate-200 hover:border-red-100"
                  title="Logout"
                >
                  <span className="hidden sm:inline-block mr-2 text-xs font-bold">Logout</span>
                  🚪
                </button>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Mobile Bottom Navigation - Large Tap Targets */}
      {view !== 'PRINTABLE_REPORT' && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 px-2 pb-safe-area shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-around h-20">
            <button
              onClick={() => setView('DASHBOARD')}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl transition-all ${view === 'DASHBOARD' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}
            >
              <LayoutDashboard size={24} />
              <span className="text-[10px] font-bold mt-1">Home</span>
            </button>
            <button
              onClick={gotoNewProject}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl transition-all ${view === 'EDITOR' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}
            >
              <FileText size={24} />
              <span className="text-[10px] font-bold mt-1">New</span>
            </button>
            <button
              onClick={() => setView('QUICK_UPDATE')}
              className={`flex flex-col items-center justify-center w-16 h-16 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-90`}
            >
              <Zap size={24} fill="currentColor" />
              <span className="text-[10px] font-bold mt-1 uppercase tracking-tighter">Update</span>
            </button>
            <button
              onClick={() => setView('EXPENSES')}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl transition-all ${view === 'EXPENSES' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}
            >
              <ShoppingBag size={24} />
              <span className="text-[10px] font-bold mt-1">Spend</span>
            </button>
            <button
              onClick={() => setView('REPORTS')}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl transition-all ${view === 'REPORTS' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}
            >
              <BarChart size={24} />
              <span className="text-[10px] font-bold mt-1">Reports</span>
            </button>
          </div>
        </nav>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 w-full overflow-y-auto ${view === 'PRINTABLE_REPORT' ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8'}`}>

        {view === 'DASHBOARD' && (
          <Dashboard
            onLoadProject={handleLoadProject}
            onNewProject={gotoNewProject}
          />
        )}

        {view === 'EXPENSES' && (
          <Expenses />
        )}

        {view === 'REPORTS' && (
          <Reports />
        )}

        {view === 'QUICK_UPDATE' && (
          <QuickUpdate />
        )}


        {view === 'EDITOR' && (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left: Input Form */}
            <div className="w-full lg:w-5/12 no-print">
              <InvoiceForm
                defaultValues={initialData}
                onChange={handleFormChange}
                onPrint={handlePrint}
                onSave={handleSave}
                onLoadProject={handleLoadProject}
                isSaving={isSaving}
                onEmail={handleSendEmail}
                isSending={isSending}
              />
            </div>

            {/* Right: Preview (Standard A4) */}
            <div className="w-full lg:w-7/12 flex justify-center">
              {/* Scaled wrapper for small screens if needed, otherwise natural size */}
              <div className="transform scale-90 origin-top lg:scale-100 invoice-scale-wrapper">
                <InvoicePreview data={invoiceData} />
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Print-specific overrides handling */}
      <style>{`
        @media print {
            /* Hide non-print elements */
            .no-print { display: none !important; }

            /* Reset Global Layout */
            body, html, #root { 
              background: white !important; 
              width: 100% !important;
              height: auto !important; 
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
            }

            /* Disable Flexbox on Main Root causing cutoff */
            .flex, .flex-col, .min-h-screen { 
              display: block !important;
              height: auto !important;
              min-height: 0 !important;
            }

            /* Ensure Main Content fills page */
            main {
                display: block !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
            }
        }
      `}</style>
      {/* Email Modal Overlay */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Send via Email</h3>

            <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Email</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full border p-2 rounded mb-6 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="customer@example.com"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium"
                disabled={isSending}
              >
                Cancel
              </button>
              <button
                onClick={confirmSendEmail}
                disabled={isSending}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
              >
                {isSending ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                    Sending...
                  </>
                ) : (
                  'Send Email'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login overlay if not authenticated */}
      {!isAuthenticated && <Login onLoginSuccess={handleLogin} />}
    </div>
  );
}

export default App;
