import React, { useState, useEffect } from 'react';
import { fetchServiceReport } from '../services/sheetApi';
import { BarChart, Calendar, TrendingUp, FileText } from 'lucide-react';

const Reports = () => {
    const [period, setPeriod] = useState('ALL'); // 'MONTH', 'YEAR', 'ALL'
    const [report, setReport] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadReport();
    }, [period]);

    const loadReport = async () => {
        setLoading(true);
        const data = await fetchServiceReport(period);
        if (data && data.report) {
            setReport(data.report);
        }
        setLoading(false);
    };

    const getPeriodLabel = () => {
        if (period === 'MONTH') return 'This Month';
        if (period === 'YEAR') return 'This Year';
        return 'All Time';
    };

    const [modalConfig, setModalConfig] = useState({ show: false, title: '', message: '', onConfirm: null });
    const [actionLoading, setActionLoading] = useState(false);

    const openModal = (title, message, action) => {
        setModalConfig({ show: true, title, message, onConfirm: action });
    };

    const closeModal = () => {
        setModalConfig({ ...modalConfig, show: false });
    };

    const confirmAction = async () => {
        if (!modalConfig.onConfirm) return;
        setActionLoading(true);
        try {
            await modalConfig.onConfirm();
            closeModal();
        } catch (e) {
            alert("Error: " + e.message); // Fallback for error
        } finally {
            setActionLoading(false);
        }
    };

    const handleTestEmail = () => {
        openModal(
            "Send Manual Report",
            "Are you sure you want to generate and email the monthly report now?",
            async () => {
                const { sendTestEmail } = await import('../services/sheetApi');
                const res = await sendTestEmail();
                if (res.error) {
                    alert("Error: " + res.error);
                } else {
                    alert(res.result || "Report sent successfully!");
                }
            }
        );
    };

    const handleSetupTrigger = () => {
        openModal(
            "Enable Auto-Reporting",
            "Are you sure you want to enable automated monthly reporting (1st of each month)?",
            async () => {
                const { setupAutomatedReporting } = await import('../services/sheetApi');
                const res = await setupAutomatedReporting();
                if (res.error) {
                    alert("Error: " + res.error);
                } else {
                    alert(res.result || "Automation enabled!");
                }
            }
        );
    };

    return (
        <div className="p-4 md:p-6 pb-20">
            {/* Mobile-friendly header */}
            <div className="mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2 mb-4">
                    <BarChart className="text-indigo-600" size={20} /> Service Reports
                </h2>

                <div className="space-y-3">
                    {/* Period Toggle */}
                    <div className="flex bg-white rounded-lg shadow p-1 w-full">
                        {['MONTH', 'YEAR', 'ALL'].map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`flex-1 px-2 py-2 rounded text-xs md:text-sm font-medium transition ${period === p
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                {p === 'MONTH' ? 'Month' : p === 'YEAR' ? 'Year' : 'All'}
                            </button>
                        ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-row gap-2">
                        <button
                            onClick={handleTestEmail}
                            className="bg-green-700 text-white px-4 py-3 rounded-lg shadow hover:bg-green-600 flex items-center justify-center gap-2 text-sm font-semibold flex-1"
                        >
                            <Calendar size={16} /> Send Report Now
                        </button>
                        <button
                            onClick={() => window.open(`?view=PRINTABLE_REPORT&period=${period}`, '_blank')}
                            className="bg-indigo-900 text-white px-4 py-3 rounded-lg shadow hover:bg-indigo-800 flex items-center justify-center gap-2 text-sm font-semibold flex-1"
                        >
                            <FileText size={16} /> Print Report
                        </button>
                    </div>

                    {/* Auto-Report Link */}
                    <button
                        onClick={handleSetupTrigger}
                        className="w-full text-xs text-indigo-700 underline hover:text-indigo-900 text-center py-2"
                    >
                        Enable Monthly Auto-Email
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading analysis...</div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* LEADERBOARD CARD */}
                    <div className="lg:col-span-2 bg-white rounded-lg shadow overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <TrendingUp size={18} className="text-green-600" /> Top Services ({getPeriodLabel()})
                            </h3>
                            <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-500">
                                Total Services: {report.reduce((acc, curr) => acc + curr.qty, 0)}
                            </span>
                        </div>

                        {/* Mobile: Card Layout, Desktop: Table */}
                        <div className="block md:hidden">
                            {report.map((item, index) => (
                                <div key={index} className="p-4 border-b border-gray-200 hover:bg-gray-50">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="text-xs text-gray-500 font-mono">#{index + 1}</div>
                                            <div className="font-medium text-gray-900 mt-1">{item.type}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-green-700 font-bold">RM {Number(item.revenue).toFixed(2)}</div>
                                            <div className="bg-blue-100 text-blue-800 py-1 px-2 rounded-full text-xs font-bold mt-1 inline-block">
                                                {item.qty} units
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {report.length === 0 && (
                                <div className="p-8 text-center text-gray-500">
                                    No service data found for this period.
                                </div>
                            )}
                        </div>

                        {/* Desktop: Table Layout */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service Type</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue Generated</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {report.map((item, index) => (
                                        <tr key={index} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">#{index + 1}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.type}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                                                <span className="bg-blue-100 text-blue-800 py-1 px-2 rounded-full text-xs font-bold">
                                                    {item.qty} units
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-green-700 font-bold text-right">
                                                RM {Number(item.revenue).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                    {report.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                                                No service data found for this period.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* SUMMARY CARD */}
                    <div className="bg-gradient-to-br from-indigo-900 to-blue-900 text-white rounded-lg shadow p-6 h-fit">
                        <div className="flex items-center gap-3 mb-6">
                            <Calendar className="text-blue-300" />
                            <h3 className="font-semibold text-lg">Performance Summary</h3>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <p className="text-blue-200 text-sm uppercase tracking-wide">Top Performer</p>
                                <p className="text-2xl font-bold mt-1">
                                    {report.length > 0 ? report[0].type : "N/A"}
                                </p>
                                {report.length > 0 && (
                                    <p className="text-sm text-blue-300">
                                        {report[0].qty} installations done
                                    </p>
                                )}
                            </div>

                            <div className="h-px bg-blue-700"></div>

                            <div>
                                <p className="text-blue-200 text-sm uppercase tracking-wide">Total Revenue ({getPeriodLabel()})</p>
                                <p className="text-3xl font-bold mt-1 text-green-300">
                                    RM {report.reduce((acc, curr) => acc + curr.revenue, 0).toFixed(2)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {modalConfig.show && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-96 transform scale-100 transition-all">
                        <h3 className="text-xl font-bold mb-2 text-gray-800">{modalConfig.title}</h3>
                        <p className="text-gray-600 mb-6">{modalConfig.message}</p>

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={closeModal}
                                disabled={actionLoading}
                                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmAction}
                                disabled={actionLoading}
                                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                            >
                                {actionLoading ? (
                                    <>
                                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                                        Processing...
                                    </>
                                ) : (
                                    'Confirm'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reports;
