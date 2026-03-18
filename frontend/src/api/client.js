const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  
  // Se la risposta non è OK, proviamo a leggere l'errore o restituiamo lo stato HTTP
  if (!res.ok) {
    const errorText = await res.text(); // Leggiamo come testo per evitare il crash del JSON
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
    
    // CORRETTA: Ora usa la funzione req e gestisce i dati correttamente
   create: async (data) => {
  // 1. Se i dati sono già un FormData (per l'audio), li mandiamo così come sono
  if (data instanceof FormData) {
    return req('/api/confessions', {
      method: 'POST',
      body: data 
      // NOTA: Con FormData non devi mettere l'header Content-Type, lo fa il browser
    });
  }

  // 2. Se è un oggetto normale, assicuriamoci che i nomi dei campi siano corretti
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
