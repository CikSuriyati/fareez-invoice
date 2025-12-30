import React, { useState, useEffect } from 'react';
import InvoiceForm from './components/InvoiceForm';
import InvoicePreview from './components/InvoicePreview';
import { saveInvoiceToSheet, fetchNextId } from './services/sheetApi';
import { FileText } from 'lucide-react';

function App() {
  const [invoiceData, setInvoiceData] = useState({
    type: 'INVOICE',
    status: 'UNPAID',
    project: {
      // defaults
      id: 'LOADING...',
      date: new Date().toISOString().split('T')[0]
    },
    items: [],
    totals: { total: 0, deposit: 0, balance: 0 }
  });

  const [isSaving, setIsSaving] = useState(false);
  const [baseId, setBaseId] = useState(''); // Stores "JOB-2025-XX-XXX"

  // Load Next ID on Mount
  useEffect(() => {
    const loadId = async () => {
      const nextId = await fetchNextId();
      setBaseId(nextId);
      // Initialize ID with correct prefix immediately
      setInvoiceData(prev => ({
        ...prev,
        project: { ...prev.project, id: nextId.replace('JOB', 'INV') }
      }));
    };
    loadId();
  }, []);

  // Update ID when Type Changes
  useEffect(() => {
    if (!baseId) return;

    let prefix = "JOB";
    if (invoiceData.type === 'INVOICE') prefix = "INV";
    else if (invoiceData.type === 'QUOTATION') prefix = "QTN";
    else if (invoiceData.type === 'RECEIPT') prefix = "RCT";

    const newId = baseId.replace("JOB", prefix);

    setInvoiceData(prev => ({
      ...prev,
      project: { ...prev.project, id: newId }
    }));
  }, [invoiceData.type, baseId]);

  // Handle updates from form
  const handleFormChange = (newData) => {
    setInvoiceData(newData);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSave = async (data) => {
    setIsSaving(true);
    console.log("Saving to sheet...", data);

    try {
      const result = await saveInvoiceToSheet(data);
      if (result) {
        alert("Invoice saved successfully!");
        // Optional: Refresh ID or reset form? 
        // For now, just notify success.
      }
    } catch (e) {
      alert("Error saving: " + e.message);
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Navbar */}
      <nav className="bg-indigo-900 text-white p-4 shadow-md no-print">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <FileText size={24} />
          <h1 className="text-xl font-bold tracking-wide">Fareez Invoice Generator</h1>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 flex flex-col lg:flex-row gap-8">

        {/* Left: Input Form */}
        <div className="w-full lg:w-5/12 no-print">
          <InvoiceForm
            defaultValues={invoiceData}
            onChange={handleFormChange}
            onPrint={handlePrint}
            onSave={handleSave}
            isSaving={isSaving}
          />
        </div>

        {/* Right: Preview (Standard A4) */}
        <div className="w-full lg:w-7/12 flex justify-center">
          {/* Scaled wrapper for small screens if needed, otherwise natural size */}
          <div className="transform scale-90 origin-top lg:scale-100">
            <InvoicePreview data={invoiceData} />
          </div>
        </div>
      </main>

      {/* Print-specific overrides handling */}
      <style>{`
        @media print {
            .no-print { display: none !important; }
            body { background: white; }
            .min-h-screen { display: block; height: auto; }
        }
      `}</style>
    </div>
  );
}

export default App;
