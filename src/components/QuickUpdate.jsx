import React, { useState, useEffect, useRef } from 'react';
import { Search, Check, Clock, DollarSign, Loader, ChevronDown, X, Camera, Upload, FileText } from 'lucide-react';
import { fetchProjectById, updateProjectStatus } from '../services/sheetApi';

const QuickUpdate = () => {
    const [allProjects, setAllProjects] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [project, setProject] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedProjectDisplay, setSelectedProjectDisplay] = useState('');
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

    // Payment receipt upload
    const [paymentReceipt, setPaymentReceipt] = useState(null);
    const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
    const receiptFileInputRef = useRef(null);

    // Load all projects on mount
    useEffect(() => {
        const loadProjects = async () => {
            try {
                // Fetch using a dummy action to get list
                const response = await fetch(
                    import.meta.env.VITE_API_URL?.replace('?action=', '?action=getProjects') ||
                    'https://script.google.com/macros/s/REDACTED_SECRET_2/exec?action=getProjects'
                );
                const data = await response.json();
                if (data && Array.isArray(data)) {
                    setAllProjects(data);
                }
            } catch (e) {
                console.error('Failed to load projects:', e);
            } finally {
                setIsLoading(false);
            }
        };
        loadProjects();
    }, []);

    // Click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter projects based on search query
    const filteredProjects = allProjects.filter((proj) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            proj.id.toLowerCase().includes(query) ||
            proj.customer.toLowerCase().includes(query)
        );
    });

    const handleProjectSelect = async (projectId, projectDisplay) => {
        if (!projectId) return;

        setError('');
        setProject(null);
        setSuccessMessage('');
        setSelectedProjectDisplay(projectDisplay);
        setSearchQuery('');
        setIsDropdownOpen(false);

        try {
            const data = await fetchProjectById(projectId);

            if (data.error) {
                setError(`Project not found: ${projectId}`);
            } else {
                setProject(data);
                setSelectedStatus(data.status || 'UNPAID');
            }
        } catch (e) {
            setError('Failed to load project. Please try again.');
            console.error(e);
        }
    };

    const handleStatusUpdate = async () => {
        if (!project || !selectedStatus) return;

        setIsUpdating(true);
        setError('');
        setSuccessMessage('');

        try {
            await updateProjectStatus(project.project.id, selectedStatus);
            setSuccessMessage(`✓ Status updated to ${selectedStatus}`);

            // Update local state
            setProject({
                ...project,
                status: selectedStatus
            });

            // Clear success message after 3 seconds
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (e) {
            setError('Failed to update status. Please try again.');
            console.error(e);
        } finally {
            setIsUpdating(false);
        }
    };

    const clearSelection = () => {
        setSelectedProjectDisplay('');
        setSearchQuery('');
        setProject(null);
        setError('');
        setSuccessMessage('');
        setPaymentReceipt(null);
        inputRef.current?.focus();
    };

    const handleReceiptCapture = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setPaymentReceipt(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleUploadPaymentReceipt = async () => {
        if (!paymentReceipt || !project) return;

        setIsUploadingReceipt(true);

        try {
            const response = await fetch(
                import.meta.env.VITE_API_URL?.replace('?action=', '?action=uploadPaymentReceipt') ||
                'https://script.google.com/macros/s/REDACTED_SECRET_2/exec?action=uploadPaymentReceipt',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image: paymentReceipt,
                        projectId: project.project.id
                    })
                }
            );

            const result = await response.json();

            if (result.error) {
                setError(result.error);
            } else {
                setSuccessMessage('✓ Receipt uploaded successfully!');
            }
        } catch (error) {
            console.error('Upload error:', error);
            setError('Failed to upload receipt. Please try again.');
        } finally {
            setIsUploadingReceipt(false);
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

            {/* Searchable Project Selection Dropdown */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-4" ref={dropdownRef}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Project
                </label>
                {isLoading ? (
                    <div className="flex items-center justify-center py-4 text-gray-500">
                        <Loader className="animate-spin mr-2" size={20} />
                        Loading projects...
                    </div>
                ) : (
                    <div className="relative">
                        {/* Input Field */}
                        <div className="relative">
                            <input
                                ref={inputRef}
                                type="text"
                                value={selectedProjectDisplay || searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setSelectedProjectDisplay('');
                                    setIsDropdownOpen(true);
                                }}
                                onFocus={() => setIsDropdownOpen(true)}
                                placeholder="Type project ID or customer name..."
                                className="w-full border border-gray-300 rounded-lg pl-10 pr-20 py-3 text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />

                            {/* Clear and Dropdown Toggle Buttons */}
                            <div className="absolute right-2 top-2 flex gap-1">
                                {(selectedProjectDisplay || searchQuery) && (
                                    <button
                                        onClick={clearSelection}
                                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                                        type="button"
                                    >
                                        <X size={18} className="text-gray-400" />
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                                    type="button"
                                >
                                    <ChevronDown
                                        size={18}
                                        className={`text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>
                            </div>
                        </div>

                        {/* Dropdown List */}
                        {isDropdownOpen && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {filteredProjects.length > 0 ? (
                                    <ul>
                                        {filteredProjects.map((proj) => (
                                            <li key={proj.id}>
                                                <button
                                                    onClick={() => handleProjectSelect(proj.id, `${proj.id} - ${proj.customer}`)}
                                                    className="w-full text-left px-4 py-3 hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-none border-b border-gray-100 last:border-b-0 transition-colors"
                                                    type="button"
                                                >
                                                    <div className="font-medium text-gray-900">{proj.id}</div>
                                                    <div className="text-sm text-gray-600">{proj.customer}</div>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="px-4 py-3 text-center text-gray-500 text-sm">
                                        No projects found
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
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
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
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

                        {/* Payment Receipt Upload (shown when PAID is selected) */}
                        {selectedStatus === 'PAID' && (
                            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                    <Camera size={18} className="text-blue-600" />
                                    Payment Receipt (Optional)
                                </div>

                                {paymentReceipt ? (
                                    <div className="space-y-2">
                                        <img
                                            src={paymentReceipt}
                                            alt="Payment Receipt Preview"
                                            className="w-full rounded-lg border-2 border-blue-300"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => receiptFileInputRef.current?.click()}
                                                className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition flex items-center justify-center gap-2 text-sm font-medium text-blue-700"
                                            >
                                                <Upload size={16} />
                                                Change Image
                                            </button>
                                            <button
                                                onClick={handleUploadPaymentReceipt}
                                                disabled={isUploadingReceipt}
                                                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2 text-sm font-bold"
                                            >
                                                {isUploadingReceipt ? (
                                                    <>
                                                        <Loader className="animate-spin" size={16} />
                                                        Uploading...
                                                    </>
                                                ) : (
                                                    <>
                                                        <FileText size={16} />
                                                        Save to Drive
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => receiptFileInputRef.current?.click()}
                                        className="w-full px-4 py-3 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition flex items-center justify-center gap-2 text-blue-700 font-medium"
                                    >
                                        <Camera size={20} />
                                        Take/Upload Receipt Photo
                                    </button>
                                )}

                                <input
                                    ref={receiptFileInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handleReceiptCapture}
                                    className="hidden"
                                />

                                <p className="text-xs text-blue-600 mt-2">
                                    💡 Upload proof of payment (bank transfer receipt, cash receipt, etc.)
                                </p>
                            </div>
                        )}

                        {/* Save Button */}
                        <button
                            onClick={handleStatusUpdate}
                            disabled={isUpdating || selectedStatus === project.status}
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
            {!project && !error && !isLoading && (
                <div className="text-center py-12 text-gray-500">
                    <Search size={48} className="mx-auto mb-4 opacity-30" />
                    <p>Select a project to get started</p>
                </div>
            )}
        </div>
    );
};

export default QuickUpdate;
