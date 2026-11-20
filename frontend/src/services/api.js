// API Client for Sri Mathurshree Agro Kendra ERP

const API_BASE = '/api';

// ─── Auth Helpers ────────────────────────────────────────────────────────────

export function getToken() {
  return localStorage.getItem('agro_erp_token');
}

export function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function apiFetch(url, options = {}) {
  const mergedOptions = {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {})
    }
  };

  const res = await fetch(url, mergedOptions);

  if (res.status === 401 && !url.includes('/api/auth/login')) {
    localStorage.removeItem('agro_erp_token');
    localStorage.removeItem('agro_erp_user');
    window.dispatchEvent(new Event('agro_logout'));
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed: ${res.status}`);
  }

  return res.json();
}

// ─── Auth Functions ───────────────────────────────────────────────────────────

export async function loginUser({ username, password }) {
  const data = await apiFetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  if (data.access_token) {
    localStorage.setItem('agro_erp_token', data.access_token);
  }
  if (data.user) {
    localStorage.setItem('agro_erp_user', JSON.stringify(data.user));
  }
  return data.user;
}

export function logoutUser() {
  localStorage.removeItem('agro_erp_token');
  localStorage.removeItem('agro_erp_user');
}

export async function fetchCurrentUser() {
  return apiFetch(`${API_BASE}/auth/me`);
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function fetchDashboardSummary() {
  return apiFetch(`${API_BASE}/dashboard-summary`);
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export async function fetchInventory() {
  return apiFetch(`${API_BASE}/inventory`);
}

export async function searchSubstitutes(composition) {
  return apiFetch(`${API_BASE}/products/substitutes?composition=${encodeURIComponent(composition)}`);
}

export async function fetchFEFOPreview(productId, qty) {
  return apiFetch(`${API_BASE}/fefo-preview?product_id=${productId}&qty=${qty}`);
}

// ─── Customers ───────────────────────────────────────────────────────────────

export async function fetchCustomers() {
  return apiFetch(`${API_BASE}/customers`);
}

export async function createCustomer(customerData) {
  return apiFetch(`${API_BASE}/customers`, {
    method: 'POST',
    body: JSON.stringify(customerData)
  });
}

export async function updateCreditLimit(customerId, creditLimit) {
  return apiFetch(`${API_BASE}/customers/${customerId}/credit-limit`, {
    method: 'PATCH',
    body: JSON.stringify({ credit_limit: creditLimit })
  });
}

export async function recordRepayment(customerId, repaymentData) {
  return apiFetch(`${API_BASE}/customers/${customerId}/repay`, {
    method: 'POST',
    body: JSON.stringify(repaymentData)
  });
}

export async function fetchCustomerLedger(customerId) {
  return apiFetch(`${API_BASE}/customers/${customerId}/ledger`);
}

// ─── Invoices ────────────────────────────────────────────────────────────────

export async function createInvoice(invoiceData) {
  return apiFetch(`${API_BASE}/invoices`, {
    method: 'POST',
    body: JSON.stringify(invoiceData)
  });
}

export async function fetchInvoices(params = {}) {
  const query = new URLSearchParams();
  if (params.start_date) query.append('start_date', params.start_date);
  if (params.end_date) query.append('end_date', params.end_date);
  if (params.payment_mode) query.append('payment_mode', params.payment_mode);
  if (params.status) query.append('status', params.status);
  if (params.search) query.append('search', params.search);
  const qs = query.toString();
  return apiFetch(`${API_BASE}/invoices${qs ? `?${qs}` : ''}`);
}

export async function fetchInvoiceById(invoiceId) {
  return apiFetch(`${API_BASE}/invoices/${invoiceId}`);
}

// ─── Phase 3: Sales Returns (Credit Notes) ───────────────────────────────────

export async function createSalesReturn(invoiceId, returnData) {
  return apiFetch(`${API_BASE}/invoices/${invoiceId}/return`, {
    method: 'POST',
    body: JSON.stringify(returnData)
  });
}

export async function fetchSalesReturns() {
  return apiFetch(`${API_BASE}/sales-returns`);
}

// ─── Phase 3: Expiry Action Center & Stock Adjustments ────────────────────────

export async function fetchInventoryAlerts() {
  return apiFetch(`${API_BASE}/alerts/inventory`);
}

export async function adjustBatchStock(batchId, adjustmentData) {
  return apiFetch(`${API_BASE}/batches/${batchId}/adjust`, {
    method: 'POST',
    body: JSON.stringify(adjustmentData)
  });
}

export async function fetchStockAdjustments() {
  return apiFetch(`${API_BASE}/stock-adjustments`);
}

// ─── Phase 3: Analytics & GST Reports ────────────────────────────────────────

export async function fetchAnalyticsReport() {
  return apiFetch(`${API_BASE}/reports/analytics`);
}

export async function fetchGstReports() {
  return apiFetch(`${API_BASE}/reports/gst`);
}

export async function fetchAuditLogs(limit = 100) {
  return apiFetch(`${API_BASE}/audit-logs?limit=${limit}`);
}

export async function downloadCsvReport(reportType) {
  const token = getToken();
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/reports/export/${reportType}`, { headers });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Export failed: ${res.status}`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const filename = match ? match[1] : `SMAK_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// ─── Suppliers ───────────────────────────────────────────────────────────────

export async function fetchSuppliers() {
  return apiFetch(`${API_BASE}/suppliers`);
}

export async function createSupplier(supplierData) {
  return apiFetch(`${API_BASE}/suppliers`, {
    method: 'POST',
    body: JSON.stringify(supplierData)
  });
}

// ─── Products / Batches ──────────────────────────────────────────────────────

export async function fetchProducts(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.append('search', params.search);
  if (params.category) query.append('category', params.category);
  if (params.barcode) query.append('barcode', params.barcode);
  const qs = query.toString();
  return apiFetch(`${API_BASE}/products${qs ? `?${qs}` : ''}`);
}

export async function createProduct(productData) {
  return apiFetch(`${API_BASE}/products`, {
    method: 'POST',
    body: JSON.stringify(productData)
  });
}

export async function createBatch(batchData) {
  return apiFetch(`${API_BASE}/batches`, {
    method: 'POST',
    body: JSON.stringify(batchData)
  });
}
