import React, { useEffect } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { Plus, Trash2, Save, Printer } from 'lucide-react';

const InvoiceForm = ({ defaultValues, onChange, onPrint, onSave, isSaving }) => {
    const { register, control, handleSubmit, watch, setValue } = useForm({
        defaultValues: defaultValues || {
            type: 'INVOICE',
            status: 'UNPAID',
            project: {
                id: `INV-${new Date().getFullYear()}-001`,
                date: new Date().toISOString().split('T')[0],
                customer: '',
                msg: ''
            },
            items: [
                { room: 'Living Room', type: 'Fan', desc: 'Install Ceiling Fan', unitPrice: 80, qty: 1 }
            ],
            depositPaid: 0
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "items"
    });

    // Watch all fields to trigger updates to parent
    const values = watch();

    useEffect(() => {
        // Calculate totals automatically
        const subtotal = values.items.reduce((acc, item) => acc + (Number(item.unitPrice) * Number(item.qty)), 0);
        const deposit = Number(values.depositPaid) || 0;

        // Inject calculated totals into the data passed to parent
        const dataWithTotals = {
            ...values,
            totals: {
                total: subtotal,
                deposit: deposit,
                balance: subtotal - deposit
            }
        };

        onChange(dataWithTotals);
    }, [values, onChange]);

    return (
        <div className="bg-white p-6 shadow-lg rounded-lg border border-gray-200">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Invoice Details</h2>
                <div className="space-x-2">
                    <button onClick={onPrint} className="bg-gray-700 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-gray-800 transition">
                        <Printer size={16} /> Print
                    </button>
                    <button onClick={handleSubmit(onSave)} disabled={isSaving} className="bg-indigo-700 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-indigo-800 transition disabled:opacity-50">
                        <Save size={16} /> {isSaving ? 'Saving...' : 'Save to Sheet'}
                    </button>
                </div>
            </div>

            <form className="space-y-6">
                {/* Document Settings */}
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Document Type</label>
                        <select {...register("type")} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
                            <option value="INVOICE">Invoice</option>
                            <option value="RECEIPT">Receipt</option>
                            <option value="QUOTATION">Quotation</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Payment Status</label>
                        <select {...register("status")} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
                            <option value="PAID">Paid</option>
                            <option value="PARTIAL">Partially Paid</option>
                            <option value="UNPAID">Unpaid</option>
                        </select>
                    </div>
                </div>

                {/* Client Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Client Information</h3>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500">Project ID</label>
                        <input {...register("project.id")} className="w-full border rounded p-1.5" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500">Date</label>
                        <input type="date" {...register("project.date")} className="w-full border rounded p-1.5" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs text-gray-500">Customer Name</label>
                        <input {...register("project.customer")} className="w-full border rounded p-1.5" placeholder="e.g. John Doe" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs text-gray-500">Address</label>
                        <textarea {...register("project.address")} rows={2} className="w-full border rounded p-1.5" placeholder="Full Address" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500">Email</label>
                        <input {...register("project.email")} className="w-full border rounded p-1.5" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500">Phone</label>
                        <input {...register("project.phone")} className="w-full border rounded p-1.5" />
                    </div>
                </div>

                {/* Line Items */}
                <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Line Items</h3>

                    <div className="space-y-4">
                        {fields.map((field, index) => (
                            <div key={field.id} className="border p-3 rounded bg-gray-50 relative">
                                <button type="button" onClick={() => remove(index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700">
                                    <Trash2 size={16} />
                                </button>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2 pr-6">
                                    <input {...register(`items.${index}.room`)} placeholder="Room/Area" className="text-xs border rounded p-1" />
                                    <input {...register(`items.${index}.type`)} placeholder="Install Type" className="text-xs border rounded p-1" />
                                    <input {...register(`items.${index}.brand`)} placeholder="Brand" className="text-xs border rounded p-1" />
                                    <input {...register(`items.${index}.model`)} placeholder="Model" className="text-xs border rounded p-1" />
                                </div>

                                <div className="mb-2">
                                    <input {...register(`items.${index}.desc`)} placeholder="Description" className="w-full text-sm border rounded p-1" />
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                    <div>
                                        <label className="block text-[10px] text-gray-500">Mat. Cost</label>
                                        <input type="number" step="0.01" {...register(`items.${index}.materialCost`)} className="w-full text-xs border rounded p-1" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-500">Transport</label>
                                        <input type="number" step="0.01" {...register(`items.${index}.transportFee`)} className="w-full text-xs border rounded p-1" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-500">Discount</label>
                                        <input type="number" step="0.01" {...register(`items.${index}.discount`)} className="w-full text-xs border rounded p-1" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-500">Unit Price</label>
                                        <input type="number" step="0.01" {...register(`items.${index}.unitPrice`)} className="w-full text-xs border rounded p-1" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-500">Qty</label>
                                        <input type="number" {...register(`items.${index}.qty`)} className="w-full text-xs border rounded p-1" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={() => append({
                        room: '', type: '', brand: '', model: '', desc: '',
                        materialCost: 0, transportFee: 0, discount: 0, unitPrice: 0, qty: 1
                    })} className="mt-2 text-sm text-indigo-600 flex items-center gap-1 hover:text-indigo-800">
                        <Plus size={16} /> Add Item
                    </button>
                </div>

                {/* Footer Totals */}
                <div className="bg-gray-50 p-4 rounded text-right space-y-2">
                    <div>
                        <label className="text-sm text-gray-600 mr-2">Deposit Paid (RM):</label>
                        <input type="number" step="0.01" {...register("depositPaid")} className="border rounded p-1 w-24 text-right" />
                    </div>
                    {/* Totals are calculated automatically in parent/preview */}
                </div>
            </form>
        </div>
    );
};

export default InvoiceForm;
