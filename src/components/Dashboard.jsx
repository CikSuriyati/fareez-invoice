import React, { useEffect, useState } from 'react';
import { fetchDashboardStats } from '../services/sheetApi';
import { FileText, DollarSign, TrendingUp, Search, RefreshCcw } from 'lucide-react';

const Dashboard = ({ onLoadProject, onNewProject }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('MONTH'); // 'MONTH', 'LAST_MONTH', 'YEAR', 'ALL'
    const [searchQuery, setSearchQuery] = useState('');

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

    if (loading) return <div className="p-12 text-center text-slate-400 font-medium">Loading Dashboard...</div>;

    if (!stats) return (
        <div className="p-12 text-center">
            <p className="text-red-500 mb-4 font-medium">Failed to load dashboard data.</p>
            <button onClick={loadStats} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl text-sm font-semibold transition-all">Retry</button>
        </div>
    );

    // Filter recent projects based on search
    const filteredRecent = stats.recent ? stats.recent.filter(p =>
        p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.customer.toLowerCase().includes(searchQuery.toLowerCase())
    ) : [];

    return (
        <div className="min-h-full">
            {/* Header Section */}
            <div className="flex flex-row items-start justify-between mb-8">
                <div>
                    <h1 id="dashboard-title" className="text-3xl font-bold text-slate-800">Dashboard</h1>
                    <p className="text-slate-500 mt-1">Welcome back! Here's your business overview.</p>
                </div>
                <button
                    onClick={onNewProject}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 md:px-4 md:py-2 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2"
                    aria-label="New Project"
                >
                    <FileText size={20} />
                    <span className="hidden md:inline">New Project</span>
                </button>
            </div>

            {/* Time Filters */}
            <div className="flex flex-wrap gap-2 mb-8">
                {['MONTH', 'LAST_MONTH', 'YEAR', 'ALL'].map(p => (
                    <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${period === p
                            ? 'bg-indigo-600 text-white shadow-md border-transparent'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
                            }`}
                    >
                        {periodLabels[p]}
                    </button>
                ))}
                <button onClick={loadStats} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-all ml-auto" title="Refresh Data">
                    <RefreshCcw size={18} />
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Total Sales */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                            <TrendingUp className="text-blue-600" size={24} />
                        </div>
                        {/* Placeholder for growth metric, could be calculated later */}
                        {/* <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">+12%</span> */}
                    </div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Total Sales</p>
                    <p className="text-2xl font-bold text-slate-800">RM {stats.sales ? stats.sales.toFixed(2) : "0.00"}</p>
                </div>

                {/* Collected */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <DollarSign className="text-emerald-600" size={24} />
                        </div>
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Cash In</span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Collected</p>
                    <p className="text-2xl font-bold text-slate-800">RM {stats.collected ? stats.collected.toFixed(2) : "0.00"}</p>
                </div>

                {/* Expenses */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                            <TrendingUp className="text-amber-600 rotate-180" size={24} />
                        </div>
                        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">Cash Out</span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Expenses</p>
                    <p className="text-2xl font-bold text-slate-800">RM {stats.expenses ? stats.expenses.toFixed(2) : "0.00"}</p>
                </div>

                {/* Net Profit */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
                            <DollarSign className="text-violet-600" size={24} />
                        </div>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${stats.net >= 0 ? 'text-violet-600 bg-violet-50' : 'text-red-600 bg-red-50'}`}>
                            Net
                        </span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Net Profit</p>
                    <p className={`text-2xl font-bold ${stats.net >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                        RM {stats.net ? stats.net.toFixed(2) : "0.00"}
                    </p>
                </div>
            </div>

            {/* Activity Log Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Section Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Activity Log</h2>
                        <p className="text-slate-500 text-sm mt-0.5">{periodLabels[period]}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative w-full sm:w-64">
                            <input
                                type="text"
                                placeholder="Search jobs..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full"
                            />
                            <Search className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" size={20} />
                        </div>
                    </div>
                </div>

                {/* Table (Desktop only) */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50">
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Job ID</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredRecent.length > 0 ? (
                                filteredRecent.map((proj) => {
                                    const initial = proj.customer ? proj.customer.charAt(0).toUpperCase() : '?';
                                    const colors = ['from-indigo-400 to-indigo-600', 'from-rose-400 to-rose-600', 'from-amber-400 to-amber-600', 'from-cyan-400 to-cyan-600', 'from-emerald-400 to-emerald-600'];
                                    const colorClass = colors[proj.customer.length % colors.length];

                                    return (
                                        <tr key={proj.id} className="hover:bg-slate-50 transition-colors duration-150">
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-semibold text-indigo-600">{proj.id}</span>
                                                {proj.type === 'QUOTATION' && <span className="ml-2 text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase tracking-wider">QTN</span>}
                                            </td>
                                            <td className="px-6 py-4"><span className="text-sm text-slate-600">{proj.date}</span></td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 bg-gradient-to-br ${colorClass} rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                                                        {initial}
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-800">{proj.customer}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4"><span className="text-sm font-semibold text-slate-800">RM {Number(proj.total).toFixed(2)}</span></td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold 
                                                    ${proj.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                                                        proj.status === 'UNPAID' ? 'bg-amber-100 text-amber-700' :
                                                            proj.status === 'PARTIAL' ? 'bg-orange-100 text-orange-700' :
                                                                'bg-red-100 text-red-700'}`}>
                                                    {proj.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => onLoadProject(proj.id)}
                                                    className="text-indigo-600 hover:text-indigo-900 font-medium text-sm hover:underline"
                                                >
                                                    View Detail
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400 italic">
                                        No projects found in this period.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Card List (Mobile only) */}
                <div className="md:hidden divide-y divide-slate-100">
                    {filteredRecent.length > 0 ? (
                        filteredRecent.map((proj) => {
                            const initial = proj.customer ? proj.customer.charAt(0).toUpperCase() : '?';
                            const colors = ['from-indigo-400 to-indigo-600', 'from-rose-400 to-rose-600', 'from-amber-400 to-amber-600', 'from-cyan-400 to-cyan-600', 'from-emerald-400 to-emerald-600'];
                            const colorClass = colors[proj.customer.length % colors.length];

                            return (
                                <div
                                    key={proj.id}
                                    className="p-4 active:bg-slate-50 transition-colors cursor-pointer"
                                    onClick={() => onLoadProject(proj.id)}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-8 h-8 bg-gradient-to-br ${colorClass} rounded-full flex items-center justify-center text-white text-[10px] font-bold`}>
                                                {initial}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm leading-tight">{proj.customer}</h4>
                                                <p className="text-[10px] font-bold text-indigo-600 mt-0.5">{proj.id}</p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider 
                                            ${proj.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                                                proj.status === 'UNPAID' ? 'bg-amber-100 text-amber-700' :
                                                    proj.status === 'PARTIAL' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-red-100 text-red-700'}`}>
                                            {proj.status}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center mt-3">
                                        <span className="text-xs text-slate-400 font-medium">{proj.date}</span>
                                        <span className="text-sm font-bold text-slate-900">RM {Number(proj.total).toFixed(2)}</span>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-8 text-center text-slate-400 italic text-sm">
                            No records found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
