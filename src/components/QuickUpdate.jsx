import React, { useState } from 'react';
import { Search, Check, Clock, DollarSign, Loader } from 'lucide-react';
import { fetchProjectById, updateProjectStatus } from '../services/sheetApi';

const QuickUpdate = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [project, setProject] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setError('Please enter a Project ID or Customer Name');
            return;
        }

        setIsSearching(true);
        setError('');
        setProject(null);
        setSuccessMessage('');

        try {
            // Try to fetch by project ID
            const data = await fetchProjectById(searchQuery.trim());

            if (data.error) {
                setError(`Project not found: ${searchQuery}`);
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
            <div className="bg-white rounded-lg shadow-md p-4 mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Project
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Enter Project ID (e.g., JOB-2026-01-015)"
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                        onClick={handleSearch}
                        disabled={isSearching}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[100px] justify-center"
                    >
                        {isSearching ? (
                            <>
                                <Loader className="animate-spin" size={18} />
                                <span className="hidden sm:inline">Searching...</span>
                            </>
                        ) : (
                            <>
                                <Search size={18} />
                                <span className="hidden sm:inline">Search</span>
                            </>
                        )}
                    </button>
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
            {!project && !error && !isSearching && (
                <div className="text-center py-12 text-gray-500">
                    <Search size={48} className="mx-auto mb-4 opacity-30" />
                    <p>Enter a Project ID to get started</p>
                </div>
            )}
        </div>
    );
};

export default QuickUpdate;
