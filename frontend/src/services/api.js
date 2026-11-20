// API Client for Sri Mathurshree Agro Kendra ERP

const API_BASE = '/api';

export async function fetchDashboardSummary() {
  const res = await fetch(`${API_BASE}/dashboard-summary`);
  if (!res.ok) throw new Error('Failed to fetch dashboard summary');
  return res.json();
}

export async function fetchInventory() {
  const res = await fetch(`${API_BASE}/inventory`);
  if (!res.ok) throw new Error('Failed to fetch inventory');
  return res.json();
}

export async function searchSubstitutes(composition) {
  const res = await fetch(`${API_BASE}/products/substitutes?composition=${encodeURIComponent(composition)}`);
  if (!res.ok) throw new Error('Failed to search chemical substitutes');
  return res.json();
}

export async function fetchFEFOPreview(productId, qty) {
  const res = await fetch(`${API_BASE}/fefo-preview?product_id=${productId}&qty=${qty}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to calculate FEFO preview');
  }
  return res.json();
}

export async function fetchCustomers() {
  const res = await fetch(`${API_BASE}/customers`);
  if (!res.ok) throw new Error('Failed to fetch customers');
  return res.json();
}

export async function createInvoice(invoiceData) {
  const res = await fetch(`${API_BASE}/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invoiceData)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to create invoice');
  }
  return res.json();
}

export async function fetchInvoices() {
  const res = await fetch(`${API_BASE}/invoices`);
  if (!res.ok) throw new Error('Failed to fetch invoices');
  return res.json();
}

export async function fetchSuppliers() {
  const res = await fetch(`${API_BASE}/suppliers`);
  if (!res.ok) throw new Error('Failed to fetch suppliers');
  return res.json();
}

export async function createSupplier(supplierData) {
  const res = await fetch(`${API_BASE}/suppliers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(supplierData)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to create supplier');
  }
  return res.json();
}

export async function createProduct(productData) {
  const res = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to create product');
  }
  return res.json();
}

export async function createBatch(batchData) {
  const res = await fetch(`${API_BASE}/batches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batchData)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to add batch');
  }
  return res.json();
}
