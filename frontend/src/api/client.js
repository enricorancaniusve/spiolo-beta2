const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
  return res.json();
}

export const api = {
  confessions: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return req(`/api/confessions${qs ? '?' + qs : ''}`);
    },
    trending: () => req('/api/confessions/trending'),
    get: (id) => req(`/api/confessions/${id}`),
    create: (formData) => fetch(`${BASE}/api/confessions`, { method: 'POST', body: formData }).then(r => r.json()),
    listen: (id) => req(`/api/confessions/${id}/listen`, { method: 'POST' }),
    react: (id, emoji) => req(`/api/confessions/${id}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    }),
  },
  notifications: {
    list: () => req('/api/notifications'),
    dismiss: (id) => req(`/api/notifications/${id}`, { method: 'DELETE' }),
  },
  stats: () => req('/api/stats'),
};
