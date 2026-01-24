// API URL must be configured via VITE_API_URL environment variable
const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
    throw new Error("VITE_API_URL environment variable is not set. Please configure your .env file.");
}

// Helper for Robust POST (Direct Blob to avoid CORS Preflight)
const postData = async (data) => {
    const blob = new Blob([JSON.stringify(data)], { type: 'text/plain;charset=utf-8' });
    const response = await fetch(API_URL, {
        method: "POST",
        body: blob
    });
    return await response.json();
};

export const scanReceiptAPI = async (base64Image) => {
    const payload = {
        action: 'SCAN_RECEIPT',
        image: base64Image
    };
    return await postData(payload);
};

export const saveInvoiceToSheet = async (invoiceData) => {


    // Google Apps Script requires 'no-cors' for simple POSTs usually, or specialized handling.
    // Ideally we use text/plain to avoid preflight CORS issues with simple GAS triggers.

    await fetch(API_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
            "Content-Type": "text/plain",
        },
        body: JSON.stringify(invoiceData),
    });

    // Because of 'no-cors', we get an opaque response. We can't read the JSON back.
    // We assume success if no network error thrown.
    return true;
};

export const fetchNextId = async () => {
    if (API_URL.includes("YOUR_WEB_APP_URL")) return "JOB-XXXX-XX-001";

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        const response = await fetch(`${API_URL}?action=getNextId`, {
            method: "GET",
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const text = await response.text();
        return text;
    } catch (e) {
        console.error("Failed to fetch ID:", e);
        // Fallback if API fails
        return `JOB-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-001`;
    }
};

export const fetchProjectById = async (id) => {
    try {
        const response = await fetch(`${API_URL}?action=getProject&id=${id}`);
        const data = await response.json();
        return data;
    } catch (e) {
        console.error("Failed to fetch project:", e);
        return { error: e.message };
    }
};

export const fetchDashboardStats = async (period = 'MONTH') => {
    try {
        const response = await fetch(`${API_URL}?action=getDashboardStats&period=${period}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        return null;
    }
};

export const fetchExpenses = async (period = 'MONTH') => {
    try {
        const response = await fetch(`${API_URL}?action=getExpenses&period=${period}`);
        const data = await response.json();
        return data;
    } catch (e) {
        console.error("Failed to fetch expenses:", e);
        return { error: e.message };
    }
};

export const saveExpense = async (expenseData, receiptData = null, existingReceiptUrl = null) => {
    const payload = {
        action: 'SAVE_EXPENSE',
        expense: expenseData
    };

    // Add existing receipt URL if provided (from scanner)
    if (existingReceiptUrl) {
        payload.existingReceiptUrl = existingReceiptUrl;
    }
    // OR add new receipt data if provided (from upload)
    else if (receiptData) {
        payload.receiptData = receiptData.data;
        payload.receiptFileName = receiptData.fileName;
        payload.receiptMimeType = receiptData.mimeType;
    }

    // Using no-cors, so we can't read response, but we fire and forget
    await fetch(API_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
            "Content-Type": "text/plain",
        },
        body: JSON.stringify(payload),
    });
    return true;
};

export const fetchInventoryStats = async () => {
    try {
        const response = await fetch(`${API_URL}?action=getInventoryStats`);
        return await response.json();
    } catch (e) {
        console.error("Failed to fetch inventory stats:", e);
        return { totalInventory: 0 };
    }
};

export const fetchProjectProfit = async (projectId) => {
    try {
        const response = await fetch(`${API_URL}?action=getProjectProfit&id=${projectId}`);
        return await response.json();
    } catch (e) {
        console.error("Failed to fetch profit:", e);
        return { error: e.message };
    }
};

export const fetchServiceReport = async (period) => {
    try {
        const response = await fetch(`${API_URL}?action=getServiceReport&period=${period}`);
        return await response.json();
    } catch (e) {
        console.error("Failed to fetch report:", e);
        return { error: e.message };
    }
};

export const fetchCompanyReport = async (period = 'MONTH') => {
    try {
        const response = await fetch(`${API_URL}?action=getCompanyReport&period=${period}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching company report:", error);
        return null;
    }
};

export const fetchProjectAnalytics = async (period = 'MONTH') => {
    try {
        const response = await fetch(`${API_URL}?action=getAllProjectsProfit&period=${period}`);
        return await response.json();
    } catch (e) {
        console.error("Failed to fetch analytics:", e);
        return { error: e.message };
    }
};

export const sendTestEmail = async () => {
    try {
        const response = await fetch(`${API_URL}?action=sendTestEmail`);
        return await response.json();
    } catch (e) {
        console.error("Failed to send test email:", e);
        return { error: e.message };
    }
};

export const sendInvoiceEmail = async (payload) => {
    // Payload: { to, subject, body, filename, base64 }
    const data = {
        action: 'SEND_INVOICE_EMAIL',
        payload: payload
    };

    const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(data),
    });
    return await response.json();
};

export const setupAutomatedReporting = async () => {
    const data = { action: 'SETUP_TRIGGER' };
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify(data),
        });
        return await response.json();
    } catch (e) {
        console.error("Failed to setup trigger:", e);
        return { error: e.message };
    }
};

export const fetchCustomers = async () => {
    try {
        const response = await fetch(`${API_URL}?action=getCustomers`);
        const data = await response.json();
        return data.customers || [];
    } catch (e) {
        console.error("Failed to fetch customers:", e);
        return [];
    }
};

export const updateProjectStatus = async (projectId, status, receiptData = null, paidAmount = null) => {
    const data = {
        action: 'UPDATE_STATUS',
        projectId: projectId,
        status: status
    };

    // Add receipt data if provided
    if (receiptData) {
        data.receiptData = receiptData.data;
        data.receiptFileName = receiptData.fileName;
        data.receiptMimeType = receiptData.mimeType;
    }

    // Add paid amount if provided
    if (paidAmount !== null && paidAmount !== undefined) {
        data.paidAmount = paidAmount;
    }

    // Use postData for robust CORS handling
    try {
        return await postData(data);
    } catch (e) {
        console.error("Failed to update status:", e);
        return { error: e.message };
    }
};

export const fetchProjects = async () => {
    try {
        const response = await fetch(`${API_URL}?action=getProjects`);
        return await response.json();
    } catch (e) {
        console.error("Failed to fetch projects:", e);
        return [];
    }
};

export const fetchProjectDocuments = async (projectId) => {
    try {
        const response = await fetch(`${API_URL}?action=getProjectDocs&id=${projectId}`);
        return await response.json();
    } catch (e) {
        console.error("Failed to fetch project documents:", e);
        return { error: e.message };
    }
};

export const fetchFileData = async (fileId) => {
    try {
        const response = await fetch(`${API_URL}?action=getFileData&fileId=${fileId}`);
        return await response.json();
    } catch (e) {
        console.error("Failed to fetch file data:", e);
        return { error: e.message };
    }
};
