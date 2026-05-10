const CUSTOMER_EMAIL_STORAGE_KEY = "cutting_edge_customer_email";

export function normalizeCustomerEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getStoredCustomerEmail() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return localStorage.getItem(CUSTOMER_EMAIL_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setStoredCustomerEmail(email: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const normalized = normalizeCustomerEmail(email);
    if (!normalized) {
      localStorage.removeItem(CUSTOMER_EMAIL_STORAGE_KEY);
      return;
    }

    localStorage.setItem(CUSTOMER_EMAIL_STORAGE_KEY, normalized);
  } catch {
    // no-op
  }
}
