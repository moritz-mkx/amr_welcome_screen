import axios from 'axios';

// Immer denselben Host wie die geöffnete Seite nutzen (funktioniert auf Pi-Kiosk und von anderen Geräten)
function getApiBaseUrl() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') return window.location.origin + '/api';
  return '/api';
}
const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Datei-Operationen
 */
export const fileAPI = {
  /**
   * Gibt alle Dateien zurück
   */
  getAllFiles: async () => {
    const response = await api.get('/files');
    return response.data;
  },

  /**
   * Lädt eine Datei hoch
   * @param {File} file
   * @param {(progress: { loaded: number, total: number, percent: number }) => void} [onProgress]
   */
  uploadFile: async (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (e) => {
        if (!onProgress) return;
        const total = e.total || file.size || 0;
        const loaded = e.loaded || 0;
        const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
        onProgress({ loaded, total, percent });
      }
    });
    return response.data;
  },

  /**
   * Löscht eine Datei
   */
  deleteFile: async (fileId) => {
    const response = await api.delete(`/files/${fileId}`);
    return response.data;
  },

  /**
   * Schaltet die Sichtbarkeit einer Datei um
   */
  toggleHidden: async (fileId) => {
    const response = await api.put(`/files/${fileId}/toggle-hidden`);
    return response.data;
  },

  /**
   * Aktualisiert die Reihenfolge der Dateien
   */
  updateFileOrder: async (fileIds) => {
    const response = await api.put('/files/order', { fileIds });
    return response.data;
  },

  /**
   * Gibt die URL für eine Datei zurück
   */
  getFileUrl: (fileId) => {
    return `${API_BASE_URL}/files/${fileId}`;
  },

  /**
   * Gibt die Display-URL für eine Datei zurück
   */
  getDisplayUrl: (fileId) => {
    return `${API_BASE_URL}/files/${fileId}/display`;
  }
};

/**
 * Konfigurations-Operationen
 */
export const configAPI = {
  /**
   * Gibt die aktuelle Konfiguration zurück
   */
  getConfig: async () => {
    const response = await api.get('/config');
    return response.data;
  },

  /**
   * Aktualisiert die Konfiguration
   */
  updateConfig: async (updates) => {
    const response = await api.put('/config', updates);
    return response.data;
  },

  /**
   * Lädt das Logo für die Uhr-Anzeige hoch
   */
  uploadLogo: async (file) => {
    const formData = new FormData();
    formData.append('logo', file);
    const response = await api.post('/config/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  /** URL des Logos (für Vorschau, mit Cache-Buster) */
  getLogoUrl: () => getApiBaseUrl() + '/logo'
};

/**
 * Widget-Medien (Bilder oder Videos für Medien-Widgets auf dem Uhr-Screen)
 */
export const widgetMediaAPI = {
  /**
   * @param {File} file
   * @param {(progress: { loaded: number, total: number, percent: number }) => void} [onProgress]
   */
  upload: async (file, onProgress) => {
    const formData = new FormData();
    formData.append('media', file);
    const response = await api.post('/widget-media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (!onProgress) return;
        const total = e.total || file.size || 0;
        const loaded = e.loaded || 0;
        const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
        onProgress({ loaded, total, percent });
      }
    });
    return response.data;
  },

  getUrl: (id) => `${API_BASE_URL}/widget-image/${encodeURIComponent(id)}`,

  delete: async (id) => {
    const response = await api.delete(`/widget-image/${encodeURIComponent(id)}`);
    return response.data;
  }
};

// Backwards-Kompatibilität: alter Name verweist auf neue Media-API
export const widgetImageAPI = widgetMediaAPI;

/**
 * Geplante Anzeigen (Scheduling)
 */
export const scheduleAPI = {
  getAll: async () => {
    const response = await api.get('/schedules');
    return response.data;
  },

  create: async (payload) => {
    const response = await api.post('/schedules', payload);
    return response.data;
  },

  update: async (id, payload) => {
    const response = await api.put(`/schedules/${id}`, payload);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/schedules/${id}`);
    return response.data;
  },

  getActive: async () => {
    const response = await api.get('/active-schedule');
    return response.data;
  }
};

/**
 * System-Informationen (z. B. IP für Einrichtung)
 */
export const systemAPI = {
  getIP: async () => {
    const response = await api.get('/system/ip');
    return response.data;
  }
};

export default api;
