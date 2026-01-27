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
import { saveInvoiceToSheet, fetchNextId, fetchProjectById, sendInvoiceEmail, saveInvoicePDF, fetchProjectDocuments, fetchFileData } from './services/sheetApi';
import { FileText, LayoutDashboard, ShoppingBag, BarChart, Zap, Printer, Share2 } from 'lucide-react';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [view, setView] = useState('DASHBOARD'); // 'DASHBOARD', 'EDITOR', 'EXPENSES', 'REPORTS', 'QUICK_UPDATE', 'PRINTABLE_REPORT'

  const [isSending, setIsSending] = useState(false);
  const [isSavingPDF, setIsSavingPDF] = useState(false);

  // Helper: Deep compare to check for changes
  const isDetailsDirty = (obj1, obj2) => {
    if (!obj1 || !obj2) return true;
    return JSON.stringify(obj1) !== JSON.stringify(obj2); // Simple JSON comparison for this use case
  };

  // Helper to capture the preview and generate a PDF
  const captureAndGeneratePDF = async () => {
    const input = document.getElementById('printable-invoice');
    if (!input) throw new Error("Document preview element not found.");

    const canvas = await html2canvas(input, { scale: 1.5, useCORS: true, logging: false });
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
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }

    return pdf.output('datauristring');
  };


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

  const handlePrint = async () => {
    if (invoiceData.project.id) {
      setIsSavingPDF(true);
      try {
        // 1. Silent Save to Spreadsheet first
        await handleSave(invoiceData, true);

        // 2. Capture and Save PDF copy (Backend handles versioning _v2 etc)
        const base64 = await captureAndGeneratePDF();
        await saveInvoicePDF(invoiceData.project.id, invoiceData.type, base64);
      } catch (e) {
        console.warn("Failed to auto-archive copy during print:", e);
      } finally {
        setIsSavingPDF(false);
      }
    }
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

  const handleSave = async (data = null, isSilent = false) => {
    const dataToSave = data || invoiceData;
    setIsSaving(true);
    if (!isSilent) console.log("Saving to sheet...", dataToSave);

    try {
      const result = await saveInvoiceToSheet(dataToSave);



      if (result && result.result === 'success' && !isSilent) {
        let msg = "Invoice saved & archived successfully!";
        if (result.fileUrl) {
          msg += "\n\nDocument Generated: " + result.fileUrl;
        }
        alert(msg);

        // Use the returned ID if it was a new project
        if (result.id && (!invoiceData.project.id || invoiceData.project.id.includes('XXXX'))) {
          // Reload or update ID? For now just go to dashboard to be safe
          // OR: setInvoiceData({...invoiceData, project: {...invoiceData.project, id: result.id}})
        }

        setView('DASHBOARD');
      } else if (result && result.error) {
        throw new Error(result.error);
      }
      return result;
    } catch (e) {
      if (!isSilent) alert("Error saving: " + e.message);
      console.error(e);
      throw e;
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
  const [emailResult, setEmailResult] = useState(null); // { type: 'success'|'error', message: '' }

  const handleSendEmail = () => {
    if (!invoiceData.project.id) return alert("Please generate/load a project first.");
    setRecipientEmail(invoiceData.project.email || "");
    setShowEmailModal(true);
  };

  const confirmSendEmail = async () => {
    if (!recipientEmail) return alert("Please enter an email address.");

    setIsSending(true);
    try {
      let pdfBase64 = null;
      let filename = `${invoiceData.project.id}.pdf`;
      let isResending = false;

      // 1. Check if invoice is modified (Dirty Check)
      // We compare invoiceData with initialData. 
      // Note: We strip 'status' from comparison if we want to allow sending regardless of payment status update,
      // but usually if I update payment status I want a new receipt. 
      // For now, Strict Equality.
      const isDirty = isDetailsDirty(invoiceData, initialData);

      if (!isDirty && invoiceData.project.id) {
        console.log("No changes detected. Attempting to fetch existing document...");
        try {
          const docsResult = await fetchProjectDocuments(invoiceData.project.id);
          if (docsResult.result === "success" && docsResult.documents && docsResult.documents.length > 0) {
            // Find the most recent document of the correct type (Invoice/Receipt)
            // The backend sorts by date desc, so the first match of type is the latest.
            // Our 'type' in state is 'INVOICE'/'RECEIPT' etc.
            // Backend 'type' comes from Folder Name usually (e.g. 'Invoices', 'Receipts').
            // Let's just look for a file that matches the ID suffix.
            // Actually, backend returns everything matching the ID.
            // Let's pick the first one (latest).
            const latestDoc = docsResult.documents[0];
            console.log("Found existing document:", latestDoc);

            // Fetch the actual Base64 data
            const fileResult = await fetchFileData(latestDoc.id);
            if (fileResult.result === "success" && fileResult.base64) {
              pdfBase64 = fileResult.base64;
              filename = fileResult.fileName || filename;
              isResending = true;
              console.log("Successfully fetched existing PDF data.");
            }
          }
        } catch (fetchErr) {
          console.warn("Failed to fetch existing doc, falling back to generation:", fetchErr);
        }
      }

      // 2. If no existing doc found OR data is dirty, Generate New
      if (!pdfBase64) {
        console.log("Generating NEW PDF version...");
        // Silent Save to Spreadsheet first
        await handleSave(invoiceData, true);

        // Generate PDF using helper
        pdfBase64 = await captureAndGeneratePDF();

        // Save a copy to Drive (Backend handles versioning _v2 etc)
        await saveInvoicePDF(invoiceData.project.id, invoiceData.type, pdfBase64);

        // Update initialData so subsequent sends effectively see "clean" state
        setInitialData(JSON.parse(JSON.stringify(invoiceData)));
      }

      // 3. Prepare Email Body
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
                  <p style="margin: 5px 0 0; font-size: 14px;"><strong>Subtotal:</strong> RM ${Number(invoiceData.totals.total).toFixed(2)}</p>
                  ${Number(invoiceData.totals.discount) > 0 ? `<p style="margin: 5px 0 0; font-size: 14px; color: #d32f2f;"><strong>Discount:</strong> - RM ${Number(invoiceData.totals.discount).toFixed(2)}</p>` : ''}
                  <p style="margin: 5px 0 0; font-size: 14px;"><strong>Total Amount:</strong> RM ${(Number(invoiceData.totals.total) - Number(invoiceData.totals.discount)).toFixed(2)}</p>
                  <p style="margin: 5px 0 0; font-size: 16px; color: #166534; font-weight: bold; border-top: 1px solid #ccc; padding-top: 5px; margin-top: 5px;">
                      ${invoiceData.type === 'RECEIPT' ? 'TOTAL PAID' : 'FULLY PAID'}: RM ${Number(invoiceData.totals.deposit).toFixed(2)}
                  </p>
                  <p style="margin: 5px 0 0; font-size: 14px; color: #666;">Balance Due: RM 0.00</p>
              ` : `
                  ${/* Standard Invoice with Potential Discount/Deposit */ ''}
                  <p style="margin: 5px 0 0; font-size: 14px;"><strong>Subtotal:</strong> RM ${Number(invoiceData.totals.total).toFixed(2)}</p>
                  
                  ${Number(invoiceData.totals.discount) > 0 ? `
                    <p style="margin: 5px 0 0; font-size: 14px; color: #d32f2f;"><strong>Discount:</strong> - RM ${Number(invoiceData.totals.discount).toFixed(2)}</p>
                  ` : ''}
                  
                  <p style="margin: 5px 0 0; font-size: 14px;"><strong>Total Amount:</strong> RM ${(Number(invoiceData.totals.total) - Number(invoiceData.totals.discount)).toFixed(2)}</p>
                  
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
        filename: filename,
        base64: pdfBase64
      };

      await sendInvoiceEmail(payload);

      if (isResending) {
        setEmailResult({
          type: 'success',
          message: "✅ EXISTING document sent successfully!\n(No new version created to save space)."
        });
      } else {
        setEmailResult({
          type: 'success',
          message: "✅ NEW document generated and sent successfully!"
        });
      }

      // Don't close modal, let user read
      // setShowEmailModal(false);

    } catch (e) {
      console.error(e);
      setEmailResult({
        type: 'error',
        message: "Failed to send email: " + e.message
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleWhatsApp = async () => {
    // 1. Silent Save
    try {
      await handleSave(invoiceData, true);
    } catch (e) {
      alert("Failed to save project before sharing.");
      return;
    }

    const phone = invoiceData.project.phone || '';
    const cleanPhone = String(phone).replace(/\D/g, '');
    let formatPhone = cleanPhone;
    if (cleanPhone.startsWith('0')) formatPhone = '60' + cleanPhone.substring(1);
    formatPhone = formatPhone.replace('+', '');

    const message = `Hi ${invoiceData.project.customer}, here is your ${invoiceData.type} for ${invoiceData.project.id}`;

    // 2. Generate PDF Base64 (Frontend Capture)
    try {
      setIsSavingPDF(true); // Start loading state
      const base64 = await captureAndGeneratePDF();

      // 3. ALWAYS Save to Drive First (Record Keeping)
      const result = await saveInvoicePDF(invoiceData.project.id, invoiceData.type, base64);

      if (result.error) {
        throw new Error(result.error);
      }

      const fileUrl = result.url || '';

      // 4. Attempt Native Share (Mobile) - Send the FILE
      if (navigator.share) {
        try {
          const cleanBase64 = base64.replace('data:application/pdf;filename=generated.pdf;base64,', '').replace('data:application/pdf;base64,', '');
          const byteCharacters = atob(cleanBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const file = new File([byteArray], `${invoiceData.project.id}.pdf`, { type: 'application/pdf' });

          const shareData = {
            files: [file],
            title: `${invoiceData.type} ${invoiceData.project.id}`,
            text: message
          };

          if (navigator.canShare && navigator.canShare(shareData)) {
            await navigator.share(shareData);
            setIsSavingPDF(false);
            return; // Success, stop here
          }
        } catch (err) {
          console.warn('Native share failed, falling back to Link...', err);
        }
      }

      // 5. Fallback: Open WhatsApp with Link (Desktop or failed share)
      const whatsappUrl = `https://wa.me/${formatPhone}?text=${encodeURIComponent(message + ': ' + fileUrl)}`;
      window.open(whatsappUrl, '_blank');
      setIsSavingPDF(false);

    } catch (e) {
      console.error(e);
      setIsSavingPDF(false);
      alert("Error sharing via WhatsApp: " + e.message);
    }
  };

  // If Printable Report, bypass the entire App Shell layout to prevent Print CSS issues
  if (view === 'PRINTABLE_REPORT') {
    return <PrintableReport />;
  }

  return (
    <div className="h-full min-h-screen bg-slate-50 flex flex-col font-jakarta pb-20 md:pb-0">
      {/* Top Navigation - Integrated Template Style */}
      {view !== 'PRINTABLE_REPORT' && (
        <nav className="bg-indigo-900 shadow-lg sticky top-0 z-50 no-print">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div
                className="flex items-center cursor-pointer group"
                onClick={() => setView('DASHBOARD')}
              >
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-indigo-900 mr-3 shadow-md group-hover:bg-indigo-50 transition-colors border border-indigo-200">
                  <span style={{ fontFamily: "'Times New Roman', serif" }} className="text-xl font-black tracking-tighter">FF</span>
                </div>
                <span className="text-white font-bold text-lg tracking-tight">
                  Fareez Invoice <span className="text-indigo-300 text-xs font-normal ml-1">v3.0</span>
                </span>
              </div>

              {/* Desktop Menu */}
              <div className="hidden lg:flex items-center bg-indigo-950/50 p-1 rounded-xl mx-4">
                {[
                  { id: 'DASHBOARD', label: 'Dashboard' },
                  { id: 'EDITOR', label: 'New Project', action: gotoNewProject },
                  { id: 'EXPENSES', label: 'Expenses' },
                  { id: 'REPORTS', label: 'Reports' },
                  { id: 'QUICK_UPDATE', label: 'Update' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={item.action || (() => setView(item.id))}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === item.id
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-indigo-300 hover:text-white hover:bg-white/10'
                      }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Action Sidebar / Right Side */}
              <div className="flex items-center gap-2">
                {view === 'EDITOR' && (
                  <div className="hidden sm:flex items-center gap-2 mr-2 border-r border-indigo-800 pr-4">
                    <button
                      onClick={handlePrint}
                      disabled={isSavingPDF}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50"
                    >
                      {isSavingPDF ? '...' : <><Printer size={14} /> Print</>}
                    </button>
                    <button
                      onClick={handleSendEmail}
                      disabled={isSending || isSavingPDF}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50"
                    >
                      {(isSending || isSavingPDF) ? '...' : <><Zap size={14} fill="currentColor" /> Email</>}
                    </button>
                    <button
                      onClick={() => handleSave()}
                      disabled={isSaving}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 shadow-md shadow-indigo-950/20 disabled:opacity-50"
                    >
                      {isSaving ? '...' : <><FileText size={14} /> Save</>}
                    </button>
                    <button
                      onClick={handleWhatsApp}
                      disabled={isSaving || isSavingPDF}
                      className="bg-[#25D366] hover:bg-[#128C7E] text-white px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50"
                    >
                      {isSavingPDF ? '...' : <><Share2 size={14} /> WhatsApp</>}
                    </button>
                  </div>
                )}

                <button
                  onClick={handleLogout}
                  className="bg-indigo-800 hover:bg-red-600 text-indigo-300 hover:text-white p-2 rounded-lg transition-all"
                  title="Logout"
                >
                  🚪
                </button>
              </div>
            </div>
          </div>
        </nav>
      )
      }

      {/* Mobile Bottom Navigation - Large Tap Targets */}
      {
        view !== 'PRINTABLE_REPORT' && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 px-2 pb-safe-area shadow-[0_-4px_10px_rgba(0,0,0,0.05)] no-print">
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
        )
      }

      {/* Main Content Area */}
      <main className={`flex-1 w-full overflow-y-auto ${view === 'PRINTABLE_REPORT' ? '' : 'max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8'}`}>

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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Input Form */}
            <div className="w-full lg:col-span-5 no-print">
              <InvoiceForm
                defaultValues={initialData}
                onChange={handleFormChange}
                onPrint={handlePrint}
                onSave={handleSave}
                onLoadProject={handleLoadProject}
                isSaving={isSaving}
                onEmail={handleSendEmail}
                onWhatsApp={handleWhatsApp}
                isSending={isSending}
                isSavingPDF={isSavingPDF}
              />
            </div>

            {/* Right: Preview (Standard A4) */}
            <div className="w-full lg:col-span-7 flex justify-center">
              <div className="sticky top-24 h-fit w-full flex justify-center">
                <div className="print-content w-full overflow-x-auto sm:overflow-visible sm:transform sm:scale-95 lg:scale-100 sm:origin-top bg-white rounded-2xl shadow-xl border border-slate-100">
                  <InvoicePreview data={invoiceData} />
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Print-specific overrides handling */}
      <style>{`
        @media print {
            .no-print { display: none !important; }
            
            body, html, #root, .h-full, .min-h-screen { 
              background: white !important; 
              color: black !important;
              margin: 0 !important;
              padding: 0 !important;
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
            }

            /* Reset the preview wrapper container for pure A4 output */
            .print-content {
              transform: none !important;
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
              overflow: visible !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 210mm !important;
              background: white !important;
            }

            /* Ensure the layout engine doesn't clip parents */
            .w-full, .lg:col-span-12, .grid, .lg:col-span-7, .flex { 
              display: block !important; 
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
            }

            main { 
              padding: 0 !important;
              margin: 0 !important;
              max-width: none !important;
              width: 100% !important;
              display: block !important;
            }
            
            .sticky {
              position: static !important;
            }
        }
      `}</style>
      {/* Email Modal Overlay */}
      {
        showEmailModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
            <div className="bg-white p-6 rounded-lg shadow-xl w-96 animate-fadeIn">
              <h3 className="text-lg font-bold mb-4 text-gray-800">Send via Email</h3>

              {!emailResult ? (
                <>
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
                </>
              ) : (
                <div className="text-center py-4">
                  <div className={`mx-auto flex items-center justify-center w-12 h-12 rounded-full mb-4 ${emailResult.type === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
                    {emailResult.type === 'success' ? (
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    ) : (
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    )}
                  </div>
                  <p className="text-gray-800 font-medium mb-6 whitespace-pre-wrap">{emailResult.message}</p>
                  <button
                    onClick={() => {
                      setShowEmailModal(false);
                      setEmailResult(null); // Reset for next time
                    }}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      }

      {/* Login overlay if not authenticated */}
      {!isAuthenticated && <Login onLoginSuccess={handleLogin} />}
    </div >
  );
}

export default App;
