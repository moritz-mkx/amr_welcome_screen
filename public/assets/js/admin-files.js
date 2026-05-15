/**
 * Admin-Tab "Dateien".
 *
 * Funktional 1:1 zu FileUpload.jsx + FileList.jsx aus dem alten Frontend.
 *
 * - Drag&Drop-Upload mit Mehrfachauswahl und Pro-Datei-Fortschritt (XHR-Progress).
 * - Liste der hochgeladenen Dateien mit Vorschau (Bild/Video).
 * - Sortieren per Drag&Drop ueber SortableJS (Vendor unter assets/vendor/).
 * - Sichtbarkeit pro Datei umschaltbar.
 * - Loeschen mit confirm().
 */

import { fileAPI, ApiError } from './api.js';
import { el, formatBytes, clear } from './admin.js';

const SORTABLE_URL = '/assets/vendor/Sortable.min.js';
let sortableLoadPromise = null;

/**
 * Laedt SortableJS einmalig nach (klassisches Script-Tag, exponiert
 * `window.Sortable`).
 */
function loadSortable() {
  if (sortableLoadPromise) return sortableLoadPromise;
  sortableLoadPromise = new Promise((resolve, reject) => {
    if (window.Sortable) { resolve(window.Sortable); return; }
    const script = document.createElement('script');
    script.src = SORTABLE_URL;
    script.async = false;
    script.addEventListener('load', () => resolve(window.Sortable));
    script.addEventListener('error', () => reject(new Error('SortableJS konnte nicht geladen werden')));
    document.head.appendChild(script);
  });
  return sortableLoadPromise;
}

/** Bestaetigungs-Dialog (kann spaeter durch huebscheres Modal ersetzt werden). */
function confirmDialog(message) {
  return window.confirm(message);
}

// =========================================================================
// Mount
// =========================================================================

export async function mount(root) {
  clear(root);
  root.appendChild(buildUploadSection());
  const listContainer = el('div', { className: 'file-list', id: 'file-list-container' });
  root.appendChild(listContainer);

  await Promise.all([loadSortable().catch(() => null), loadAndRenderList()]);
}

// =========================================================================
// Upload-Bereich
// =========================================================================

