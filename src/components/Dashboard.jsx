import React, { useEffect, useState } from 'react';
import { fetchDashboardStats } from '../services/sheetApi';
import { FileText, DollarSign, Clock, RefreshCcw, TrendingUp, Calendar } from 'lucide-react';

const Dashboard = ({ onLoadProject, onNewProject }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('MONTH'); // 'MONTH', 'LAST_MONTH', 'YEAR', 'ALL'

    useEffect(() => {
        loadStats();
    }, [period]);

    const loadStats = async () => {
        setLoading(true);
        const data = await fetchDashboardStats(period);
        if (data && !data.error) {
            setStats(data);
        }
        setLoading(false);
    };

    const periodLabels = {
        'MONTH': 'This Month',
        'LAST_MONTH': 'Last Month',
        'YEAR': 'This Year',
        'ALL': 'All Time'
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;

    if (!stats) return (
        <div className="p-8 text-center">
            <p className="text-red-500 mb-4">Failed to load dashboard data.</p>
            <button onClick={loadStats} className="bg-blue-600 text-white px-4 py-2 rounded">Retry</button>
        </div>
    );

    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>

                <div className="flex flex-wrap items-center gap-2 bg-white p-1 rounded-lg shadow-sm">
                    {['MONTH', 'LAST_MONTH', 'YEAR', 'ALL'].map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-3 py-1.5 text-xs font-medium rounded transition ${period === p
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            {periodLabels[p]}
                        </button>
                    ))}
                    <button onClick={loadStats} className="p-1.5 text-gray-400 hover:text-indigo-600 ml-1" title="Refresh">
                        <RefreshCcw size={16} />
                    </button>
                </div>

                <button onClick={onNewProject} className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 text-sm flex items-center gap-2">
                    <FileText size={16} /> New Project
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Total Sales (Invoiced) */}
                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-indigo-500">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-500 text-xs font-bold uppercase tracking-wide">Total Sales</span>
                        <div className="bg-indigo-50 p-2 rounded-full">
                            <TrendingUp className="text-indigo-600" size={18} />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-800">
                        RM {stats.sales ? stats.sales.toFixed(2) : "0.00"}
                    </div>
                    <span className="text-xs text-gray-400">Invoiced ({periodLabels[period]})</span>
                </div>

                {/* Total Collected (Cash In) */}
                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-500 text-xs font-bold uppercase tracking-wide">Collected</span>
                        <div className="bg-green-50 p-2 rounded-full">
                            <DollarSign className="text-green-600" size={18} />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-800">
                        RM {stats.collected ? stats.collected.toFixed(2) : "0.00"}
                    </div>
                    <span className="text-xs text-gray-400">Cash In ({periodLabels[period]})</span>
                </div>

                {/* Expenses (Cash Out) */}
                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-500 text-xs font-bold uppercase tracking-wide">Expenses</span>
                        <div className="bg-red-50 p-2 rounded-full">
                            <TrendingUp className="text-red-600 rotate-180" size={18} />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-800">
                        RM {stats.expenses ? stats.expenses.toFixed(2) : "0.00"}
                    </div>
                    <span className="text-xs text-gray-400">Cash Out ({periodLabels[period]})</span>
                </div>

                {/* Net Cash Flow */}
                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-emerald-600">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-500 text-xs font-bold uppercase tracking-wide">Net Profit</span>
                        <div className="bg-emerald-50 p-2 rounded-full">
                            <DollarSign className="text-emerald-600" size={18} />
                        </div>
                    </div>
                    <div className={`text-2xl font-bold ${stats.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        RM {stats.net ? stats.net.toFixed(2) : "0.00"}
                    </div>
                    <span className="text-xs text-gray-400">Real Cash in Hand</span>
                </div>
            </div>

            {/* Recent Table */}
            <div className="bg-white shadow rounded-lg overflow-hidden overflow-x-auto">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-800">Activity Log ({periodLabels[period]})</h3>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {stats.recent && stats.recent.map((proj) => (
                            <tr key={proj.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                                    {proj.id}
                                    {proj.type === 'QUOTATION' && <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">QTN</span>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{proj.date}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{proj.customer}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">RM {Number(proj.total).toFixed(2)}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                        ${proj.status === 'PAID' ? 'bg-green-100 text-green-800' :
                                            proj.status === 'UNPAID' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {proj.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => onLoadProject(proj.id)} className="text-indigo-600 hover:text-indigo-900 border border-indigo-200 rounded px-3 py-1 hover:bg-indigo-50">
                                        Load
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {(!stats.recent || stats.recent.length === 0) && (
                            <tr>
                                <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">No projects found in this period.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Dashboard;
