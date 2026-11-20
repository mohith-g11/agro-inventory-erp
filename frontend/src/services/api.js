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

export async function fetchInvoices() {
  return apiFetch(`${API_BASE}/invoices`);
}

export async function fetchInvoiceById(invoiceId) {
  return apiFetch(`${API_BASE}/invoices/${invoiceId}`);
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