function buildUploadSection() {
  const wrap = el('div', { className: 'file-upload' });
  wrap.appendChild(el('h2', { text: 'Dateien hochladen' }));
  wrap.appendChild(el('p', {
    className: 'upload-info',
    text: 'Unterst\u00fctzte Formate: Bilder (JPG, PNG, GIF, WEBP), Videos (MP4, WebM, OGG) und PDFs',
  }));

  const fileInput = el('input', {
    attrs: {
      type: 'file',
      multiple: true,
      accept: 'image/*,video/mp4,video/webm,video/ogg,.pdf',
    },
    style: { display: 'none' },
  });

  const uploadArea = el('div', { className: 'upload-area' });
  const setIdleContent = () => {
    clear(uploadArea);
    uploadArea.appendChild(el('div', { className: 'upload-content' }, [
      el('div', { className: 'upload-icon', text: '\u{1F4C1}' }),
      el('p', { className: 'upload-text', text: 'Dateien hier ablegen oder klicken zum Ausw\u00e4hlen' }),
      el('p', { className: 'upload-hint', text: 'Mehrere Dateien gleichzeitig m\u00f6glich' }),
    ]));
  };
  setIdleContent();

  let uploading = false;

  const setUploadingContent = (currentIndex, total, item) => {
    clear(uploadArea);
    const status = el('div', { className: 'upload-status' });
    status.appendChild(el('p', {
      className: 'upload-status-headline',
      text: total > 1 ? `Datei ${currentIndex + 1} von ${total} wird hochgeladen\u2026` : 'Wird hochgeladen\u2026',
    }));
    if (item) {
      status.appendChild(el('p', {
        className: 'upload-status-current',
        attrs: { title: item.name },
        text: `${item.name} (${formatBytes(item.size)})`,
      }));
    }
    uploadArea.appendChild(status);
  };

  const progressList = el('ul', { className: 'upload-progress-list' });
  const errorBox = el('div', { className: 'upload-error', style: { display: 'none' } });

  const setError = (msg) => {
    if (!msg) { errorBox.style.display = 'none'; errorBox.innerHTML = ''; return; }
    errorBox.style.display = 'block';
    errorBox.innerHTML = '';
    errorBox.appendChild(el('strong', { text: 'Fehler: ' }));
    errorBox.appendChild(document.createTextNode(msg));
  };

  async function handleFiles(fileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    uploading = true;
    setError(null);
    uploadArea.classList.add('uploading');
    clear(progressList);

    const items = files.map((f) => {
      const li = el('li', { className: 'upload-progress-item is-pending' });
      const meta = el('div', { className: 'upload-progress-meta' });
      meta.appendChild(el('span', { className: 'upload-progress-name', text: f.name, attrs: { title: f.name } }));
      const pct = el('span', { className: 'upload-progress-percent', text: 'Warten\u2026' });
      meta.appendChild(pct);
      const bar = el('div', { className: 'upload-progress-bar' });
      const fill = el('div', { className: 'upload-progress-bar-fill' });
      bar.appendChild(fill);
      li.appendChild(meta);
      li.appendChild(bar);
      progressList.appendChild(li);
      return { li, pct, fill };
    });

    let firstError = null;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const { li, pct, fill } = items[i];
      li.classList.remove('is-pending');
      li.classList.add('is-uploading');
      pct.textContent = '0%';
      setUploadingContent(i, files.length, file);

      try {
        await fileAPI.upload(file, ({ percent }) => {
          pct.textContent = percent + '%';
          fill.style.width = percent + '%';
        });
        li.classList.remove('is-uploading');
        li.classList.add('is-done');
        pct.textContent = '\u2713 Fertig';
        fill.style.width = '100%';
      } catch (err) {
        li.classList.remove('is-uploading');
        li.classList.add('is-error');
        const msg = (err instanceof ApiError && err.message) ? err.message : (err.message || 'Fehler');
        pct.textContent = msg;
        if (!firstError) firstError = msg;
      }
    }

    setIdleContent();
    uploadArea.classList.remove('uploading');
    uploading = false;
    if (firstError) setError(firstError);

    await loadAndRenderList();

    // Erfolgs-Eintraege ausblenden nach kurzer Zeit (wenn keine Fehler).
    if (!firstError) {
      setTimeout(() => { clear(progressList); }, 1500);
    }
  }

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  });

  // Drag&Drop
  uploadArea.addEventListener('click', () => { if (!uploading) fileInput.click(); });
  ['dragenter', 'dragover'].forEach((evt) => {
    uploadArea.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadArea.classList.add('drag-active');
    });
  });
  uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('drag-active');
  });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('drag-active');
    if (uploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  });

  wrap.appendChild(uploadArea);
  wrap.appendChild(fileInput);
  wrap.appendChild(progressList);
  wrap.appendChild(errorBox);
  return wrap;
}

// =========================================================================
// Datei-Liste
// =========================================================================

async function loadAndRenderList() {
  const container = document.getElementById('file-list-container');
  if (!container) return;
  clear(container);
  container.appendChild(el('h2', { text: 'Hochgeladene Dateien' }));
  container.appendChild(el('p', { className: 'list-hint', text: 'Lade Liste\u2026' }));

  let files = [];
  try {
    files = await fileAPI.getAll();
  } catch (err) {
    clear(container);
    container.appendChild(el('h2', { text: 'Hochgeladene Dateien' }));
    container.appendChild(el('div', {
      className: 'upload-error',
      style: { display: 'block' },
      html: `<strong>Fehler:</strong> ${err.message || 'Konnte Liste nicht laden'}`,
    }));
    return;
  }

  renderFileList(container, Array.isArray(files) ? files : []);
}

