import React, { useState, useEffect } from 'react';
import InvoiceForm from './components/InvoiceForm';
import InvoicePreview from './components/InvoicePreview';
import Dashboard from './components/Dashboard';
import Expenses from './components/Expenses';
import PrintableReport from './components/PrintableReport';
import Reports from './components/Reports';
import { saveInvoiceToSheet, fetchNextId, fetchProjectById } from './services/sheetApi';
import { FileText, LayoutDashboard, ShoppingBag, BarChart } from 'lucide-react';

function App() {
  const [view, setView] = useState('DASHBOARD'); // 'DASHBOARD', 'EDITOR', 'EXPENSES', 'REPORTS', 'PRINTABLE_REPORT'

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

  // If Printable Report, bypass the entire App Shell layout to prevent Print CSS issues
  if (view === 'PRINTABLE_REPORT') {
    return <PrintableReport />;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Navbar (Hidden in Printable Report) */}
      {view !== 'PRINTABLE_REPORT' && (
        <nav className="bg-indigo-900 text-white p-4 shadow-md no-print">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('DASHBOARD')}>
              <FileText size={24} />
              <h1 className="text-lg md:text-xl font-bold tracking-wide text-center">Fareez Invoice Generator (v2.0)</h1>
            </div>

            <div className="flex gap-2 flex-wrap justify-center w-full md:w-auto">
              <button
                onClick={() => setView('DASHBOARD')}
                className={`flex items-center gap-2 px-3 py-1 rounded hover:bg-indigo-800 transition ${view === 'DASHBOARD' ? 'bg-indigo-800 ring-1 ring-indigo-400' : ''}`}
              >
                <LayoutDashboard size={18} /> <span className="hidden sm:inline">Home</span>
              </button>
              <button
                onClick={gotoNewProject}
                className={`flex items-center gap-2 px-3 py-1 rounded hover:bg-indigo-800 transition ${view === 'EDITOR' ? 'bg-indigo-800 ring-1 ring-indigo-400' : ''}`}
              >
                <FileText size={18} /> <span className="hidden sm:inline">Editor</span>
              </button>
              <button
                onClick={() => setView('EXPENSES')}
                className={`flex items-center gap-2 px-3 py-1 rounded hover:bg-indigo-800 transition ${view === 'EXPENSES' ? 'bg-indigo-800 ring-1 ring-indigo-400' : ''}`}
              >
                <ShoppingBag size={18} /> <span className="hidden sm:inline">Expenses</span>
              </button>
              <button
                onClick={() => setView('REPORTS')}
                className={`flex items-center gap-2 px-3 py-1 rounded hover:bg-indigo-800 transition ${view === 'REPORTS' ? 'bg-indigo-800 ring-1 ring-indigo-400' : ''}`}
              >
                <BarChart size={18} /> <span className="hidden sm:inline">Reports</span>
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className={`flex-1 w-full ${view === 'PRINTABLE_REPORT' ? '' : 'max-w-7xl mx-auto p-4 md:p-8'}`}>

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
    </div>
  );
}

export default App;
