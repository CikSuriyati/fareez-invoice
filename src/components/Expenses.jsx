import React, { useState, useEffect, useRef } from 'react';
import { fetchExpenses, saveExpense, fetchInventoryStats, fetchProjectAnalytics } from '../services/sheetApi';
import { Plus, Filter, ShoppingBag, PieChart, TrendingUp, Search, AlertCircle, ArrowUpRight, ArrowDownRight, Camera, X, Loader, Upload } from 'lucide-react';

const Expenses = () => {
    const [view, setView] = useState('LIST'); // 'LIST' or 'ANALYTICS'
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Filter State
    const [filter, setFilter] = useState('MONTH'); // MONTH, LAST_MONTH, YEAR, ALL

    // Analytics State
    const [inventoryValue, setInventoryValue] = useState(0);
    const [projectAnalytics, setProjectAnalytics] = useState([]);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);

    // Receipt Scanning State
    const [showReceiptScanner, setShowReceiptScanner] = useState(false);
    const [receiptImage, setReceiptImage] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState('');
    const fileInputRef = useRef(null);

    // Receipt File Upload (separate from OCR scanner)
    const [receiptFile, setReceiptFile] = useState(null);
    const [receiptFilePreview, setReceiptFilePreview] = useState(null);
    const receiptUploadRef = useRef(null);

    // Form Stats
    const [formData, setFormData] = useState({
        projectId: '',
        refNo: '',
        store: '',
        desc: '',
        qty: 1,
        unitPrice: 0,
        category: 'Material' // Default
    });

    useEffect(() => {
        loadData();
    }, [filter]);

    const loadData = async () => {
        setLoading(true);
        // 1. Fetch Expenses List
        const data = await fetchExpenses(filter);
        if (data && data.expenses) {
            setExpenses(data.expenses);
        }

        // 2. Fetch Inventory Stats (only once or always? fast enough)
        const inv = await fetchInventoryStats();
        if (inv) setInventoryValue(inv.totalInventory || 0);

        // 3. If Analytics View is active, fetch Analytics Data
        if (view === 'ANALYTICS') {
            loadAnalytics();
        }

        setLoading(false);
    };

    // Reload analytics when view switches to ANALYTICS
    useEffect(() => {
        if (view === 'ANALYTICS') {
            loadAnalytics();
        }
    }, [view, filter]);

    const loadAnalytics = async () => {
        setAnalyticsLoading(true);
        const result = await fetchProjectAnalytics(filter);
        if (result && result.projects) {
            setProjectAnalytics(result.projects);
        }
        setAnalyticsLoading(false);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const amount = (parseFloat(formData.qty) || 0) * (parseFloat(formData.unitPrice) || 0);
            const payload = {
                ...formData,
                amount: amount,
                category: formData.category || 'Material'
            };

            // Convert receipt file to base64 if present
            let receiptData = null;
            if (receiptFile) {
                const reader = new FileReader();
                receiptData = await new Promise((resolve, reject) => {
                    reader.onloadend = () => {
                        const base64 = reader.result.split(',')[1];
                        resolve({
                            data: base64,
                            fileName: receiptFile.name,
                            mimeType: receiptFile.type
                        });
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(receiptFile);
                });
            }

            const success = await saveExpense(payload, receiptData);
            if (success) {
                alert("Expense Saved!");
                setShowForm(false);
                setFormData({
                    projectId: '', refNo: '', store: '', desc: '', qty: 1, unitPrice: 0, category: 'Material'
                });
                // Clear receipt file
                setReceiptFile(null);
                setReceiptFilePreview(null);
                setTimeout(loadData, 2000); // Reload everything
            } else {
                alert("Failed to save expense.");
            }
        } catch (error) {
            console.error('Save error:', error);
            alert("Failed to save expense: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    // Receipt Scanning Functions
    const handleImageCapture = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setScanError('Please select an image file');
            return;
        }

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setReceiptImage(reader.result);
            setShowReceiptScanner(true);
            setScanError('');
        };
        reader.readAsDataURL(file);
    };

    const handleScanReceipt = async () => {
        if (!receiptImage) return;

        setIsScanning(true);
        setScanError('');

        try {
            // Call backend OCR endpoint
            const response = await fetch(
                import.meta.env.VITE_API_URL ||
                'https://script.google.com/macros/s/REDACTED_SECRET_7/exec',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({
                        action: 'SCAN_RECEIPT',
                        image: receiptImage
                    })
                }
            );

            const result = await response.json();

            if (result.error || !result.success) {
                setScanError(result.error || 'Failed to scan receipt');
                return;
            }

            if (result.success && result.extracted) {
                // Pre-fill form with extracted data
                setFormData(prev => ({
                    ...prev,
                    store: result.extracted.store || prev.store,
                    refNo: result.extracted.refNo || prev.refNo,
                    unitPrice: result.extracted.amount || prev.unitPrice,
                    desc: result.extracted.store ? `Receipt from ${result.extracted.store}` : prev.desc
                }));

                // Keep scanner open, open form for editing
                // setShowReceiptScanner(false); // Removed as per instruction
                setShowForm(true);
                // setReceiptImage(null); // Removed as per instruction

                // Show success message
                alert(`✓ Receipt scanned!\nStore: ${result.extracted.store || 'N/A'}\nAmount: RM ${result.extracted.amount || 'N/A'}`);
            }

        } catch (error) {
            console.error('Scan error:', error);
            setScanError('Failed to scan receipt. Please try again or enter manually.');
        } finally {
            setIsScanning(false);
        }
    };

    const closeScannerModal = () => {
        setShowReceiptScanner(false);
        setReceiptImage(null);
        setScanError('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Receipt File Upload Handler (separate from OCR scanner)
    const handleReceiptFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            alert('Invalid file type. Only JPG, PNG, and PDF are allowed.');
            return;
        }

        // Validate file size (10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert('File too large. Maximum size is 10MB.');
            return;
        }

        setReceiptFile(file);

        // Create preview for images
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setReceiptFilePreview(reader.result);
            };
            reader.readAsDataURL(file);
        } else {
            setReceiptFilePreview(null); // PDF, no preview
        }
    };

    const handleRemoveReceiptFile = () => {
        setReceiptFile(null);
        setReceiptFilePreview(null);
        if (receiptUploadRef.current) {
            receiptUploadRef.current.value = '';
        }
    };

    // --- Helper: Calculate Category Breakdown from Expenses List ---
    const getCategoryStats = () => {
        const stats = {};
        let total = 0;
        expenses.forEach(exp => {
            const cat = exp.category || "General";
            if (!stats[cat]) stats[cat] = 0;
            const amt = Number(exp.amount) || 0;
            stats[cat] += amt;
            total += amt;
        });

        // Convert to Array & Sort
        return Object.keys(stats).map(key => ({
            name: key,
            value: stats[key],
            percent: total > 0 ? (stats[key] / total) * 100 : 0
        })).sort((a, b) => b.value - a.value);
    };

    if (loading && view === 'LIST') return <div className="p-8 text-center text-gray-500">Loading Data...</div>;

    const categoryStats = getCategoryStats();
    const totalExpenses = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <ShoppingBag className="text-indigo-600" /> Expenses & Analytics
                </h2>

                <div className="flex gap-2 flex-wrap">
                    <div className="flex bg-white p-1 rounded border shadow-sm">
                        <button
                            onClick={() => setView('LIST')}
                            className={`px-4 py-2 rounded text-sm font-medium transition flex items-center gap-2 ${view === 'LIST' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <Filter size={16} /> List
                        </button>
                        <button
                            onClick={() => setView('ANALYTICS')}
                            className={`px-4 py-2 rounded text-sm font-medium transition flex items-center gap-2 ${view === 'ANALYTICS' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <PieChart size={16} /> Analytics
                        </button>
                    </div>

                    <div className="flex bg-white p-1 rounded border shadow-sm ml-2 hidden md:flex">
                        {['MONTH', 'LAST_MONTH', 'YEAR', 'ALL'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1 text-xs font-medium rounded transition ${filter === f ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                {f.replace('_', ' ')}
                            </button>
                        ))}
                    </div>

                    {view === 'LIST' && (
                        <>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 flex items-center gap-2 ml-2"
                            >
                                <Camera size={18} /> <span className="hidden sm:inline">Scan Receipt</span>
                            </button>
                            <button
                                onClick={() => setShowForm(!showForm)}
                                className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 flex items-center gap-2"
                            >
                                <Plus size={18} /> <span className="hidden sm:inline">Add</span>
                            </button>
                            {/* Hidden file input for camera/upload */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageCapture}
                                className="hidden"
                            />
                        </>
                    )}
                </div>
            </div>

            {/* ANALYTICS VIEW */}
            {view === 'ANALYTICS' && (
                <div className="space-y-8 animate-fadeIn">

                    {/* 1. TOP CARDS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Breakdown Card */}
                        <div className="bg-white p-6 rounded-lg shadow col-span-2">
                            <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                                <PieChart className="text-blue-500" size={20} /> Spending Breakdown ({filter.replace('_', ' ')})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                {/* Total Text */}
                                <div className="text-center md:text-left">
                                    <p className="text-sm text-gray-500 uppercase">Total Expenses</p>
                                    <p className="text-4xl font-extrabold text-gray-900 mt-1">RM {totalExpenses.toFixed(2)}</p>
                                </div>
                                {/* Progress Bars */}
                                <div className="space-y-3">
                                    {categoryStats.map((cat, idx) => (
                                        <div key={idx}>
                                            <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                                                <span>{cat.name}</span>
                                                <span>RM {cat.value.toFixed(2)} ({cat.percent.toFixed(0)}%)</span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                                <div
                                                    className={`h-2.5 rounded-full ${['bg-blue-500', 'bg-red-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500'][idx % 5]}`}
                                                    style={{ width: `${cat.percent}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ))}
                                    {categoryStats.length === 0 && <p className="text-sm text-gray-400 italic">No expense data found.</p>}
                                </div>
                            </div>
                        </div>

                        {/* Inventory Card */}
                        <div className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white p-6 rounded-lg shadow flex flex-col justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-purple-100 mb-2">Inventory Value</h3>
                                <p className="text-3xl font-bold">RM {Number(inventoryValue).toFixed(2)}</p>
                                <p className="text-xs text-purple-200 mt-2 opacity-80">Unassigned stock currently in hand.</p>
                            </div>
                            <ShoppingBag className="self-end text-purple-300 opacity-20" size={64} />
                        </div>
                    </div>

                    {/* 2. PROFITABILITY TABLE */}
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                <TrendingUp className="text-green-600" size={20} /> Project Profitability
                            </h3>
                            <span className="text-xs text-gray-500 bg-white px-2 py-1 border rounded">
                                Sorted by Lowest Profit
                            </span>
                        </div>

                        {analyticsLoading ? (
                            <div className="p-12 text-center text-gray-500">Calculating Profits...</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-white border-b-2 border-gray-100">
                                        <tr>
                                            <th className="px-6 py-3 text-left font-semibold text-gray-600">Project</th>
                                            <th className="px-6 py-3 text-right font-semibold text-gray-600">Revenue</th>
                                            <th className="px-6 py-3 text-right font-semibold text-gray-600">Expenses</th>
                                            <th className="px-6 py-3 text-right font-semibold text-gray-600">Net Profit</th>
                                            <th className="px-6 py-3 text-right font-semibold text-gray-600">Margin</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {projectAnalytics.map((p, idx) => {
                                            const isLoss = p.profit < 0;
                                            const margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
                                            return (
                                                <tr key={idx} className={`hover:bg-gray-50 transition ${isLoss ? 'bg-red-50/50' : ''}`}>
                                                    <td className="px-6 py-4">
                                                        <div className="font-medium text-gray-900">{p.id}</div>
                                                        <div className="text-xs text-gray-500">{p.customer}</div>
                                                        <div className="mt-1">
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${p.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                {p.status}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-gray-600">RM {p.revenue.toFixed(2)}</td>
                                                    <td className="px-6 py-4 text-right text-gray-600">RM {p.cost.toFixed(2)}</td>
                                                    <td className={`px-6 py-4 text-right font-bold ${isLoss ? 'text-red-600' : 'text-green-600'}`}>
                                                        {isLoss ? <ArrowDownRight size={14} className="inline mr-1" /> : <ArrowUpRight size={14} className="inline mr-1" />}
                                                        RM {p.profit.toFixed(2)}
                                                    </td>
                                                    <td className={`px-6 py-4 text-right font-mono text-xs ${margin < 10 ? 'text-red-500' : 'text-gray-500'}`}>
                                                        {margin.toFixed(1)}%
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {projectAnalytics.length === 0 && (
                                            <tr>
                                                <td colSpan="5" className="p-8 text-center text-gray-500 italic">No financial activity found for this period.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* LIST VIEW (Existing) - Only simplified filter controls to keep consistent */}
            {view === 'LIST' && (
                <>
                    {/* FORM */}
                    {showForm && (
                        <div className="bg-white p-6 rounded-lg shadow-lg mb-8 border border-indigo-100 animate-slideDown">
                            <h3 className="text-lg font-semibold mb-4 text-gray-700">New Expense Entry</h3>
                            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* Inputs */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                                    <input type="text" value={new Date().toLocaleDateString()} disabled className="w-full border p-2 rounded bg-gray-50 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                                    <select name="category" value={formData.category} onChange={handleInputChange} className="w-full border p-2 rounded text-sm">
                                        {['Material', 'Salary', 'Transport', 'Utility', 'Marketing', 'Asset', 'Inventory', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                                    <input type="text" name="desc" required value={formData.desc} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" placeholder="Item Name" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Store / Supplier</label>
                                    <input type="text" name="store" required value={formData.store} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" placeholder="Store Name" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>
                                    <input type="number" name="qty" min="1" value={formData.qty} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Unit Price (RM)</label>
                                    <input type="number" name="unitPrice" min="0" step="0.01" value={formData.unitPrice} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Ref No</label>
                                    <input type="text" name="refNo" required value={formData.refNo} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Project ID or Type "INVENTORY"</label>
                                    <input type="text" name="projectId" value={formData.projectId} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" placeholder="JOB-XXXX or INVENTORY" />
                                    <p className="text-xs text-gray-500 mt-1">💡 Leave blank if personal expense</p>
                                </div>

                                {/* Receipt Upload Section */}
                                <div className="lg:col-span-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                    <label className="block text-sm font-medium text-amber-900 mb-2 flex items-center gap-2">
                                        <Upload size={18} />
                                        Attach Receipt (Optional)
                                    </label>

                                    <input
                                        ref={receiptUploadRef}
                                        type="file"
                                        accept="image/jpeg,image/jpg,image/png,application/pdf"
                                        onChange={handleReceiptFileSelect}
                                        className="hidden"
                                    />

                                    {!receiptFile ? (
                                        <button
                                            type="button"
                                            onClick={() => receiptUploadRef.current?.click()}
                                            className="w-full border-2 border-dashed border-amber-300 rounded-lg p-4 hover:border-amber-400 hover:bg-amber-100 transition-colors flex items-center justify-center gap-2 text-amber-700"
                                        >
                                            <Upload size={20} />
                                            <span className="text-sm font-medium">Click to upload receipt (JPG, PNG, PDF - max 10MB)</span>
                                        </button>
                                    ) : (
                                        <div className="border border-amber-200 rounded-lg p-3 bg-white">
                                            <div className="flex items-start gap-3">
                                                {receiptFilePreview ? (
                                                    <img
                                                        src={receiptFilePreview}
                                                        alt="Receipt preview"
                                                        className="w-16 h-16 object-cover rounded"
                                                    />
                                                ) : (
                                                    <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                                                        <FileText size={24} className="text-gray-500" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">
                                                        {receiptFile.name}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {(receiptFile.size / 1024).toFixed(1)} KB
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleRemoveReceiptFile}
                                                    className="p-1 hover:bg-red-100 rounded-full transition-colors"
                                                >
                                                    <X size={18} className="text-red-600" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="lg:col-span-3 flex justify-end gap-3 mt-2">
                                    <button type="button" onClick={() => { setShowForm(false); setReceiptImage(null); }} className="px-4 py-2 text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded text-sm font-medium">
                                        Discard (Personal)
                                    </button>
                                    <button type="submit" disabled={isSaving} className="bg-green-600 text-white px-6 py-2 rounded shadow hover:bg-green-700 text-sm font-bold">
                                        {isSaving ? 'Saving...' : 'Save Record'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* TABLE */}
                    <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store & Item</th>
                                        <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {expenses.map((exp, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 text-xs text-gray-700">
                                            <td className="px-4 py-3 whitespace-nowrap text-gray-500">{exp.date}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase
                                                ${exp.category === 'Material' ? 'bg-blue-100 text-blue-700' :
                                                        exp.category === 'Salary' ? 'bg-green-100 text-green-700' :
                                                            exp.category === 'Transport' ? 'bg-yellow-100 text-yellow-700' :
                                                                'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {exp.category || 'General'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-900">{exp.store}</div>
                                                <div className="text-gray-500 truncate max-w-[150px]">{exp.desc}</div>
                                            </td>
                                            <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap font-mono text-gray-500">{exp.projectId || '-'}</td>
                                            <td className="px-4 py-3 text-right font-bold text-gray-900">RM {Number(exp.amount).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {expenses.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-gray-500">No expenses found for this period.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* RECEIPT SCANNER MODAL */}
            {showReceiptScanner && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Camera className="text-green-600" size={24} />
                                Receipt Scanner
                            </h3>
                            <button
                                onClick={closeScannerModal}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Image Preview */}
                        <div className="p-6">
                            {receiptImage && (
                                <div className="mb-4">
                                    <img
                                        src={receiptImage}
                                        alt="Receipt"
                                        className="w-full rounded-lg border-2 border-gray-200"
                                    />
                                </div>
                            )}

                            {/* Error Message */}
                            {scanError && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                                    <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
                                    <p className="text-sm text-red-700">{scanError}</p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg hover:border-gray-400 transition flex items-center justify-center gap-2 text-gray-700 font-medium"
                                >
                                    <Upload size={20} />
                                    Change Image
                                </button>
                                <button
                                    onClick={handleScanReceipt}
                                    disabled={isScanning || !receiptImage}
                                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 font-bold"
                                >
                                    {isScanning ? (
                                        <>
                                            <Loader className="animate-spin" size={20} />
                                            Scanning...
                                        </>
                                    ) : (
                                        <>
                                            <Camera size={20} />
                                            Scan Receipt
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Info Text */}
                            <p className="text-xs text-gray-500 mt-4 text-center">
                                💡 For best results, ensure receipt is well-lit and text is clear
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Expenses;