function renderFileList(container, files) {
  clear(container);
  container.appendChild(el('h2', { text: `Hochgeladene Dateien (${files.length})` }));

  if (files.length === 0) {
    container.appendChild(el('div', {
      className: 'empty-list',
      html: '<p>Noch keine Dateien hochgeladen.</p>',
    }));
    return;
  }

  container.appendChild(el('p', {
    className: 'list-hint',
    text: 'Ziehen Sie Dateien, um die Reihenfolge zu \u00e4ndern',
  }));

  const grid = el('div', { className: 'file-grid' });
  for (const file of files) {
    grid.appendChild(buildFileItem(file));
  }
  container.appendChild(grid);

  // Sortable initialisieren (falls verfuegbar).
  if (window.Sortable) {
    window.Sortable.create(grid, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      onEnd: async () => {
        const ids = Array.from(grid.querySelectorAll('.file-item')).map((it) => it.dataset.fileId);
        try {
          const updated = await fileAPI.updateOrder(ids);
          // Liste neu rendern mit Server-Reihenfolge (bleibt konsistent).
          renderFileList(container, Array.isArray(updated) ? updated : files);
        } catch (err) {
          console.error('[admin-files] Reihenfolge-Update fehlgeschlagen:', err);
          // Im Fehlerfall: alte Liste neu rendern.
          renderFileList(container, files);
        }
      },
    });
  }
}

function buildFileItem(file) {
  const item = el('div', {
    className: 'file-item' + (file.hidden ? ' file-item-hidden' : ''),
    attrs: { 'data-file-id': file.id },
  });

  const preview = el('div', { className: 'file-preview' });
  const errorOverlay = el('div', {
    className: 'file-preview-error',
    style: { display: 'none' },
    text: 'Vorschau nicht verf\u00fcgbar',
  });

  let media;
  if (file.type === 'video') {
    media = el('video', { attrs: { src: file.url, muted: true, playsinline: true, preload: 'metadata' } });
  } else {
    media = el('img', { attrs: { src: file.displayUrl || file.url, alt: file.originalName || '' } });
  }
  media.addEventListener('error', () => {
    media.style.display = 'none';
    errorOverlay.style.display = 'flex';
  });

  preview.appendChild(media);
  preview.appendChild(errorOverlay);
  if (file.type === 'video') preview.appendChild(el('div', { className: 'file-type-badge', text: 'VIDEO' }));
  if (file.hidden)            preview.appendChild(el('div', { className: 'file-hidden-badge', text: 'Ausgeblendet' }));

  const info = el('div', { className: 'file-info' });
  info.appendChild(el('div', {
    className: 'file-name',
    text: file.originalName || file.filename || '(unbenannt)',
    attrs: { title: file.originalName || '' },
  }));
  const meta = el('div', { className: 'file-meta' });
  meta.appendChild(el('span', { className: 'file-type', text: (file.type || '').toUpperCase() }));
  meta.appendChild(el('span', { className: 'file-size', text: `${(Number(file.size || 0) / 1024 / 1024).toFixed(2)} MB` }));
  info.appendChild(meta);

  const actions = el('div', { className: 'file-actions' });

  const toggleBtn = el('button', {
    className: 'toggle-hidden-button' + (file.hidden ? ' is-hidden' : ''),
    attrs: { title: file.hidden ? 'Einblenden' : 'Ausblenden', type: 'button' },
    text: file.hidden ? '\u{1F441}\u200D\u{1F5E8}' : '\u{1F441}',
    on: {
      click: async (e) => {
        e.stopPropagation();
        try {
          await fileAPI.toggleHidden(file.id);
          await loadAndRenderList();
        } catch (err) {
          alert(err.message || 'Fehler beim Umschalten der Sichtbarkeit');
        }
      },
    },
  });

  const deleteBtn = el('button', {
    className: 'delete-button',
    attrs: { title: 'Datei l\u00f6schen', type: 'button' },
    text: '\u{1F5D1}\uFE0F',
    on: {
      click: async (e) => {
        e.stopPropagation();
        if (!confirmDialog(`"${file.originalName || file.filename}" wirklich l\u00f6schen?`)) return;
        deleteBtn.disabled = true;
        deleteBtn.textContent = '\u2026';
        try {
          await fileAPI.remove(file.id);
          await loadAndRenderList();
        } catch (err) {
          alert(err.message || 'Fehler beim L\u00f6schen');
          deleteBtn.disabled = false;
          deleteBtn.textContent = '\u{1F5D1}\uFE0F';
        }
      },
    },
  });

  actions.appendChild(toggleBtn);
  actions.appendChild(deleteBtn);
  preview.appendChild(actions);

  item.appendChild(preview);
  item.appendChild(info);
  return item;
}
