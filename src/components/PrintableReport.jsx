
import React, { useEffect, useState } from 'react';
import { fetchCompanyReport } from '../services/sheetApi';

const PrintableReport = () => {
    const params = new URLSearchParams(window.location.search);
    const period = params.get('period') || 'MONTH';

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [period]);

    const loadData = async () => {
        setLoading(true);
        const result = await fetchCompanyReport(period);
        if (result) setData(result);
        setLoading(false);
    };

    const periodLabels = {
        'MONTH': 'This Month',
        'LAST_MONTH': 'Last Month',
        'YEAR': 'This Year',
        'ALL': 'All Time'
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Generating Report...</div>;

    if (!data) return <div className="p-8 text-center text-red-500">Failed to load report data.</div>;

    const { financials, projects, services, expenses } = data;

    return (
        <div className="max-w-[210mm] mx-auto p-8 print:max-w-none print:mx-0 print:p-8">
            <style>{`
                @media print {
                    @page { size: A4; margin: 0; }
                    body { margin: 0; padding: 0; background: white; }
                    /* Ensure content is visible */
                    * { visibility: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            `}</style>

            {/* Print Header */}
            <div className="flex justify-between items-start border-b-2 border-indigo-900 pb-6 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 uppercase tracking-widest">Company Report</h1>
                    <p className="text-gray-500 mt-1">Performance Overview</p>
                </div>
                <div className="text-right">
                    <h2 className="text-xl font-bold text-indigo-700">FAREEZ INSTALLATION SERVICES</h2>
                    <p className="text-sm text-gray-600">Generated on: {new Date().toLocaleDateString()}</p>
                    <p className="text-sm font-semibold text-gray-800 mt-2 bg-indigo-50 px-3 py-1 rounded inline-block">
                        Period: {periodLabels[period]}
                    </p>
                </div>
            </div>

            {/* Executive Summary Cards */}
            <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-700 mb-4 border-l-4 border-indigo-500 pl-3 uppercase">Financial Summary</h3>
                <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded">
                        <span className="block text-xs text-gray-500 uppercase font-semibold">Total Revenue</span>
                        <span className="block text-xl font-bold text-gray-800">RM {financials.sales.toFixed(2)}</span>
                    </div>
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded">
                        <span className="block text-xs text-gray-500 uppercase font-semibold">Collected (Cash)</span>
                        <span className="block text-xl font-bold text-green-700">RM {financials.collected.toFixed(2)}</span>
                    </div>
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded">
                        <span className="block text-xs text-gray-500 uppercase font-semibold">Expenses</span>
                        <span className="block text-xl font-bold text-red-600">RM {financials.expenses.toFixed(2)}</span>
                    </div>
                    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded">
                        <span className="block text-xs text-indigo-800 uppercase font-semibold">Net Profit</span>
                        <span className="block text-xl font-bold text-indigo-900">RM {financials.net.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
                {/* Project Stats */}
                <div>
                    <h3 className="text-lg font-bold text-gray-700 mb-4 border-l-4 border-blue-500 pl-3 uppercase">Project Activity</h3>
                    <table className="w-full text-sm">
                        <tbody>
                            <tr className="border-b">
                                <td className="py-2 text-gray-600">Total Projects Created</td>
                                <td className="py-2 font-bold text-right">{projects.total}</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2 text-gray-600">Fully Paid</td>
                                <td className="py-2 font-bold text-right text-green-600">{projects.paid}</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2 text-gray-600">Quotations Issued</td>
                                <td className="py-2 font-bold text-right text-blue-600">{projects.quotation}</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2 text-gray-600">Outstanding Balances</td>
                                <td className="py-2 font-bold text-right text-red-600">RM {financials.unpaid.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Top Expenses */}
                <div>
                    <h3 className="text-lg font-bold text-gray-700 mb-4 border-l-4 border-red-500 pl-3 uppercase">Top Expenses (By Store)</h3>
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="py-2 px-3 text-left">Store / Vendor</th>
                                <th className="py-2 px-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expenses.length > 0 ? expenses.map((exp, i) => (
                                <tr key={i} className="border-b">
                                    <td className="py-2 px-3 text-gray-700 truncate max-w-[150px]">{exp.store}</td>
                                    <td className="py-2 px-3 text-right font-medium">RM {exp.amount.toFixed(2)}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="2" className="py-4 text-center text-gray-500 italic">No expense data recorded.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Service Performance Table */}
            <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-700 mb-4 border-l-4 border-green-500 pl-3 uppercase">Top Performing Services</h3>
                <div className="bg-white rounded border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-800 text-white">
                            <tr>
                                <th className="py-2 px-4 text-left w-12">#</th>
                                <th className="py-2 px-4 text-left">Service Name</th>
                                <th className="py-2 px-4 text-center">Qty Replaced/Installed</th>
                                <th className="py-2 px-4 text-right">Revenue Generated</th>
                            </tr>
                        </thead>
                        <tbody>
                            {services.length > 0 ? services.map((svc, i) => (
                                <tr key={i} className="border-b hover:bg-gray-50">
                                    <td className="py-2 px-4 text-gray-500">{i + 1}</td>
                                    <td className="py-2 px-4 font-semibold text-gray-800">{svc.type}</td>
                                    <td className="py-2 px-4 text-center">
                                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-bold">{svc.qty}</span>
                                    </td>
                                    <td className="py-2 px-4 text-right">RM {svc.revenue.toFixed(2)}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="4" className="py-8 text-center text-gray-500">No service data found for this period.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-12 pt-8 border-t border-gray-200 flex justify-between items-center text-xs text-gray-400">
                <p>Fareez Installation Services - Confidential Internal Report</p>
                <p>System Generated</p>
            </div>

            {/* Print Button (Hidden when printing) */}
            <div className="fixed bottom-8 right-8 print:hidden">
                <button
                    onClick={() => window.print()}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-indigo-700 font-bold flex items-center gap-2 transition-transform hover:scale-105"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                    Print Report
                </button>
            </div>
        </div>
    );
};

export default PrintableReport;
