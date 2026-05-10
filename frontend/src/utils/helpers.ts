export const capitalizeFirst = (str: string) => {
  if (!str) return ""
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

export const formatPrice = (amount: number | undefined | null, currency: string = "EUR") => {
  if (amount === undefined || amount === null) return currency === "EUR" ? "0.00€" : "$0.00";
  
  const formatted = new Intl.NumberFormat(currency === "EUR" ? "es-ES" : "en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);

  return formatted;
};

export const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 401) {
    // Si el token expira, limpiar y recargar para que App.tsx mande al login
    localStorage.removeItem('token');
    window.location.reload();
  }

  return response;
};

export const triggerRefresh = () => {
  window.dispatchEvent(new CustomEvent('hustle-refresh'));
};
