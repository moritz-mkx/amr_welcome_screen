/**
 * API-Client (Vanilla fetch).
 *
 * Wird sowohl von der Display-Seite (`display.js`) als auch vom Admin-Panel
 * (kommt in Etappe 4) verwendet. ES-Modules, kein Build-Step.
 *
 * Die PHP-Endpunkte liegen unter `/api/<name>.php` (siehe README).
 *
 * Alle Methoden werfen `ApiError` bei Status >= 400; der Aufrufer kann
 * `error.status`, `error.body` (geparstes JSON falls vorhanden) und
 * `error.message` auswerten.
 */

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function parseJsonOrText(response) {
  const ct = response.headers.get('Content-Type') || '';
  if (ct.includes('application/json')) {
    try { return await response.json(); } catch { return null; }
  }
  try { return await response.text(); } catch { return null; }
}

async function request(path, { method = 'GET', body, headers, onProgress, signal } = {}) {
  const url = `${API_BASE}${path}`;
  const init = { method, headers: { ...(headers || {}) }, signal };

  if (body !== undefined && body !== null) {
    if (body instanceof FormData) {
      // Browser setzt boundary automatisch.
      init.body = body;
    } else if (typeof body === 'string') {
      init.body = body;
    } else {
      init.headers['Content-Type'] = init.headers['Content-Type'] || 'application/json';
      init.body = JSON.stringify(body);
    }
  }

  // onProgress fuer FormData-Uploads: fetch() unterstuetzt keine
  // Upload-Progress-Events. Fuer Datei-Uploads mit Progress nutzt
  // upload-Helper unten XMLHttpRequest.
  if (onProgress) {
    // Sollte nicht erreicht werden - wir routen Progress-Uploads ueber
    // `uploadWithProgress`. Hier nur Fallback.
    return uploadWithProgress(url, init, onProgress);
  }

  const response = await fetch(url, init);
  const data = await parseJsonOrText(response);
  if (!response.ok) {
    const msg = (data && typeof data === 'object' && data.error)
      ? data.error
      : `HTTP ${response.status} ${response.statusText}`;
    throw new ApiError(msg, response.status, data);
  }
  return data;
}

/**
 * Multipart-Upload mit Progress (XHR statt fetch).
 * @returns {Promise<any>}
 */
function uploadWithProgress(url, init, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(init.method || 'POST', url);
    if (init.headers) {
      for (const [k, v] of Object.entries(init.headers)) {
        // Content-Type bei FormData NIEMALS manuell setzen (boundary geht verloren).
        if (k.toLowerCase() === 'content-type' && init.body instanceof FormData) continue;
        xhr.setRequestHeader(k, v);
      }
    }
    xhr.upload.addEventListener('progress', (e) => {
      if (!onProgress) return;
      const total = e.total || 0;
      const loaded = e.loaded || 0;
      const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
      onProgress({ loaded, total, percent });
    });
    xhr.addEventListener('error', () => reject(new ApiError('Netzwerkfehler', 0, null)));
    xhr.addEventListener('abort',  () => reject(new ApiError('Upload abgebrochen', 0, null)));
    xhr.addEventListener('load', () => {
      let body = null;
      const ct = xhr.getResponseHeader('Content-Type') || '';
      if (ct.includes('application/json')) {
        try { body = JSON.parse(xhr.responseText); } catch { body = xhr.responseText; }
      } else {
        body = xhr.responseText;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body);
      } else {
        const msg = (body && typeof body === 'object' && body.error)
          ? body.error
          : `HTTP ${xhr.status} ${xhr.statusText}`;
        reject(new ApiError(msg, xhr.status, body));
      }
    });
    xhr.send(init.body);
  });
}

// --- Files ----------------------------------------------------------------
export const fileAPI = {
  getAll: () => request('/files.php'),
  upload: (file, onProgress) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/upload.php', { method: 'POST', body: fd, onProgress });
  },
  remove: (id) => request(`/files.php?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  toggleHidden: (id) =>
    request(`/files.php?id=${encodeURIComponent(id)}&action=toggle-hidden`, { method: 'PUT' }),
  updateOrder: (fileIds) =>
    request('/files-order.php', { method: 'PUT', body: { fileIds } }),
};

// --- Config ---------------------------------------------------------------
export const configAPI = {
  get:    () => request('/config.php'),
  update: (updates) => request('/config.php', { method: 'PUT', body: updates }),
  uploadLogo: (file) => {
    const fd = new FormData();
    fd.append('logo', file);
    return request('/config-logo.php', { method: 'POST', body: fd });
  },
  /**
   * Liefert die URL des Logos mit Cache-Buster.
   * Der Aufrufer baut die Buster-Variable selbst ein, falls noetig.
   */
  getLogoUrl: () => `${API_BASE}/logo.php`,
};

// --- Widget-Medien --------------------------------------------------------
export const widgetMediaAPI = {
  upload: (file, onProgress) => {
    const fd = new FormData();
    fd.append('media', file);
    return request('/widget-media.php', { method: 'POST', body: fd, onProgress });
  },
  remove: (id) => request(`/widget-image.php?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getUrl: (id) => `${API_BASE}/widget-image.php?id=${encodeURIComponent(id)}`,
};

// --- Schedules ------------------------------------------------------------
export const scheduleAPI = {
  getAll:    () => request('/schedules.php'),
  create:    (payload) => request('/schedules.php', { method: 'POST', body: payload }),
  update:    (id, payload) =>
    request(`/schedules.php?id=${encodeURIComponent(id)}`, { method: 'PUT', body: payload }),
  remove:    (id) =>
    request(`/schedules.php?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getActive: () => request('/active-schedule.php'),
};

// --- System ---------------------------------------------------------------
export const systemAPI = {
  getIP: () => request('/system-ip.php'),
};
