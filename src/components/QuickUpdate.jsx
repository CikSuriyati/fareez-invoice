import React, { useState, useEffect } from 'react';
import { Search, Check, Clock, DollarSign, Loader, ChevronDown, Upload, X, FileText, Image, Camera, Share2, ExternalLink, Phone, Mail } from 'lucide-react';
import { fetchProjectById, updateProjectStatus, fetchProjects, scanReceiptAPI, fetchProjectDocuments, fetchFileData } from '../services/sheetApi';

const QuickUpdate = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [project, setProject] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [generatedDoc, setGeneratedDoc] = useState(null); // { url, type }
    const [pdfData, setPdfData] = useState(null); // { base64, fileName }
    const [archivedDocs, setArchivedDocs] = useState([]);
    const [isLoadingDocs, setIsLoadingDocs] = useState(false);
    const [isSharingDoc, setIsSharingDoc] = useState(null);
    const [docDiagnostics, setDocDiagnostics] = useState(null);

    // Dropdown States
    const [projectsList, setProjectsList] = useState([]);
    const [filteredProjects, setFilteredProjects] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isLoadingList, setIsLoadingList] = useState(true);

    // File Upload States
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [isScanning, setIsScanning] = useState(false);

    // Payment Details States
    const [paidAmount, setPaidAmount] = useState('');

    // Load projects on mount
    useEffect(() => {
        loadProjects();
    }, []);

    // Filter projects when search query changes
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredProjects(projectsList);
        } else {
            const lowerQuery = searchQuery.toLowerCase();
            const filtered = projectsList.filter(p =>
                p.id.toLowerCase().includes(lowerQuery) ||
                p.customer.toLowerCase().includes(lowerQuery)
            );
            setFilteredProjects(filtered);
        }
    }, [searchQuery, projectsList]);

    const loadProjects = async () => {
        try {
            const list = await fetchProjects();
            const unique = list.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
            setProjectsList(unique);
            setFilteredProjects(unique);
        } catch (e) {
            console.error("Failed to load projects list", e);
        } finally {
            setIsLoadingList(false);
        }
    };

    const handleSelectProject = async (projectId) => {
        setSearchQuery(projectId);
        setShowDropdown(false);
        await handleSearch(projectId);
    };

    const handleSearch = async (overrideId) => {
        const idToSearch = overrideId || searchQuery;

        if (!idToSearch.trim()) {
            setError('Please select or enter a Project ID');
            return;
        }

        setIsSearching(true);
        setError('');
        setProject(null);
        setSuccessMessage('');
        setGeneratedDoc(null);
        setPdfData(null);

        try {
            const data = await fetchProjectById(idToSearch.trim());

            if (data.error) {
                setError(`Project not found: ${idToSearch}`);
            } else {
                setProject(data);
                setSelectedStatus(data.status || 'UNPAID');
                loadArchivedDocs(idToSearch.trim());
            }
        } catch (e) {
            setError('Failed to search. Please try again.');
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            setError('Invalid file type. Only JPG, PNG, and PDF are allowed.');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            setError('File too large. Maximum size is 10MB.');
            return;
        }

        setSelectedFile(file);
        setError('');

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const preview = reader.result;
                setFilePreview(preview);
                setIsScanning(true);
                try {
                    const base64 = preview.split(',')[1];
                    const result = await scanReceiptAPI(base64);

                    if (result.success && result.extracted) {
                        if (result.extracted.amount) {
                            setPaidAmount(result.extracted.amount.toString());
                            setSuccessMessage("✨ Amount auto-detected: RM " + result.extracted.amount);
                            setTimeout(() => setSuccessMessage(''), 3000);
                        }
                    }
                } catch (e) {
                    console.error("Auto-scan failed", e);
                } finally {
                    setIsScanning(false);
                }
            };
            reader.readAsDataURL(file);
        } else {
            setFilePreview(null);
        }
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
        setFilePreview(null);
    };

    const handleScanReceipt = async () => {
        if (!selectedFile || !filePreview) return;

        setIsScanning(true);
        try {
            const base64 = filePreview.split(',')[1];
            const result = await scanReceiptAPI(base64);

            if (result.success && result.extracted) {
                if (result.extracted.amount) {
                    setPaidAmount(result.extracted.amount.toString());
                    setSuccessMessage("✨ Amount extracted: RM " + result.extracted.amount);
                    setTimeout(() => setSuccessMessage(''), 3000);
                } else {
                    alert("Receipt scanned, but no amount found.");
                }
            } else {
                alert(result.error || "Failed to scan receipt.");
            }
        } catch (e) {
            console.error("Scan failed", e);
            alert("Error scanning receipt.");
        } finally {
            setIsScanning(false);
        }
    };

    const handleStatusUpdate = async () => {
        if (!project || !selectedStatus) return;

        if ((selectedStatus === 'PARTIAL' || selectedStatus === 'PAID')) {
            if (!paidAmount || parseFloat(paidAmount) <= 0) {
                setError('Please enter a valid paid amount for payment status updates.');
                return;
            }
            if (!selectedFile) {
                setError('Please upload a payment receipt.');
                return;
            }
        }

        setIsUpdating(true);
        setError('');
        setSuccessMessage('');
        setGeneratedDoc(null);
        setPdfData(null);

        try {
            let receiptData = null;

            if (selectedFile) {
                const reader = new FileReader();
                receiptData = await new Promise((resolve, reject) => {
                    reader.onloadend = () => {
                        const base64 = reader.result.split(',')[1];
                        resolve({
                            data: base64,
                            fileName: selectedFile.name,
                            mimeType: selectedFile.type
                        });
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(selectedFile);
                });
            }

            const amount = paidAmount ? parseFloat(paidAmount) : null;

            const response = await updateProjectStatus(
                project.project.id,
                selectedStatus,
                receiptData,
                amount
            );

            if (response && response.error) {
                setError('Failed to update: ' + response.error);
                return;
            }

            setSuccessMessage(`✓ Status updated to ${selectedStatus}`);

            if (response.fileUrl) {
                setGeneratedDoc({
                    url: response.fileUrl,
                    type: response.message.toLowerCase().includes('invoice') ? 'Invoice' : 'Receipt'
                });
            }

            if (response.pdfBase64) {
                setPdfData({
                    base64: response.pdfBase64,
                    fileName: response.pdfFileName
                });
            }

            setProject({
                ...project,
                status: selectedStatus
            });

            setProjectsList(prev => prev.map(p =>
                p.id === project.project.id ? { ...p, status: selectedStatus } : p
            ));

            setSelectedFile(null);
            setFilePreview(null);
            setPaidAmount('');
        } catch (e) {
            setError('Failed to update status. Please try again.');
            console.error(e);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleWhatsAppShare = async () => {
        if (!project || !generatedDoc) return;

        const phone = project.project.phone || '';
        const cleanPhone = String(phone).replace(/\D/g, '');

        let formatPhone = cleanPhone;
        if (cleanPhone.startsWith('0')) {
            formatPhone = '60' + cleanPhone.substring(1);
        }
        formatPhone = formatPhone.replace('+', '');

        const message = `Hi ${project.project.customer}, here is your ${generatedDoc.type} for ${project.project.id}`;

        if (navigator.share && pdfData && pdfData.base64) {
            try {
                const cleanBase64 = pdfData.base64.replace(/\s/g, '');
                const byteCharacters = atob(cleanBase64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const file = new File([byteArray], pdfData.fileName || 'document.pdf', { type: 'application/pdf' });

                const shareData = {
                    files: [file],
                    title: `${generatedDoc.type} ${project.project.id}`,
                    text: message
                };

                if (navigator.canShare && navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                    return;
                }
            } catch (err) {
                console.error('Error sharing file:', err);
            }
        }

        const whatsappUrl = `https://wa.me/${formatPhone}?text=${encodeURIComponent(message + ': ' + generatedDoc.url)}`;
        window.open(whatsappUrl, '_blank');
    };

    const loadArchivedDocs = async (projectId) => {
        setIsLoadingDocs(true);
        setDocDiagnostics(null);
        try {
            const result = await fetchProjectDocuments(projectId);
            if (result.result === "success") {
                setArchivedDocs(result.documents || []);
                if (result.diagnostics) {
                    setDocDiagnostics(result.diagnostics);
                }
            }
        } catch (e) {
            console.error("Failed to load archived documents", e);
        } finally {
            setIsLoadingDocs(false);
        }
    };

    const handleShareDoc = async (doc) => {
        setIsSharingDoc(doc.id);
        const message = `Hi ${project.project.customer}, here is your ${doc.type} for ${project.project.id}`;

        const phone = project.project.phone || '';
        const cleanPhone = String(phone).replace(/\D/g, '');
        let formatPhone = cleanPhone;
        if (cleanPhone.startsWith('0')) formatPhone = '60' + cleanPhone.substring(1);
        formatPhone = formatPhone.replace('+', '');

        try {
            const result = await fetchFileData(doc.id);
            if (result.result !== "success" || !result.base64) {
                throw new Error(result.error || "Failed to fetch file data from server");
            }

            const { base64, fileName, mimeType } = result;

            if (navigator.share) {
                try {
                    const cleanBase64 = base64.replace(/\s/g, '');
                    const byteCharacters = atob(cleanBase64);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const file = new File([byteArray], fileName || 'document.pdf', { type: mimeType || 'application/pdf' });

                    const shareData = {
                        files: [file],
                        title: fileName,
                        text: message
                    };

                    if (navigator.canShare && navigator.canShare(shareData)) {
                        await navigator.share(shareData);
                        return;
                    }
                } catch (err) {
                    console.error('Native share error:', err);
                }
            }

            const whatsappUrl = `https://wa.me/${formatPhone}?text=${encodeURIComponent(message + ': ' + doc.url)}`;
            window.open(whatsappUrl, '_blank');
        } catch (e) {
            alert("Failed to share document: " + e.message);
        } finally {
            setIsSharingDoc(null);
        }
    };

    return (
        <div className="min-h-full pb-32 md:pb-0">
            {/* Page Title */}
            <div className="mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-800">Quick Status Update</h2>
                <p className="text-slate-500 mt-1">Update payment status and manage documents</p>
            </div>

            {/* Project Search */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6 mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-3">Select Project</label>
                <div className="relative">
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setShowDropdown(true);
                            }}
                            onFocus={() => setShowDropdown(true)}
                            placeholder={isLoadingList ? "Loading projects..." : "Search or select a project..."}
                            className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 pr-10 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            {isLoadingList ? <Loader size={18} className="animate-spin" /> : <ChevronDown size={18} />}
                        </div>
                    </div>

                    {/* Dropdown Menu */}
                    {showDropdown && (searchQuery || projectsList.length > 0) && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto z-50 animate-fadeIn">
                            {filteredProjects.length > 0 ? (
                                filteredProjects.map((p) => (
                                    <button
                                        key={p.id}
                                        className="w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-slate-50 last:border-0 flex justify-between items-center group transition-colors"
                                        onClick={() => handleSelectProject(p.id)}
                                    >
                                        <div>
                                            <div className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                                                {p.id}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {p.customer}
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${p.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                                            p.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {p.status}
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <div className="p-6 text-center text-slate-400 text-sm italic">
                                    No records match your search
                                </div>
                            )}
                        </div>
                    )}

                    {/* Overlay to close dropdown */}
                    {showDropdown && (
                        <div className="fixed inset-0 z-[-1]" onClick={() => setShowDropdown(false)} />
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
                    <X size={18} />
                    <span className="font-medium text-sm">{error}</span>
                </div>
            )}

            {/* Project Details & Status Update */}
            {project && (
                <div className="animate-fadeIn">
                    {/* Project Summary Card */}
                    <div id="project-summary" className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl shadow-lg p-5 md:p-6 mb-6 text-white relative overflow-hidden group">
                        {/* Decorative circle */}
                        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>

                        <div className="flex items-start justify-between mb-4 relative z-10">
                            <div>
                                <span className="text-indigo-200 text-sm font-medium">Project ID</span>
                                <h3 id="project-id" className="text-xl md:text-2xl font-bold mt-0.5">{project.project.id}</h3>
                            </div>
                            <span id="current-status-badge" className={`px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm ${project.status === 'PAID' ? 'bg-emerald-500' :
                                project.status === 'PARTIAL' ? 'bg-amber-500' : 'bg-red-500'
                                }`}>
                                {project.status.toLowerCase()}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 pt-5 border-t border-indigo-500/30 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <FileText className="text-indigo-200" size={18} />
                                </div>
                                <div>
                                    <span className="text-indigo-200 text-xs block">Customer</span>
                                    <span id="customer-name" className="font-semibold">{project.project.customer}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Phone size={18} className="text-indigo-200" />
                                </div>
                                <div>
                                    <span className="text-indigo-200 text-xs block">Phone</span>
                                    <span id="customer-phone" className="font-semibold">{project.project.phone || 'N/A'}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Mail className="text-indigo-200" size={18} />
                                </div>
                                <div>
                                    <span className="text-indigo-200 text-xs block">Email</span>
                                    <span id="customer-email" className="font-semibold text-sm truncate max-w-[150px]">{project.project.email || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Status Update section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6 mb-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Update Payment Status</h3>

                        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
                            {/* UNPAID Button */}
                            <button
                                onClick={() => setSelectedStatus('UNPAID')}
                                className={`group p-4 md:p-5 rounded-xl border-2 transition-all duration-200 text-center ${selectedStatus === 'UNPAID'
                                    ? 'bg-red-50 border-red-500 shadow-md scale-[1.02]'
                                    : 'bg-slate-50 border-slate-200 hover:border-red-400 hover:bg-red-50'
                                    }`}
                            >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 transition-colors ${selectedStatus === 'UNPAID' ? 'bg-red-100' : 'bg-slate-100 group-hover:bg-red-100'
                                    }`}>
                                    <X className={selectedStatus === 'UNPAID' ? 'text-red-600' : 'text-slate-400 group-hover:text-red-600'} size={24} />
                                </div>
                                <span className={`font-bold text-sm md:text-base block ${selectedStatus === 'UNPAID' ? 'text-red-700' : 'text-slate-600'}`}>Unpaid</span>
                                <span className="text-slate-400 text-xs mt-1 block group-hover:text-red-500">RM 0 received</span>
                            </button>

                            {/* PARTIAL Button */}
                            <button
                                onClick={() => setSelectedStatus('PARTIAL')}
                                className={`group p-4 md:p-5 rounded-xl border-2 transition-all duration-200 text-center ${selectedStatus === 'PARTIAL'
                                    ? 'bg-amber-50 border-amber-500 shadow-md scale-[1.02]'
                                    : 'bg-slate-50 border-slate-200 hover:border-amber-400 hover:bg-amber-50'
                                    }`}
                            >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 transition-colors ${selectedStatus === 'PARTIAL' ? 'bg-amber-100' : 'bg-slate-100 group-hover:bg-amber-100'
                                    }`}>
                                    <Clock className={selectedStatus === 'PARTIAL' ? 'text-amber-600' : 'text-slate-400 group-hover:text-amber-600'} size={24} />
                                </div>
                                <span className={`font-bold text-sm md:text-base block ${selectedStatus === 'PARTIAL' ? 'text-amber-700' : 'text-slate-600'}`}>Partial</span>
                                <span className="text-slate-400 text-xs mt-1 block group-hover:text-amber-500 truncate">Deposit paid</span>
                            </button>

                            {/* PAID Button */}
                            <button
                                onClick={() => setSelectedStatus('PAID')}
                                className={`group p-4 md:p-5 rounded-xl border-2 transition-all duration-200 text-center ${selectedStatus === 'PAID'
                                    ? 'bg-emerald-50 border-emerald-500 shadow-md scale-[1.02]'
                                    : 'bg-slate-50 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50'
                                    }`}
                            >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 transition-colors ${selectedStatus === 'PAID' ? 'bg-emerald-100' : 'bg-slate-100 group-hover:bg-emerald-100'
                                    }`}>
                                    <Check className={selectedStatus === 'PAID' ? 'text-emerald-600' : 'text-slate-400 group-hover:text-emerald-600'} size={24} />
                                </div>
                                <span className={`font-bold text-sm md:text-base block ${selectedStatus === 'PAID' ? 'text-emerald-700' : 'text-slate-600'}`}>Paid</span>
                                <span className="text-slate-400 text-xs mt-1 block group-hover:text-emerald-500">Fully settled</span>
                            </button>
                        </div>

                        {/* Partial/Paid Details Inputs */}
                        {(selectedStatus === 'PARTIAL' || selectedStatus === 'PAID') && (
                            <div className="space-y-4 animate-slideDown mb-6">
                                {/* Amount input */}
                                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                                    <label className="block text-sm font-semibold text-amber-800 mb-2">Amount Received (RM)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={paidAmount}
                                            onChange={(e) => setPaidAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full bg-white border border-amber-300 rounded-lg px-4 py-3 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500 font-bold">RM</div>
                                    </div>
                                </div>

                                {/* File Upload */}
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-semibold text-slate-700">Payment Receipt</label>
                                        <button
                                            onClick={() => document.getElementById('camera-upload').click()}
                                            className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100 flex items-center gap-1 hover:bg-indigo-100 transition-colors"
                                        >
                                            <Camera size={12} /> SCAN CAMERA
                                        </button>
                                    </div>

                                    {!selectedFile ? (
                                        <div
                                            onClick={() => document.getElementById('receipt-upload').click()}
                                            className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-white transition-all group"
                                        >
                                            <Upload className="mx-auto text-slate-400 group-hover:text-indigo-500 mb-2" size={24} />
                                            <p className="text-sm font-medium text-slate-600">Click to select receipt</p>
                                            <p className="text-xs text-slate-400 mt-1">Images or PDF (Max 10MB)</p>
                                        </div>
                                    ) : (
                                        <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-sm relative overflow-hidden">
                                            {isScanning && (
                                                <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] z-10 flex items-center justify-center animate-fadeIn">
                                                    <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                                                        <Loader className="animate-spin" size={16} />
                                                        <span>OCR SCANNING...</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-3 min-w-0">
                                                {filePreview ? (
                                                    <img src={filePreview} className="w-12 h-12 object-cover rounded-lg" alt="Preview" />
                                                ) : (
                                                    <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center">
                                                        <FileText className="text-indigo-600" size={20} />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-slate-800 truncate">{selectedFile.name}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">
                                                            {(selectedFile.size / 1024).toFixed(1)} KB
                                                        </span>
                                                        {filePreview && (
                                                            <button
                                                                onClick={handleScanReceipt}
                                                                disabled={isScanning}
                                                                className="text-[10px] text-indigo-600 font-bold hover:underline flex items-center gap-1"
                                                            >
                                                                <Camera size={10} />
                                                                RE-SCAN RECEIPT
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <button onClick={handleRemoveFile} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                                                <X size={20} />
                                            </button>
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        id="receipt-upload"
                                        className="hidden"
                                        accept="image/*,application/pdf"
                                        onChange={handleFileSelect}
                                    />
                                    <input
                                        type="file"
                                        id="camera-upload"
                                        className="hidden"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handleFileSelect}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Save Button - Sticky on Mobile */}
                        <div className="fixed md:relative bottom-[80px] md:bottom-0 left-0 right-0 p-4 md:p-0 bg-white/80 md:bg-transparent backdrop-blur-md md:backdrop-blur-0 border-t md:border-t-0 border-slate-200 md:border-transparent z-40 transition-all duration-300">
                            <button
                                onClick={handleStatusUpdate}
                                disabled={isUpdating || (!selectedFile && selectedStatus === project.status)}
                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 shadow-xl shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                            >
                                {isUpdating ? <Loader className="animate-spin" size={20} /> : <Check size={20} />}
                                <span>{isUpdating ? 'Saving Changes...' : 'Save Changes'}</span>
                            </button>
                        </div>

                        {/* Success Message & WhatsApp Sharing */}
                        {successMessage && (
                            <div className="mt-4 p-5 bg-emerald-50 border border-emerald-200 rounded-xl animate-fadeIn">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                                        <Check className="text-white" size={20} />
                                    </div>
                                    <div>
                                        <span className="text-emerald-800 font-bold block">Status Updated!</span>
                                        <span className="text-emerald-600 text-sm font-medium">{successMessage}</span>
                                    </div>
                                </div>

                                {generatedDoc && (
                                    <div className="mt-4 pt-4 border-t border-emerald-200/50 space-y-2">
                                        <button
                                            onClick={handleWhatsAppShare}
                                            className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                                        >
                                            <Share2 size={18} />
                                            Send {generatedDoc.type} via WhatsApp
                                        </button>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(generatedDoc.url);
                                                setSuccessMessage('✓ Link copied to clipboard!');
                                                setTimeout(() => setSuccessMessage(successMessage), 3000);
                                            }}
                                            className="w-full bg-white text-slate-600 border border-slate-200 font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:bg-slate-50"
                                        >
                                            <ExternalLink size={16} />
                                            Copy Link Instead
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Document Archive section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6 mb-12">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-800">Document Archive</h3>
                            <div className="flex items-center gap-2">
                                {isLoadingDocs && <Loader className="animate-spin text-slate-400" size={16} />}
                                <span className="text-sm font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                                    {archivedDocs.length} documents
                                </span>
                            </div>
                        </div>

                        {archivedDocs.length > 0 ? (
                            <div className="space-y-3">
                                {archivedDocs.map((doc) => (
                                    <div key={doc.id} className="group flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 transition-all hover:border-indigo-200 hover:shadow-sm">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className={`w-12 h-12 ${doc.type === 'Invoice' ? 'bg-indigo-100 text-indigo-600' :
                                                doc.type === 'Receipt' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                                                } rounded-xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-110`}>
                                                <FileText size={24} />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-slate-800 truncate">{doc.type}</h4>
                                                <p className="text-xs text-slate-500 font-medium">
                                                    {doc.name} • {doc.date}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <a
                                                href={doc.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="p-2 text-slate-400 hover:bg-white hover:text-indigo-600 hover:shadow-sm rounded-lg transition-all"
                                                title="View Document"
                                            >
                                                <ExternalLink size={18} />
                                            </a>
                                            <button
                                                onClick={() => handleShareDoc(doc)}
                                                disabled={isSharingDoc === doc.id}
                                                className="p-2 text-slate-400 hover:bg-white hover:text-[#25D366] hover:shadow-sm rounded-lg transition-all"
                                                title="Share to WhatsApp"
                                            >
                                                {isSharingDoc === doc.id ? <Loader className="animate-spin" size={18} /> : <Share2 size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                                <FileText className="mx-auto text-slate-200 mb-3" size={48} />
                                <p className="text-slate-400 font-medium italic">No documents found for this project</p>
                            </div>
                        )}

                        {/* Status Diagnostics (Hidden by default, used for debugging if needed) */}
                        {docDiagnostics && (
                            <div className="mt-8 pt-6 border-t border-slate-100 hidden">
                                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-2">Debug Info</p>
                                <pre className="text-[9px] text-slate-400 font-mono bg-slate-50 p-2 rounded overflow-x-auto">
                                    {JSON.stringify(docDiagnostics, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {!project && !error && !isSearching && (
                <div className="text-center py-12 text-gray-500">
                    <Search size={48} className="mx-auto mb-4 opacity-30" />
                    <p>Select a project above to get started</p>
                </div>
            )}
        </div>
    );
};

export default QuickUpdate;
