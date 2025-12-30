// Replace this with your generated Web App URL after deployment
const API_URL = "https://script.google.com/macros/s/REDACTED_SECRET_5/exec";

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
