// Replace this with your generated Web App URL after deployment
const API_URL = "https://script.google.com/macros/s/REDACTED_SECRET_2/exec";

export const saveInvoiceToSheet = async (invoiceData) => {


    // Google Apps Script requires 'no-cors' for simple POSTs usually, or specialized handling.
    // Ideally we use text/plain to avoid preflight CORS issues with simple GAS triggers.

    const response = await fetch(API_URL, {
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

export const saveExpense = async (expenseData) => {
    const payload = {
        action: 'SAVE_EXPENSE',
        expense: expenseData
    };

    // Using no-cors, so we can't read response, but we fire and forget
    const response = await fetch(API_URL, {
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
