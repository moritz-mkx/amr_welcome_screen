/**
 * Admin-Panel Bootstrap.
 *
 * Liest den aktiven Tab aus dem `data-active-tab`-Attribut des Containers
 * und laedt das passende Tab-Modul. Tab-Module bekommen das Root-Element
 * und sorgen selbst fuer Rendering und Event-Handling.
 *
 * Geteilte Helpers (Formatierung, Toast-Status) werden hier exportiert,
 * damit alle Tab-Module sie nutzen koennen.
 */

const root = document.getElementById('tab-root');
const activeTab = root?.dataset.activeTab || 'files';

// =========================================================================
// Geteilte Helpers (von Tab-Modulen importiert)
// =========================================================================

/** Erzeugt ein HTMLElement mit Klassen + Attributen + Kindern. */
export function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.id) node.id = opts.id;
  if (opts.text != null) node.textContent = String(opts.text);
  if (opts.html != null) node.innerHTML = String(opts.html);
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) {
      if (v === false || v == null) continue;
      if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, String(v));
    }
  }
  if (opts.on) {
    for (const [event, fn] of Object.entries(opts.on)) {
      node.addEventListener(event, fn);
    }
  }
  if (opts.style) {
    for (const [k, v] of Object.entries(opts.style)) {
      node.style[k] = v;
    }
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else node.appendChild(child);
  }
  return node;
}

/** Bytes in lesbare Groessen umwandeln. */
export function formatBytes(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Millisekunden in "X s" / "X ms" formatieren. */
export function formatTime(ms) {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/** Zeigt eine Status-Meldung neben dem Speichern-Button. */
export function showSaveStatus(button, text, kind = 'success', durationMs = 2500) {
  const parent = button?.parentElement;
  if (!parent) return;
  const existing = parent.querySelector('.save-status');
  if (existing) existing.remove();
  const span = el('span', { className: 'save-status' + (kind === 'error' ? ' error' : ''), text });
  parent.appendChild(span);
  if (kind !== 'error' && durationMs > 0) {
    setTimeout(() => { span.remove(); }, durationMs);
  }
}

/** Loescht alle Kinder eines Elements. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// =========================================================================
// Tab-Routing
// =========================================================================

async function loadTab() {
  if (!root) return;
  try {
    if (activeTab === 'files') {
      const mod = await import('./admin-files.js');
      mod.mount(root);
    } else if (activeTab === 'settings') {
      const mod = await import('./admin-settings.js');
      mod.mount(root);
    } else if (activeTab === 'schedule') {
      const mod = await import('./admin-schedules.js');
      mod.mount(root);
    } else if (activeTab === 'clock') {
      const mod = await import('./admin-clock.js');
      mod.mount(root);
    } else {
      root.innerHTML = `<p style="color:#b00020;">Unbekannter Tab: ${activeTab}</p>`;
    }
  } catch (err) {
    console.error('[admin] Tab konnte nicht geladen werden:', err);
    root.innerHTML = `
      <h2 style="color:#b00020;">Fehler beim Laden des Tabs</h2>
      <p style="color:#666;">${err.message || err}</p>
    `;
  }
}

loadTab();
