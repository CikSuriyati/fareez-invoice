import React, { useEffect, useState, useRef } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { Plus, Trash2, Save, Printer, Search } from 'lucide-react';
import { fetchCustomers } from '../services/sheetApi';


const InvoiceForm = ({ defaultValues, onChange, onPrint, onSave, onLoadProject, isSaving, onEmail, isSending }) => {
    const { register, control, handleSubmit, watch, setValue, reset } = useForm({
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

    // Reset form when defaultValues (from parent fetch) changes
    useEffect(() => {
        if (defaultValues) {
            reset(defaultValues);
        }
    }, [defaultValues, reset]);

    // Customer Autocomplete State
    const [customers, setCustomers] = useState([]);
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
    const customerInputRef = useRef(null);
    const suggestionsRef = useRef(null);

    // Load customers on mount
    useEffect(() => {
        const loadCustomers = async () => {
            setIsLoadingCustomers(true);
            const customerList = await fetchCustomers();
            setCustomers(customerList);
            setIsLoadingCustomers(false);
        };
        loadCustomers();
    }, []);

    // Handle customer search
    const handleCustomerSearch = (searchText) => {
        setValue('project.customer', searchText);

        if (!searchText || searchText.length < 2) {
            setFilteredCustomers([]);
            setShowSuggestions(false);
            return;
        }

        const searchLower = searchText.toLowerCase();
        const matches = customers.filter(customer =>
            customer.name.toLowerCase().includes(searchLower)
        );

        setFilteredCustomers(matches);
        setShowSuggestions(matches.length > 0);
    };

    // Select customer from suggestions
    const selectCustomer = (customer) => {
        setValue('project.customer', customer.name);
        setValue('project.email', customer.email);
        setValue('project.phone', customer.phone);
        setValue('project.address', customer.address);
        setShowSuggestions(false);
        setFilteredCustomers([]);
    };

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(event.target) &&
                customerInputRef.current && !customerInputRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);


    // Auto-Payment Logic
    const currentStatus = watch("status");
    const currentType = watch("type");
    const currentItems = watch("items");
    const currentDiscount = watch("discount");

    useEffect(() => {
        // 1. If Receipt, force Status to PAID
        if (currentType === 'RECEIPT' && currentStatus !== 'PAID') {
            setValue('status', 'PAID');
        }

        // 2. If PAID, auto-fill Deposit with Full Net Amount
        if (currentStatus === 'PAID') {
            const subtotal = (currentItems || []).reduce((acc, item) => acc + (Number(item.unitPrice || 0) * Number(item.qty || 0)), 0);
            const discount = Number(currentDiscount) || 0;
            const netTotal = Math.max(0, subtotal - discount);
            setValue('depositPaid', netTotal);
        }
    }, [currentStatus, currentType, JSON.stringify(currentItems), currentDiscount, setValue]);

    const { fields, append, remove } = useFieldArray({
        control,
        name: "items"
    });

    // Watch all fields to trigger updates to parent
    const values = watch();

    // Store previous values to prevent infinite loops
    const prevValuesString = React.useRef(JSON.stringify(values));

    useEffect(() => {
        const currentValuesString = JSON.stringify(values);

        // Only proceed if values have actually changed in content
        // We also check if we just reset (initial load) to ensure totals are calculated once.
        if (prevValuesString.current !== currentValuesString) {
            prevValuesString.current = currentValuesString;
        } else {
            // If strictly equal string, check if we need to run for totals (e.g. first render)
            // But usually safe to skip to avoid loop
            // return; 
            // Actually, for the very first render, we do want to send data up. 
            // But if parent re-render caused this, return.
        }

        // Calculate totals automatically
        const subtotal = (values.items || []).reduce((acc, item) => acc + (Number(item.unitPrice || 0) * Number(item.qty || 0)), 0);
        const discount = Number(values.discount) || 0;
        const deposit = Number(values.depositPaid) || 0;

        // Inject calculated totals into the data passed to parent
        const dataWithTotals = {
            ...values,
            totals: {
                total: subtotal,
                discount: discount,
                deposit: deposit,
                balance: (subtotal - discount) - deposit
            }
        };

        // We wrap this in a timeout or check deep equality with parent state? 
        // Simplest: only fire if values changed (checked above)
        // BUT: useEffect fires on every render if [values] is new ref.
        // We need to NOT call onChange if content is same.

        onChange(dataWithTotals);
    }, [JSON.stringify(values), onChange]);

    return (
        <div className="bg-white p-6 shadow-lg rounded-lg border border-gray-200">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Invoice Details</h2>
                <div className="flex gap-2">
                    <button onClick={onPrint} className="bg-gray-700 text-white px-3 py-1.5 text-xs rounded flex items-center gap-1 hover:bg-gray-800 transition shadow-sm">
                        <Printer size={14} /> Print
                    </button>
                    {onEmail && (
                        <button
                            onClick={() => onEmail(watch('project.email'))}
                            disabled={isSending}
                            className="bg-green-700 text-white px-3 py-1.5 text-xs rounded flex items-center gap-1 hover:bg-green-800 transition disabled:opacity-50 shadow-sm"
                        >
                            {isSending ? 'Sending...' : 'Send Email'}
                        </button>
                    )}
                    <button onClick={handleSubmit((formData) => {
                        // Calculate totals to ensure they are sent to backend
                        const subtotal = (formData.items || []).reduce((acc, item) => acc + (Number(item.unitPrice || 0) * Number(item.qty || 0)), 0);
                        const discount = Number(formData.discount) || 0;
                        const deposit = Number(formData.depositPaid) || 0;
                        const fullData = {
                            ...formData,
                            totals: {
                                total: subtotal,
                                discount: discount,
                                deposit: deposit,
                                balance: (subtotal - discount) - deposit
                            }
                        };
                        onSave(fullData);
                    })} disabled={isSaving} className="bg-indigo-700 text-white px-3 py-1.5 text-xs rounded flex items-center gap-1 hover:bg-indigo-800 transition disabled:opacity-50 shadow-sm">
                        <Save size={14} /> {isSaving ? 'Saving...' : 'Save to Sheet'}
                    </button>
                </div>
            </div>

            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
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
                        <div className="flex gap-2">
                            <input {...register("project.id")} className="w-full border rounded p-1.5" placeholder="Enter ID to search" />
                            <button type="button" onClick={() => onLoadProject(watch("project.id"))} className="bg-blue-600 text-white p-1.5 rounded hover:bg-blue-700" title="Load Project">
                                <Search size={16} />
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500">Date</label>
                        <input type="date" {...register("project.date")} className="w-full border rounded p-1.5" />
                    </div>
                    <div className="md:col-span-2 relative">
                        <label className="block text-xs text-gray-500 mb-1">
                            Customer Name
                            {isLoadingCustomers && <span className="ml-2 text-indigo-600 text-xs">(Loading customers...)</span>}
                        </label>
                        <input
                            ref={customerInputRef}
                            value={watch('project.customer') || ''}
                            onChange={(e) => handleCustomerSearch(e.target.value)}
                            onFocus={() => {
                                // Show suggestions if there are matches when focusing
                                if (filteredCustomers.length > 0) {
                                    setShowSuggestions(true);
                                }
                            }}
                            className="w-full border rounded p-1.5"
                            placeholder="Start typing customer name..."
                            autoComplete="off"
                        />

                        {/* Autocomplete Suggestions Dropdown */}
                        {showSuggestions && filteredCustomers.length > 0 && (
                            <div
                                ref={suggestionsRef}
                                className="absolute z-50 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto"
                            >
                                {filteredCustomers.map((customer, index) => (
                                    <div
                                        key={index}
                                        onClick={() => selectCustomer(customer)}
                                        className="px-3 py-2 hover:bg-indigo-50 cursor-pointer border-b last:border-b-0"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="font-medium text-gray-900">{customer.name}</div>
                                                <div className="text-xs text-gray-600 mt-0.5">
                                                    {customer.email && <span>{customer.email}</span>}
                                                    {customer.phone && <span className="ml-2">• {customer.phone}</span>}
                                                </div>
                                            </div>
                                            <div className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                {customer.projectCount} {customer.projectCount === 1 ? 'project' : 'projects'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
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
                                    <input
                                        {...register(`items.${index}.room`)}
                                        list="room-options"
                                        placeholder="Room/Area"
                                        className="text-xs border rounded p-1"
                                    />
                                    <input
                                        {...register(`items.${index}.type`)}
                                        list="type-options"
                                        placeholder="Install Type"
                                        className="text-xs border rounded p-1"
                                    />
                                    <input {...register(`items.${index}.brand`)} placeholder="Brand" className="text-xs border rounded p-1" />
                                    <input {...register(`items.${index}.model`)} placeholder="Model" className="text-xs border rounded p-1" />
                                </div>

                                <div className="mb-2">
                                    <input {...register(`items.${index}.desc`)} placeholder="Description" className="w-full text-sm border rounded p-1" />
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        {...register(`items.${index}.unitPrice`)}
                                        placeholder="Unit Price"
                                        className="text-xs border rounded p-1"
                                    />
                                    <input
                                        type="number"
                                        {...register(`items.${index}.qty`)}
                                        placeholder="Qty"
                                        className="text-xs border rounded p-1"
                                    />
                                    <div className="text-xs flex items-center bg-gray-100 px-2 rounded text-gray-600">
                                        Total: {((watch(`items.${index}.unitPrice`) || 0) * (watch(`items.${index}.qty`) || 0)).toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={() => append({
                        room: '', type: '', brand: '', model: '', desc: '',
                        unitPrice: 0, qty: 1
                    })} className="mt-2 text-sm text-indigo-600 flex items-center gap-1 hover:text-indigo-800">
                        <Plus size={16} /> Add Item
                    </button>
                </div>

                {/* Footer Totals */}
                <div className="bg-gray-50 p-4 rounded text-right space-y-2">
                    <div>
                        <label className="text-sm font-bold text-gray-600 mr-2">GLOBAL DISCOUNT (RM):</label>
                        <input type="number" step="0.01" {...register("discount")} className="border border-red-300 rounded p-1 w-24 text-right text-red-600 font-bold" />
                    </div>
                    <div>
                        <label className="text-sm text-gray-600 mr-2">Deposit Paid (RM):</label>
                        <input type="number" step="0.01" {...register("depositPaid")} className="border rounded p-1 w-24 text-right" />
                    </div>
                    {/* Totals are calculated automatically in parent/preview */}
                </div>

                {/* DATALISTS DEFINITIONS */}
                <datalist id="room-options">
                    <option value="Living Room" />
                    <option value="Yard/Outdoor" />
                    <option value="Master Bedroom" />
                    <option value="Bedroom 2" />
                    <option value="Bedroom 3" />
                    <option value="Toilet 1" />
                    <option value="Toilet 2" />
                    <option value="Bathroom" />
                    <option value="Hall" />
                    <option value="Entrance/Foyer" />
                    <option value="Dining Area" />
                    <option value="Balcony" />
                    <option value="Kitchen" />
                </datalist>

                <datalist id="type-options">
                    <option value="Lighting" />
                    <option value="Fan" />
                    <option value="Water Heater" />
                    <option value="Door Bell" />
                    <option value="TV" />
                    <option value="Curtain/Blind" />
                    <option value="Shower Curtain" />
                    <option value="Mirror" />
                    <option value="Door Lock" />
                    <option value="Furniture Assembly" />
                    <option value="Towel Rack" />
                    <option value="Transportation" />
                    <option value="Plumbing Minor Fix" />
                    <option value="Installation" />
                </datalist>
            </form >
        </div >
    );
};

export default InvoiceForm;
