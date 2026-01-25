import React, { useState, useEffect, useRef } from 'react';
import { fetchExpenses, saveExpense, fetchInventoryStats, fetchProjectAnalytics, fetchMonthlyTrends } from '../services/sheetApi';
import { Plus, Filter, ShoppingBag, PieChart, TrendingUp, Search, AlertCircle, ArrowUpRight, ArrowDownRight, Camera, X, Loader, Upload, BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

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
    const [trends, setTrends] = useState([]); // New state for graph
    const [analyticsLoading, setAnalyticsLoading] = useState(false);

    // Receipt Scanning State
    const [showReceiptScanner, setShowReceiptScanner] = useState(false);
    const [receiptImage, setReceiptImage] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState('');
    const fileInputRef = useRef(null);

    // Receipt File Upload
    const [receiptFile, setReceiptFile] = useState(null);
    const [receiptFilePreview, setReceiptFilePreview] = useState(null);
    const receiptUploadRef = useRef(null);

    // Line Items Extraction State
    const [extractedItems, setExtractedItems] = useState([]);
    const [showItemsTable, setShowItemsTable] = useState(false);
    const [rawOcrText, setRawOcrText] = useState('');

    // Form Stats
    const [formData, setFormData] = useState({
        projectId: '',
        refNo: '',
        store: '',
        desc: '',
        qty: 1,
        unitPrice: 0,
        category: 'Material', // Default
        date: new Date().toISOString().split('T')[0] // Default to Today
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
            if (data.debug) {
                console.log('Filter Debug:', data.debug);
            }
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
        const [projResult, trendResult] = await Promise.all([
            fetchProjectAnalytics(filter),
            fetchMonthlyTrends(new Date().getFullYear())
        ]);

        if (projResult && projResult.projects) {
            setProjectAnalytics(projResult.projects);
        }
        if (trendResult && trendResult.trends) {
            setTrends(trendResult.trends);
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

    // Helper: Convert data URL to File object
    const dataURLToFile = (dataURL, filename) => {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    };

    // Line Items Management Helpers
    const handleItemChange = (id, field, value) => {
        setExtractedItems(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const handleRemoveItem = (id) => {
        setExtractedItems(prev => prev.filter(item => item.id !== id));
    };

    const handleAddItem = () => {
        setExtractedItems(prev => [...prev, {
            id: Date.now(),
            description: '',
            qty: 1,
            unitPrice: 0
        }]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            // Check if we're saving multiple items or single entry
            if (showItemsTable && extractedItems.length > 0) {
                // BATCH SAVE: Create separate expense entry for each line item
                let successCount = 0;
                let failCount = 0;

                // Convert receipt file to base64 once (reuse for all entries)
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

                // Save each item as a separate expense
                for (const item of extractedItems) {
                    if (!item.description) continue; // Skip empty items

                    const amount = (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0);
                    const payload = {
                        projectId: formData.projectId,
                        refNo: formData.refNo,
                        store: formData.store,
                        desc: item.description,
                        qty: item.qty,
                        unitPrice: item.unitPrice,
                        amount: amount,
                        category: formData.category || 'Material',
                        date: formData.date
                    };

                    const success = await saveExpense(payload, receiptData, null);
                    if (success) {
                        successCount++;
                    } else {
                        failCount++;
                    }

                    // Small delay to avoid overwhelming backend
                    await new Promise(resolve => setTimeout(resolve, 300));
                }

                if (successCount > 0) {
                    alert(`✓ Saved ${successCount} expense(s) successfully!${failCount > 0 ? `\n${failCount} failed.` : ''}`);
                    setShowForm(false);
                    setShowItemsTable(false);
                    setExtractedItems([]);
                    setFormData({
                        projectId: '', refNo: '', store: '', desc: '', qty: 1, unitPrice: 0, category: 'Material', date: new Date().toISOString().split('T')[0]
                    });
                    setReceiptFile(null);
                    setReceiptFilePreview(null);
                    setTimeout(loadData, 2000);
                } else {
                    alert("Failed to save expenses.");
                }

            } else {
                // SINGLE SAVE: Original behavior
                const amount = (parseFloat(formData.qty) || 0) * (parseFloat(formData.unitPrice) || 0);
                const payload = {
                    ...formData,
                    amount: amount,
                    category: formData.category || 'Material',
                    date: formData.date
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

                const success = await saveExpense(payload, receiptData, null);
                if (success) {
                    alert("Expense Saved!");
                    setShowForm(false);
                    setFormData({
                        projectId: '', refNo: '', store: '', desc: '', qty: 1, unitPrice: 0, category: 'Material', date: new Date().toISOString().split('T')[0]
                    });
                    setReceiptFile(null);
                    setReceiptFilePreview(null);
                    setTimeout(loadData, 2000);
                } else {
                    alert("Failed to save expense.");
                }
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
            // Use Blob to force simple request (prevents CORS preflight)
            const payload = JSON.stringify({
                action: 'SCAN_RECEIPT',
                image: receiptImage
            });
            const blob = new Blob([payload], { type: 'text/plain;charset=utf-8' });

            const response = await fetch(
                import.meta.env.VITE_API_URL,
                {
                    method: 'POST',
                    body: blob
                }
            );

            const result = await response.json();

            if (result.error || !result.success) {
                setScanError(result.error || 'Failed to scan receipt');
                return;
            }

            if (result.success && result.extracted) {
                // Store raw OCR text for debugging
                setRawOcrText(result.rawText || '');

                // Check if line items were extracted
                if (result.extracted.items && result.extracted.items.length > 0) {
                    // Multiple items detected - show items table for review
                    setExtractedItems(result.extracted.items.map((item, idx) => ({
                        id: Date.now() + idx,  // Unique ID for React key
                        description: item.description || '',
                        qty: item.qty || 1,
                        unitPrice: item.unitPrice || 0
                    })));
                    setShowItemsTable(true);

                    // Pre-fill store and refNo
                    setFormData(prev => ({
                        ...prev,
                        store: result.extracted.store || prev.store,
                        refNo: result.extracted.refNo || prev.refNo
                    }));

                    // Convert scanned image to file object
                    const imageFile = dataURLToFile(receiptImage, 'scanned_receipt.jpg');
                    setReceiptFile(imageFile);
                    setReceiptFilePreview(receiptImage);

                    // Close scanner, open form with items table
                    setShowReceiptScanner(false);
                    setShowForm(true);

                    alert(`✓ Receipt scanned!\nStore: ${result.extracted.store || 'N/A'}\nFound ${result.extracted.items.length} line item(s)\n\nPlease review items and click Save.`);

                } else {
                    // No items detected - fallback to single total extraction
                    setFormData(prev => ({
                        ...prev,
                        store: result.extracted.store || prev.store,
                        refNo: result.extracted.refNo || prev.refNo,
                        unitPrice: result.extracted.amount || prev.unitPrice,
                        desc: result.extracted.store ? `Receipt from ${result.extracted.store}` : prev.desc
                    }));

                    // Convert scanned image to file object
                    const imageFile = dataURLToFile(receiptImage, 'scanned_receipt.jpg');
                    setReceiptFile(imageFile);
                    setReceiptFilePreview(receiptImage);

                    // Close scanner, open form
                    setShowReceiptScanner(false);
                    setShowForm(true);

                    alert(`✓ Receipt scanned!\nStore: ${result.extracted.store || 'N/A'}\nAmount: RM ${result.extracted.amount || 'N/A'}\n\nPlease review and click Save.`);
                }
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


                    {/* 0. TRENDS GRAPH */}
                    <div className="bg-white p-6 rounded-lg shadow mb-6">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                            <BarChart2 className="text-indigo-600" size={20} /> Monthly Financial Performance ({new Date().getFullYear()})
                        </h3>
                        <div className="h-[300px] w-full min-h-[300px]">
                            <ResponsiveContainer width="99%" height="100%" minWidth={100} minHeight={100}>
                                <BarChart data={trends} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        formatter={(value, name) => [`RM ${value.toFixed(2)}`, name === 'profit' ? 'Net Profit' : name === 'expenses' ? 'Expenses' : name]}
                                    />
                                    <Legend />
                                    <ReferenceLine y={0} stroke="#e5e7eb" />
                                    <Bar dataKey="profit" name="Net Profit" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={20} />
                                    <Bar dataKey="expenses" name="Expenses" fill="#f87171" radius={[4, 4, 0, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

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
                        <div className="bg-white p-5 rounded-lg shadow mb-8 border border-gray-200 animate-slideDown overflow-hidden">
                            <h3 className="text-xl font-bold mb-5 text-slate-800">New Expense Entry</h3>
                            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {/* Inputs */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Category</label>
                                    <select name="category" value={formData.category} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none">
                                        {['Material', 'Salary', 'Transport', 'Utility', 'Marketing', 'Asset', 'Inventory', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Description</label>
                                    <input type="text" name="desc" required value={formData.desc} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Item Name" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Store / Supplier</label>
                                    <input type="text" name="store" required value={formData.store} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Store Name" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Qty</label>
                                        <input type="number" name="qty" min="1" value={formData.qty} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Price (RM)</label>
                                        <input type="number" name="unitPrice" min="0" step="0.01" value={formData.unitPrice} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Date</label>
                                    <input type="date" name="date" required value={formData.date} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Ref No</label>
                                    <input type="text" name="refNo" required value={formData.refNo} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Project ID</label>
                                    <input type="text" name="projectId" value={formData.projectId} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="JOB-XXXX or INVENTORY" />
                                </div>

                                {/* LINE ITEMS TABLE */}
                                {showItemsTable && extractedItems.length > 0 && (
                                    <div className="lg:col-span-3 p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                                                <ShoppingBag size={18} />
                                                Line Items ({extractedItems.length})
                                            </h4>
                                            <button
                                                type="button"
                                                onClick={handleAddItem}
                                                className="text-xs font-bold px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                                            >
                                                Add Item
                                            </button>
                                        </div>

                                        <div className="bg-white rounded-xl border border-indigo-100 overflow-hidden">
                                            {/* Desktop Table View */}
                                            <div className="hidden md:block overflow-x-auto">
                                                <table className="min-w-full text-sm">
                                                    <thead className="bg-slate-50 border-b border-slate-100">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left font-bold text-slate-500">Item</th>
                                                            <th className="px-4 py-3 text-center font-bold text-slate-500 w-20">Qty</th>
                                                            <th className="px-4 py-3 text-right font-bold text-slate-500 w-28">Price</th>
                                                            <th className="px-4 py-3 text-right font-bold text-slate-500 w-28">Total</th>
                                                            <th className="px-4 py-3 text-center w-12"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {extractedItems.map((item) => (
                                                            <tr key={item.id}>
                                                                <td className="px-4 py-3">
                                                                    <input type="text" value={item.description} onChange={(e) => handleItemChange(item.id, 'description', e.target.value)} className="w-full bg-slate-50 border-none rounded-lg px-2 py-1.5 text-sm font-medium" />
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <input type="number" min="1" value={item.qty} onChange={(e) => handleItemChange(item.id, 'qty', e.target.value)} className="w-full bg-slate-50 border-none rounded-lg px-2 py-1.5 text-sm text-center font-medium" />
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <input type="number" step="0.01" value={item.unitPrice} onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)} className="w-full bg-slate-50 border-none rounded-lg px-2 py-1.5 text-sm text-right font-medium" />
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-bold text-slate-700">
                                                                    {(item.qty * item.unitPrice).toFixed(2)}
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <button type="button" onClick={() => handleRemoveItem(item.id)} className="text-red-400 hover:text-red-600 p-1"><X size={16} /></button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Mobile Card View */}
                                            <div className="md:hidden divide-y divide-slate-100">
                                                {extractedItems.map((item) => (
                                                    <div key={item.id} className="p-4 space-y-3">
                                                        <div className="flex justify-between items-start gap-2">
                                                            <div className="flex-1">
                                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description</label>
                                                                <input
                                                                    type="text"
                                                                    value={item.description}
                                                                    onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveItem(item.id)}
                                                                className="mt-6 p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                                            >
                                                                <X size={20} />
                                                            </button>
                                                        </div>

                                                        <div className="grid grid-cols-3 gap-3">
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Qty</label>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    value={item.qty}
                                                                    onChange={(e) => handleItemChange(item.id, 'qty', e.target.value)}
                                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-center font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Price</label>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={item.unitPrice}
                                                                    onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-right font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                                                                />
                                                            </div>
                                                            <div className="flex flex-col justify-end text-right">
                                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-5">Total</label>
                                                                <span className="text-sm font-bold text-slate-700 pb-2">
                                                                    RM {(item.qty * item.unitPrice).toFixed(2)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Attachments */}
                                <div className="lg:col-span-3">
                                    <div
                                        onClick={() => receiptUploadRef.current?.click()}
                                        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${receiptFile ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`}
                                    >
                                        <input ref={receiptUploadRef} type="file" onChange={handleReceiptFileSelect} className="hidden" />
                                        {receiptFile ? (
                                            <div className="flex items-center justify-center gap-4">
                                                {receiptFilePreview && <img src={receiptFilePreview} className="w-12 h-12 object-cover rounded-lg" />}
                                                <div className="text-left">
                                                    <p className="text-sm font-bold text-slate-900">{receiptFile.name}</p>
                                                    <p className="text-xs text-slate-400">Tap to change</p>
                                                </div>
                                                <button type="button" onClick={(e) => { e.stopPropagation(); handleRemoveReceiptFile(); }} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><X size={20} /></button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center">
                                                <Upload size={32} className="text-slate-300 mb-2" />
                                                <p className="text-sm font-bold text-slate-600">Attach Receipt</p>
                                                <p className="text-xs text-slate-400 mt-1">Tap here to upload a photo</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Form Actions */}
                                <div className="lg:col-span-3 flex gap-3 mt-4">
                                    <button type="button" onClick={() => { setShowForm(false); setExtractedItems([]); }} className="flex-1 py-4 text-slate-500 font-bold bg-slate-100 rounded-2xl hover:bg-slate-200 transition">Cancel</button>
                                    <button type="submit" disabled={isSaving} className="flex-[2] py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition">
                                        {isSaving ? 'Processing...' : (showItemsTable ? `Save ${extractedItems.length} Items` : 'Save Expense')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* TABLE & LIST VIEW */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Date</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Category</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Detail</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Job ID</th>
                                        <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {expenses.map((exp, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 text-sm">
                                            <td className="px-6 py-4 text-slate-500">{exp.date}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${exp.category === 'Material' ? 'bg-blue-100 text-blue-700' :
                                                    exp.category === 'Salary' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                    {exp.category || 'Other'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800">{exp.store}</div>
                                                <div className="text-xs text-slate-500">{exp.desc}</div>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-indigo-600">{exp.projectId || '-'}</td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-900">RM {Number(exp.amount).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {expenses.map((exp, idx) => (
                                <div key={idx} className="p-5 active:bg-slate-50 transition-colors">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${exp.category === 'Material' ? 'bg-blue-100 text-blue-700' :
                                                exp.category === 'Salary' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                {exp.category || 'Other'}
                                            </span>
                                            <h4 className="font-bold text-slate-800 mt-2">{exp.store}</h4>
                                            <p className="text-xs text-slate-500 mt-1">{exp.desc}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-lg font-bold text-slate-900 leading-none">RM {Number(exp.amount).toFixed(2)}</span>
                                            <p className="text-[10px] font-bold text-indigo-600 mt-1">{exp.projectId || 'PERSONAL'}</p>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">{exp.date}</div>
                                </div>
                            ))}
                        </div>
                        {expenses.length === 0 && <div className="p-12 text-center text-slate-400 italic">No business expenses recorded yet.</div>}
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
