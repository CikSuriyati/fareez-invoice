import React, { useEffect, useState, useRef } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { Plus, Trash2, Save, Printer, Search, ChevronDown } from 'lucide-react';
import { fetchCustomers } from '../services/sheetApi';


const InvoiceForm = ({ defaultValues, onChange, onPrint, onSave, onLoadProject, isSaving, onEmail, isSending, onWhatsApp, isSavingPDF }) => {
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

    // State for Collapsible Sections (Item-by-item)
    const [expandedIndices, setExpandedIndices] = useState(new Set([0])); // Start with first item expanded
    const [isClientExpanded, setIsClientExpanded] = useState(true);

    const toggleItemExpansion = (index) => {
        setExpandedIndices(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

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
        <div className="space-y-6">
            {/* Header with quick actions - hidden on desktop as they are in Nav, but good for mobile/backup */}
            <div className="md:hidden flex flex-wrap gap-2 mb-4">
                <button onClick={onPrint} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2">
                    <Printer size={16} /> Print
                </button>

                <button
                    onClick={() => onSave()}
                    disabled={isSaving}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                    <Save size={16} /> {isSaving ? 'Saving...' : 'Save'}
                </button>
                {onWhatsApp && (
                    <button
                        onClick={onWhatsApp}
                        disabled={isSaving || isSavingPDF}
                        className="flex-1 bg-[#25D366] hover:bg-[#128C7E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="18" cy="5" r="3"></circle>
                            <circle cx="6" cy="12" r="3"></circle>
                            <circle cx="18" cy="19" r="3"></circle>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                        </svg>
                        {isSavingPDF ? 'Sharing...' : 'WhatsApp'}
                    </button>
                )}
            </div>

            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                {/* Invoice Details Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Save className="w-5 h-5 text-indigo-600" /> Invoice Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Document Type</label>
                            <select
                                {...register("type")}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                            >
                                <option value="INVOICE">Invoice</option>
                                <option value="RECEIPT">Receipt</option>
                                <option value="QUOTATION">Quotation</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Payment Status</label>
                            <select
                                {...register("status")}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                            >
                                <option value="UNPAID">Unpaid</option>
                                <option value="PAID">Paid</option>
                                <option value="PARTIAL">Partial</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Client Information Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <div
                        className="flex items-center justify-between cursor-pointer group"
                        onClick={() => setIsClientExpanded(!isClientExpanded)}
                    >
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Search className="w-5 h-5 text-indigo-600" /> Client Information
                            {!isClientExpanded && watch('project.customer') && (
                                <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full ml-2">
                                    {watch('project.customer')}
                                </span>
                            )}
                        </h3>
                        <div className={`transform transition-all duration-300 p-1 rounded-lg ${isClientExpanded ? 'rotate-180 bg-indigo-50 text-indigo-600' : 'rotate-0 text-slate-400 group-hover:bg-slate-100'}`}>
                            <ChevronDown size={20} />
                        </div>
                    </div>

                    {isClientExpanded && (
                        <div className="space-y-4 mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Project ID</label>
                                <div className="relative">
                                    <input
                                        {...register("project.id")}
                                        type="text"
                                        placeholder="Search or enter project ID"
                                        className="w-full pl-4 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => onLoadProject(watch("project.id"))}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                                    >
                                        <Search size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Date</label>
                                    <input
                                        type="date"
                                        {...register("project.date")}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    />
                                </div>
                                <div className="relative">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Customer Name {isLoadingCustomers && <span className="text-indigo-500 text-[10px] ml-1">(Loading...)</span>}
                                    </label>
                                    <input
                                        ref={customerInputRef}
                                        value={watch('project.customer') || ''}
                                        onChange={(e) => handleCustomerSearch(e.target.value)}
                                        onFocus={() => filteredCustomers.length > 0 && setShowSuggestions(true)}
                                        placeholder="Full name"
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        autoComplete="off"
                                    />
                                    {showSuggestions && filteredCustomers.length > 0 && (
                                        <div
                                            ref={suggestionsRef}
                                            className="absolute z-50 w-full bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-60 overflow-y-auto"
                                        >
                                            {filteredCustomers.map((customer, index) => (
                                                <div
                                                    key={index}
                                                    onClick={() => selectCustomer(customer)}
                                                    className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-b-0"
                                                >
                                                    <div className="font-semibold text-slate-800 text-sm">{customer.name}</div>
                                                    <div className="text-[10px] text-slate-500 mt-0.5">{customer.phone} • {customer.email}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                                <textarea
                                    {...register("project.address")}
                                    placeholder="Street, City, State, Postal Code"
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    rows="3"
                                ></textarea>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                                    <input
                                        type="email"
                                        {...register("project.email")}
                                        placeholder="customer@example.com"
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                                    <input
                                        type="tel"
                                        {...register("project.phone")}
                                        placeholder="+60 1X XXXX XXXX"
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Line Items Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-indigo-600" /> Line Items
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full ml-2">
                            {fields.length} {fields.length === 1 ? 'item' : 'items'}
                        </span>
                    </h3>

                    <div id="line-items-container" className="space-y-3 mb-4">
                        {fields.map((field, index) => {
                            const isExpanded = expandedIndices.has(index);
                            const itemValues = watch(`items.${index}`);
                            const itemTotal = (Number(itemValues?.unitPrice || 0) * Number(itemValues?.qty || 0)).toFixed(2);

                            return (
                                <div key={field.id} className={`line-item rounded-xl border transition-all duration-200 ${isExpanded ? 'bg-slate-50 border-slate-200 p-4' : 'bg-white border-slate-100 p-3 hover:bg-slate-50'}`}>
                                    {/* Item Header / Summary */}
                                    <div
                                        className="flex items-center justify-between cursor-pointer"
                                        onClick={() => toggleItemExpansion(index)}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`p-1 rounded-md transition-colors ${isExpanded ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                                <ChevronDown size={14} className={`transform transition-transform ${isExpanded ? 'rotate-180' : 'rotate-0'}`} />
                                            </div>
                                            {!isExpanded ? (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="font-bold text-slate-700 whitespace-nowrap">{itemValues?.room || 'Untitled Room'}</span>
                                                    <span className="text-slate-400">•</span>
                                                    <span className="text-slate-600 truncate max-w-[150px]">{itemValues?.type || 'No Type'}</span>
                                                    <span className="text-slate-400">•</span>
                                                    <span className="font-bold text-indigo-600">RM {itemTotal}</span>
                                                </div>
                                            ) : (
                                                <span className="text-sm font-bold text-slate-700">Item #{index + 1} Details</span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); remove(index); }}
                                                className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition-colors"
                                                title="Remove item"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded content */}
                                    {isExpanded && (
                                        <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <div className="grid grid-cols-2 gap-3">
                                                <input
                                                    {...register(`items.${index}.room`)}
                                                    list="room-options"
                                                    placeholder="Room/Area"
                                                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                                />
                                                <input
                                                    {...register(`items.${index}.type`)}
                                                    list="type-options"
                                                    placeholder="Installation Type"
                                                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <input {...register(`items.${index}.brand`)} placeholder="Brand (Optional)" className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                                                <input {...register(`items.${index}.model`)} placeholder="Model (Optional)" className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                                            </div>
                                            <textarea
                                                {...register(`items.${index}.desc`)}
                                                placeholder="Description"
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                                rows="1"
                                            ></textarea>
                                            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Price</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        {...register(`items.${index}.unitPrice`)}
                                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Qty</label>
                                                    <input
                                                        type="number"
                                                        {...register(`items.${index}.qty`)}
                                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Total</label>
                                                    <div className="px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-sm font-bold text-indigo-700 h-[38px] flex items-center justify-center">
                                                        RM {itemTotal}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            const newIndex = fields.length;
                            append({ room: '', type: '', brand: '', model: '', desc: '', unitPrice: 0, qty: 1 });
                            toggleItemExpansion(newIndex);
                        }}
                        className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 border-2 border-dashed border-indigo-200"
                    >
                        <Plus size={16} /> Add Item
                    </button>
                </div>

                {/* Totals Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Totals</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <label className="text-sm font-medium text-slate-600">Subtotal</label>
                            <span className="text-sm font-semibold text-slate-800">
                                RM {(values.items || []).reduce((acc, item) => acc + (Number(item.unitPrice || 0) * Number(item.qty || 0)), 0).toFixed(2)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-slate-700">Global Discount (RM)</label>
                            <input
                                type="number"
                                step="0.01"
                                {...register("discount")}
                                placeholder="0.00"
                                className="w-32 px-4 py-2 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-red-600"
                            />
                        </div>
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <span className="text-sm font-medium text-slate-600">Total Amount</span>
                            <span className="text-lg font-bold text-indigo-600">
                                RM {Math.max(0, (values.items || []).reduce((acc, item) => acc + (Number(item.unitPrice || 0) * Number(item.qty || 0)), 0) - (Number(values.discount) || 0)).toFixed(2)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-slate-700">Deposit Paid (RM)</label>
                            <input
                                type="number"
                                step="0.01"
                                {...register("depositPaid")}
                                placeholder="0.00"
                                className="w-32 px-4 py-2 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t-2 border-indigo-100 bg-indigo-50 -mx-6 px-6 py-4 rounded-b-2xl">
                            <span className="font-bold text-indigo-900">Balance Due</span>
                            <span className="text-2xl font-bold text-indigo-600">
                                RM {Math.max(0, ((values.items || []).reduce((acc, item) => acc + (Number(item.unitPrice || 0) * Number(item.qty || 0)), 0) - (Number(values.discount) || 0)) - (Number(values.depositPaid) || 0)).toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Datalists for Autocomplete */}
                <datalist id="room-options">
                    <option value="Living Room" />
                    <option value="Yard/Outdoor" />
                    <option value="Master Bedroom" />
                    <option value="Bedroom 2" />
                    <option value="Bedroom 3" />
                    <option value="Toilet 1" />
                    <option value="Toilet 2" />
                    <option value="Kitchen" />
                    <option value="Dining Area" />
                </datalist>
                <datalist id="type-options">
                    <option value="Lighting" />
                    <option value="Fan" />
                    <option value="Water Heater" />
                    <option value="Installation" />
                    <option value="Plumbing" />
                </datalist>

            </form>
        </div>
    );
};

export default InvoiceForm;
