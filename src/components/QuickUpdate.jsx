import React, { useState, useEffect } from 'react';
import { Search, Check, Clock, DollarSign, Loader, ChevronDown, Upload, X, FileText, Image, Camera } from 'lucide-react';
import { fetchProjectById, updateProjectStatus, fetchProjects, scanReceiptAPI } from '../services/sheetApi';

const QuickUpdate = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [project, setProject] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

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
            // Ensure unique projects just in case
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

        try {
            const data = await fetchProjectById(idToSearch.trim());

            if (data.error) {
                setError(`Project not found: ${idToSearch}`);
            } else {
                setProject(data);
                setSelectedStatus(data.status || 'UNPAID');
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

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            setError('Invalid file type. Only JPG, PNG, and PDF are allowed.');
            return;
        }

        // Validate file size (10MB)
        if (file.size > 10 * 1024 * 1024) {
            setError('File too large. Maximum size is 10MB.');
            return;
        }

        setSelectedFile(file);
        setError('');

        // Create preview for images and auto-scan
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const preview = reader.result;
                setFilePreview(preview);

                // Auto-scan the receipt after preview is ready
                setIsScanning(true);
                try {
                    const base64 = preview.split(',')[1];
                    const apiKey = import.meta.env.VITE_VISION_API_KEY;

                    const result = await scanReceiptAPI(base64, apiKey);

                    if (result.success && result.extracted) {
                        if (result.extracted.amount) {
                            setPaidAmount(result.extracted.amount.toString());
                            setSuccessMessage("✨ Amount auto-detected: RM " + result.extracted.amount);
                            setTimeout(() => setSuccessMessage(''), 3000);
                        }
                    }
                } catch (e) {
                    console.error("Auto-scan failed", e);
                    // Silent fail - user can still manually enter amount
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
            // Extract base64 from data URL
            const base64 = filePreview.split(',')[1];
            const apiKey = import.meta.env.VITE_VISION_API_KEY;

            const result = await scanReceiptAPI(base64, apiKey);

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

        // Validate that payment amount is provided for PARTIAL/PAID status
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

        try {
            let receiptData = null;

            // Convert file to base64 if present
            if (selectedFile) {
                const reader = new FileReader();
                receiptData = await new Promise((resolve, reject) => {
                    reader.onloadend = () => {
                        // Remove data URL prefix to get pure base64
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

            // Include payment amount if present
            const amount = paidAmount ? parseFloat(paidAmount) : null;

            const response = await updateProjectStatus(
                project.project.id,
                selectedStatus,
                receiptData,
                amount
            );

            // Log response for debugging
            console.log('=== UPDATE_STATUS RESPONSE ===', response);

            if (response && response.error) {
                setError('Failed to update: ' + response.error);
                return;
            }

            setSuccessMessage(`✓ Status updated to ${selectedStatus}`);

            // Update local state
            setProject({
                ...project,
                status: selectedStatus
            });

            // Also update the list item's status if it exists
            setProjectsList(prev => prev.map(p =>
                p.id === project.project.id ? { ...p, status: selectedStatus } : p
            ));

            // Clear file selection and amount
            setSelectedFile(null);
            setFilePreview(null);
            setPaidAmount('');

            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (e) {
            setError('Failed to update status. Please try again.');
            console.error(e);
        } finally {
            setIsUpdating(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'PAID': return 'bg-green-100 text-green-800 border-green-300';
            case 'PARTIAL': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'UNPAID': return 'bg-red-100 text-red-800 border-red-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 pb-20">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Quick Status Update</h1>
                <p className="text-sm text-gray-600">Update job status from the field</p>
            </div>

            {/* Search Section */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-4 relative z-20">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Project
                </label>
                <div className="relative">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setShowDropdown(true);
                                }}
                                onFocus={() => setShowDropdown(true)}
                                placeholder={isLoadingList ? "Loading projects..." : "Select or type Project ID..."}
                                className="w-full border border-gray-300 rounded-lg pl-4 pr-10 py-3 text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                {isLoadingList ? (
                                    <Loader className="animate-spin" size={18} />
                                ) : (
                                    <ChevronDown size={18} />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Dropdown Menu */}
                    {showDropdown && (searchQuery || projectsList.length > 0) && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50">
                            {filteredProjects.length > 0 ? (
                                filteredProjects.map((p) => (
                                    <button
                                        key={p.id}
                                        className="w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-gray-100 last:border-0 flex justify-between items-center group"
                                        onClick={() => handleSelectProject(p.id)}
                                    >
                                        <div>
                                            <div className="font-medium text-gray-900 group-hover:text-indigo-700">
                                                {p.id}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {p.customer}
                                            </div>
                                        </div>
                                        <div className={`text-xs px-2 py-1 rounded ${p.status === 'PAID' ? 'bg-green-100 text-green-800' :
                                            p.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-red-100 text-red-800'
                                            }`}>
                                            {p.status}
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="p-4 text-center text-gray-500 text-sm">
                                    No projects found
                                </div>
                            )}
                        </div>
                    )}

                    {/* Overlay to close dropdown when clicking outside */}
                    {showDropdown && (
                        <div
                            className="fixed inset-0 z-[-1]"
                            onClick={() => setShowDropdown(false)}
                        />
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                    {error}
                </div>
            )}

            {/* Success Message */}
            {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                    <Check size={20} />
                    {successMessage}
                </div>
            )}

            {/* Project Details & Status Update */}
            {project && (
                <div className="bg-white rounded-lg shadow-md overflow-hidden relative z-10">
                    {/* Project Header */}
                    <div className="bg-indigo-600 text-white p-4">
                        <div className="text-sm opacity-90 mb-1">Project ID</div>
                        <div className="text-xl font-bold">{project.project.id}</div>
                    </div>

                    {/* Project Info */}
                    <div className="p-4 border-b">
                        <div className="text-lg font-semibold text-gray-900 mb-2">
                            {project.project.customer}
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                            {project.project.phone && (
                                <div>📞 {project.project.phone}</div>
                            )}
                            {project.project.email && (
                                <div>✉️ {project.project.email}</div>
                            )}
                        </div>
                    </div>

                    {/* Current Status */}
                    <div className="p-4 bg-gray-50 border-b">
                        <div className="text-sm text-gray-600 mb-2">Current Status</div>
                        <div className={`inline-block px-4 py-2 rounded-lg font-semibold border-2 ${getStatusColor(project.status)}`}>
                            {project.status}
                        </div>
                    </div>

                    {/* Status Update Options */}
                    <div className="p-4">
                        <div className="text-sm font-medium text-gray-700 mb-3">Update Status To:</div>
                        <div className="space-y-2 mb-4">
                            {['UNPAID', 'PARTIAL', 'PAID'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setSelectedStatus(status)}
                                    className={`w-full py-3 px-4 rounded-lg font-medium border-2 transition-all ${selectedStatus === status
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                                        } ${status === project.status ? 'opacity-50' : ''}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span>{status}</span>
                                        {status === project.status && (
                                            <span className="text-xs bg-gray-200 px-2 py-1 rounded">Current</span>
                                        )}
                                        {selectedStatus === status && status !== project.status && (
                                            <Check size={18} />
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Paid Amount Input - Shows for PARTIAL/PAID */}
                        {(selectedStatus === 'PARTIAL' || selectedStatus === 'PAID') && (
                            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <label className="block text-sm font-medium text-blue-900 mb-2">
                                    Paid Amount (RM) <span className="text-red-600">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                                        RM
                                    </span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={paidAmount}
                                        onChange={(e) => setPaidAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full pl-12 pr-4 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <p className="text-xs text-blue-600 mt-1">
                                    Enter the amount received from customer
                                </p>
                            </div>
                        )}

                        {/* File Upload Section - Shows for PARTIAL/PAID */}
                        {(selectedStatus === 'PARTIAL' || selectedStatus === 'PAID') && (
                            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <Upload size={18} className="text-amber-700" />
                                    <span className="text-sm font-medium text-amber-900">
                                        Payment Receipt Required
                                    </span>
                                </div>

                                {!selectedFile ? (
                                    <label className="block cursor-pointer">
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/jpg,image/png,application/pdf"
                                            onChange={handleFileSelect}
                                            className="hidden"
                                        />
                                        <div className="border-2 border-dashed border-amber-300 rounded-lg p-6 text-center hover:border-amber-400 hover:bg-amber-100 transition-colors">
                                            <Upload size={32} className="mx-auto mb-2 text-amber-600" />
                                            <p className="text-sm text-amber-800 font-medium mb-1">
                                                Click to upload receipt
                                            </p>
                                            <p className="text-xs text-amber-600">
                                                JPG, PNG, or PDF (max 10MB)
                                            </p>
                                        </div>
                                    </label>
                                ) : (
                                    <div className="border border-amber-200 rounded-lg p-3 bg-white">
                                        <div className="flex items-start gap-3">
                                            {filePreview ? (
                                                <img
                                                    src={filePreview}
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
                                                    {selectedFile.name}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <p className="text-xs text-gray-500">
                                                        {(selectedFile.size / 1024).toFixed(1)} KB
                                                    </p>
                                                    {filePreview && (
                                                        <button
                                                            onClick={handleScanReceipt}
                                                            disabled={isScanning}
                                                            className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 hover:bg-indigo-200"
                                                        >
                                                            {isScanning ? <Loader size={10} className="animate-spin" /> : <Camera size={10} />}
                                                            {isScanning ? 'Scanning...' : 'Scan Amount'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleRemoveFile}
                                                className="p-1 hover:bg-red-100 rounded-full transition-colors"
                                            >
                                                <X size={18} className="text-red-600" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Save Button */}
                        <button
                            onClick={handleStatusUpdate}
                            disabled={isUpdating || (!selectedFile && selectedStatus === project.status)}
                            className="w-full bg-green-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isUpdating ? (
                                <>
                                    <Loader className="animate-spin" size={20} />
                                    Updating...
                                </>
                            ) : (
                                <>
                                    <Check size={20} />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Empty State */}
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
