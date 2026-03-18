const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  
  if (!res.ok) {
    const errorText = await res.text();
    try {
      const errorJson = JSON.parse(errorText);
      throw new Error(errorJson.error || `Errore ${res.status}`);
    } catch (e) {
      throw new Error(`Errore Server (${res.status}): ${errorText.substring(0, 50)}...`);
    }
  }
  
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
    
    create: async (data) => {
      // Gestione automatica per FormData (audio) o JSON semplice
      if (data instanceof FormData) {
        return req('/api/confessions', {
          method: 'POST',
          body: data 
        });
      }

      return req('/api/confessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: data.text || data.confession || data.content,
          category: data.category || 'secrets',
          audio_url: data.audio_url || null
        })
      });
    },

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
