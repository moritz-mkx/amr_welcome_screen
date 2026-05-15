/**
 * Admin-Tab "Uhr-Screen".
 *
 * Drag&Drop-Editor fuer die Widgets, die auf dem Display-Uhr-Screen (oder
 * als Schedule-Takeover-Fallback) angezeigt werden.
 *
 * Port von WidgetEditor.jsx + WidgetPalette.jsx + WidgetConfigPanel.jsx
 * aus dem alten React-Frontend. Nutzt GridStack.js (Vendor) statt
 * react-grid-layout.
 *
 * Wichtige API-Aspekte von GridStack ab v11:
 *   - `GridStack.init(opts, container)` initialisiert das Grid.
 *   - `addWidget({ id, x, y, w, h })` fuegt ein Widget hinzu. Inhalt
 *     wird ueber `GridStack.renderCB` erzeugt (siehe initGrid()).
 *   - `grid.on('change', cb)` liefert Aenderungen an Position/Groesse.
 *   - `grid.removeWidget(el, removeDOM = true)` entfernt ein Widget.
 *   - `grid.cellHeight(px)` setzt die Pixelhoehe pro Zeile.
 *
 * Layout-Logik:
 *   - 12 Spalten, 12 Zeilen.
 *   - Preview-Wrapper hat fixed aspect-ratio (16:9 oder 9:16) und reagiert
 *     per ResizeObserver auf Groessenaenderungen. Wir berechnen dann
 *     cellHeight = (height - 11*margin) / 12.
 */

import { configAPI, widgetMediaAPI } from './api.js';
import { renderWidget } from './renderWidget.js';
import { el, clear, showSaveStatus } from './admin.js';

const GRIDSTACK_JS  = '/assets/vendor/gridstack-all.js';
const GRIDSTACK_CSS = '/assets/vendor/gridstack.min.css';

const COLS = 12;
const ROWS = 12;
const MARGIN_PX = 4;

const DEFAULT_CONFIG_BY_TYPE = {
  clock: { fontSize: 160, color: '#f0f0f5', showSeconds: true },
  date:  { fontSize: 42,  color: '#a0a0b0', format: 'long' },
  text:  { text: 'Text', fontSize: 32, color: '#ffffff', fontWeight: '400', textAlign: 'center' },
  image: { src: 'logo', objectFit: 'contain' },
};

const DEFAULT_SIZE_BY_TYPE = {
  clock: { w: 6, h: 2 },
  date:  { w: 6, h: 1 },
  text:  { w: 6, h: 1 },
  image: { w: 4, h: 2 },
};

const WIDGET_TYPES = [
  { type: 'text',  label: 'Text',    icon: 'T' },
  { type: 'clock', label: 'Uhrzeit', icon: '\u{1F550}' },
  { type: 'date',  label: 'Datum',   icon: '\u{1F4C5}' },
  { type: 'image', label: 'Bild',    icon: '\u{1F5BC}' },
];

const TYPE_LABEL = {
  clock: 'Uhrzeit', date: 'Datum', text: 'Text', image: 'Bild / Video',
};

// =========================================================================
// State
// =========================================================================

const state = {
  /** @type {HTMLElement} Root-Container des Tabs */
  root: null,
  /** @type {Array<{i:string,type:string,x:number,y:number,w:number,h:number,config:object}>} */
  widgets: [],
  /** @type {string|null} */
  selectedId: null,
  /** @type {string} */
  bgColor: '#0d0d12',
  /** @type {'landscape'|'portrait'} */
  orientation: 'landscape',
  /** @type {any|null} GridStack-Instanz */
  grid: null,
  /** @type {Map<string, () => void>} Cleanup pro Widget (renderWidget-Intervals) */
  widgetCleanups: new Map(),
  /** @type {ResizeObserver|null} */
  resizeObserver: null,
  /** @type {HTMLElement|null} Wrapper-Element fuer Resize-Beobachtung */
  previewEl: null,
};

// =========================================================================
// Asset-Loader (GridStack einmalig nachladen)
// =========================================================================

let gridstackLoadPromise = null;

function loadGridStack() {
  if (gridstackLoadPromise) return gridstackLoadPromise;
  gridstackLoadPromise = new Promise((resolve, reject) => {
    // CSS
    if (!document.querySelector(`link[href^="${GRIDSTACK_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = GRIDSTACK_CSS;
      document.head.appendChild(link);
    }
    // JS
    if (window.GridStack) { resolve(window.GridStack); return; }
    const script = document.createElement('script');
    script.src = GRIDSTACK_JS;
    script.async = false;
    script.addEventListener('load',  () => resolve(window.GridStack));
    script.addEventListener('error', () => reject(new Error('GridStack konnte nicht geladen werden')));
    document.head.appendChild(script);
  });
  return gridstackLoadPromise;
}

// =========================================================================
// Mount
// =========================================================================

export async function mount(root) {
  state.root = root;
  state.widgetCleanups = new Map();
  state.selectedId = null;
  clear(root);
  root.appendChild(el('div', { className: 'loading', text: 'Lade Uhr-Screen-Editor\u2026' }));

  try {
    const [config, GridStack] = await Promise.all([
      configAPI.get(),
      loadGridStack(),
    ]);
    if (!GridStack) throw new Error('GridStack nicht verfuegbar');

    // GridStack.renderCB einmalig setzen. Wird beim addWidget() aufgerufen,
    // wenn keine `content`-Eigenschaft am Widget gesetzt ist.
    GridStack.renderCB = (gsItemContent, w) => {
      // gsItemContent ist das .grid-stack-item-content-Element. w enthaelt
      // die GridStackWidget-Daten, die wir per addWidget uebergeben haben.
      const widget = w?.welcome?.widgetData;
      if (!widget) return;
      renderCellContent(gsItemContent, widget);
    };

    initStateFromConfig(config);
    clear(root);
    root.appendChild(buildView());
    initGrid();
    populateGrid();
    updateConfigPanel();
  } catch (err) {
    clear(root);
    root.appendChild(el('div', { html: `<h2 style="color:#b00020">Fehler</h2><p>${escapeHtml(err.message || String(err))}</p>` }));
  }
}

function initStateFromConfig(config) {
  const widgets = Array.isArray(config.clockWidgets) ? config.clockWidgets : [];
  state.widgets = widgets.map((w) => ({
    i: String(w.i),
    type: String(w.type),
    x: Number(w.x) || 0,
    y: Number(w.y) || 0,
    w: Number(w.w) || 1,
    h: Number(w.h) || 1,
    config: { ...(w.config || {}) },
  }));
  state.bgColor = config.clockBackground ?? '#0d0d12';
  state.orientation = config.screenOrientation ?? 'landscape';
}

// =========================================================================
// View-Building
// =========================================================================

function buildView() {
  const wrap = el('div', { className: 'widget-editor' });

  // Sidebar (Palette + Config-Panel)
  const sidebar = el('div', { className: 'widget-editor-sidebar' });
  sidebar.appendChild(buildPalette());
  const configPanel = el('div', { className: 'widget-config-panel empty', id: 'widget-config-panel' });
  configPanel.appendChild(el('p', { text: 'Widget ausw\u00e4hlen' }));
  sidebar.appendChild(configPanel);
  wrap.appendChild(sidebar);

  // Main (Preview + Hint + Background + Actions)
  const main = el('div', { className: 'widget-editor-main' });

  const previewWrap = el('div', { className: 'widget-editor-preview-wrap' });
  const aspectRatio = state.orientation === 'portrait' ? '9 / 16' : '16 / 9';
  const previewEl = el('div', {
    className: 'widget-editor-preview' + (state.orientation === 'portrait' ? ' widget-editor-preview-portrait' : ''),
    style: { aspectRatio, background: state.bgColor },
  });
  // GridStack-Container (wird durch initGrid() aktiviert).
  const gridEl = el('div', { className: 'grid-stack', id: 'widget-editor-grid' });
  previewEl.appendChild(gridEl);
  previewWrap.appendChild(previewEl);
  main.appendChild(previewWrap);
  state.previewEl = previewEl;

  // Hint zur Orientierung
  const hint = el('div', { className: 'widget-editor-orientation-hint' });
  hint.innerHTML = `Orientierung: <strong>${state.orientation === 'portrait' ? 'Hochformat (9:16)' : 'Querformat (16:9)'}</strong>
    <span class="widget-editor-orientation-hint-sub">Umschalten unter <em>Einstellungen</em></span>`;
  main.appendChild(hint);

  // Background-Color-Picker
  const bgRow = el('div', { className: 'widget-editor-bg-picker' });
  bgRow.appendChild(el('label', { html: '<strong>Hintergrundfarbe</strong>' }));
  const colorInput = el('input', {
    attrs: { type: 'color', value: state.bgColor },
    on: {
      input: (e) => {
        state.bgColor = e.target.value;
        if (state.previewEl) state.previewEl.style.background = state.bgColor;
      },
    },
  });
  bgRow.appendChild(colorInput);
  main.appendChild(bgRow);

  // Actions
  const actions = el('div', { className: 'widget-editor-actions' });
  const saveBtn = el('button', {
    className: 'widget-editor-save',
    attrs: { type: 'button' },
    text: 'Uhr-Screen speichern',
    on: { click: handleSave },
  });
  saveBtn.id = 'widget-editor-save';
  actions.appendChild(saveBtn);

  const clearBtn = el('button', {
    className: 'widget-editor-clear',
    attrs: { type: 'button' },
    text: 'Alle Widgets entfernen',
    on: { click: handleClearAll },
  });
  clearBtn.id = 'widget-editor-clear';
  if (state.widgets.length === 0) clearBtn.style.display = 'none';
  actions.appendChild(clearBtn);

  actions.appendChild(el('a', {
    className: 'widget-editor-preview-link',
    attrs: { href: '/', target: '_blank', rel: 'noopener noreferrer' },
    text: 'Vorschau \u00f6ffnen',
  }));
  main.appendChild(actions);

  wrap.appendChild(main);
  return wrap;
}

function buildPalette() {
  const palette = el('div', { className: 'widget-palette' });
  palette.appendChild(el('h3', { className: 'widget-palette-title', text: 'Widgets' }));
  palette.appendChild(el('p',  { className: 'widget-palette-hint', text: 'Klicken zum Hinzuf\u00fcgen' }));
  const list = el('div', { className: 'widget-palette-list' });
  for (const t of WIDGET_TYPES) {
    list.appendChild(el('button', {
      className: 'widget-palette-item',
      attrs: { type: 'button' },
      on: { click: () => addWidget(t.type) },
    }, [
      el('span', { className: 'widget-palette-icon', text: t.icon }),
      el('span', { className: 'widget-palette-label', text: t.label }),
    ]));
  }
  palette.appendChild(list);
  return palette;
}

// =========================================================================
// GridStack-Setup
// =========================================================================

function initGrid() {
  const container = document.getElementById('widget-editor-grid');
  if (!container) return;

  const cellH = calcCellHeight();
  state.grid = window.GridStack.init({
    column: COLS,
    cellHeight: cellH,
    margin: MARGIN_PX,
    float: true,
    disableOneColumnMode: true,
    animate: true,
    columnOpts: { breakpoints: [{ w: 1, c: COLS }] },
  }, container);

  state.grid.on('change', (event, items) => {
    if (!Array.isArray(items)) return;
    for (const node of items) {
      const id = String(node.id ?? '');
      const w = state.widgets.find((x) => x.i === id);
      if (!w) continue;
      w.x = Number(node.x);
      w.y = Number(node.y);
      w.w = Number(node.w);
      w.h = Number(node.h);
    }
  });

  // Klick aufs Grid setzt Selektion auf das nearest Widget.
  container.addEventListener('click', (e) => {
    const item = e.target.closest('.grid-stack-item');
    if (!item) return;
    const id = item.getAttribute('gs-id') || item.dataset.gsId;
    if (id) selectWidget(id);
  });

  // ResizeObserver: cellHeight an Preview-Hoehe anpassen.
  if (state.previewEl) {
    state.resizeObserver = new ResizeObserver(() => {
      if (!state.grid) return;
      const h = calcCellHeight();
      if (Number.isFinite(h) && h > 0) {
        state.grid.cellHeight(h);
      }
    });
    state.resizeObserver.observe(state.previewEl);
  }
}

function calcCellHeight() {
  if (!state.previewEl) return 50;
  const h = state.previewEl.clientHeight;
  if (!Number.isFinite(h) || h <= 0) return 50;
  return Math.max(10, (h - (ROWS - 1) * MARGIN_PX) / ROWS);
}

function populateGrid() {
  if (!state.grid) return;
  state.grid.batchUpdate();
  try {
    for (const w of state.widgets) {
      addGridWidget(w);
    }
  } finally {
    state.grid.commit();
  }
  updateClearButton();
}

/**
 * Erzeugt das Inner-Content-Element fuer eine Grid-Cell und ruft renderWidget()
 * auf. Wird sowohl von GridStack.renderCB als auch bei manuellen Refreshes
 * (z. B. nach Config-Aenderung) aufgerufen.
 */
function renderCellContent(gsItemContent, widget) {
  // Cleanup vom vorherigen Inhalt (z. B. setInterval der Uhr).
  const previousCleanup = state.widgetCleanups.get(widget.i);
  if (previousCleanup) {
    try { previousCleanup(); } catch {}
    state.widgetCleanups.delete(widget.i);
  }

  clear(gsItemContent);
  // Optisches Container-Element (Highlight bei Selektion).
  const cell = el('div', {
    className: 'widget-editor-cell' + (state.selectedId === widget.i ? ' selected' : ''),
  });
  const inner = el('div', { className: 'widget-editor-cell-inner' });
  cell.appendChild(inner);

  const { element, cleanup } = renderWidget(widget, { preview: true });
  inner.appendChild(element);
  state.widgetCleanups.set(widget.i, cleanup);

  gsItemContent.appendChild(cell);
}

function addGridWidget(widget) {
  if (!state.grid) return;
  // GridStack 12: renderCB bekommt das ganze Widget-Objekt. Wir verstecken
  // unsere Welcome-spezifischen Daten unter `welcome.widgetData`, damit GS
  // sie unveraendert weiterreicht und unsere Felder nicht ueberschreibt.
  state.grid.addWidget({
    id: widget.i,
    x: widget.x, y: widget.y, w: widget.w, h: widget.h,
    welcome: { widgetData: widget },
  });
}

function refreshGridWidgetContent(widget) {
  if (!state.grid) return;
  const el = getGridItem(widget.i);
  if (!el) return;
  const content = el.querySelector('.grid-stack-item-content');
  if (content) renderCellContent(content, widget);
}

function getGridItem(id) {
  if (!state.grid) return null;
  const all = state.grid.getGridItems ? state.grid.getGridItems() : [];
  for (const node of all) {
    const nid = node.getAttribute?.('gs-id') || node.dataset?.gsId;
    if (String(nid) === String(id)) return node;
  }
  return null;
}

// =========================================================================
// Widget-Aktionen
// =========================================================================

function addWidget(type) {
  const i = generateWidgetId();
  const size = DEFAULT_SIZE_BY_TYPE[type] || { w: 4, h: 2 };
  // Naive Position: ans Ende der bisherigen y-Koordinaten anfuegen.
  const y = state.widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0);
  const widget = {
    i, type,
    x: 0, y, w: size.w, h: size.h,
    config: { ...(DEFAULT_CONFIG_BY_TYPE[type] || {}) },
  };
  state.widgets.push(widget);
  addGridWidget(widget);
  selectWidget(i);
  updateClearButton();
}

function selectWidget(id) {
  if (state.selectedId === id) return;
  const previousId = state.selectedId;
  state.selectedId = id;
  // Cell-Highlight umsetzen (nur Klassennamen-Update, kein Re-Render).
  if (previousId) {
    const prev = getGridItem(previousId);
    prev?.querySelector('.widget-editor-cell')?.classList.remove('selected');
  }
  const next = getGridItem(id);
  next?.querySelector('.widget-editor-cell')?.classList.add('selected');
  updateConfigPanel();
}

function deleteWidget(id) {
  const idx = state.widgets.findIndex((w) => w.i === id);
  if (idx === -1) return;
  state.widgets.splice(idx, 1);
  const item = getGridItem(id);
  if (item && state.grid) state.grid.removeWidget(item, true);
  const cleanup = state.widgetCleanups.get(id);
  if (cleanup) { try { cleanup(); } catch {} state.widgetCleanups.delete(id); }
  if (state.selectedId === id) {
    state.selectedId = null;
    updateConfigPanel();
  }
  updateClearButton();
}

function updateWidgetConfig(id, newConfig) {
  const widget = state.widgets.find((w) => w.i === id);
  if (!widget) return;
  widget.config = newConfig;
  refreshGridWidgetContent(widget);
}

function handleClearAll() {
  if (state.widgets.length === 0) return;
  if (!window.confirm('Alle Widgets entfernen?')) return;
  // Eine Kopie der IDs, weil deleteWidget den Array mutiert.
  for (const id of state.widgets.map((w) => w.i)) {
    deleteWidget(id);
  }
}

function updateClearButton() {
  const btn = document.getElementById('widget-editor-clear');
  if (btn) btn.style.display = state.widgets.length > 0 ? '' : 'none';
}

async function handleSave() {
  const btn = document.getElementById('widget-editor-save');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = 'Speichere\u2026';
  try {
    await configAPI.update({
      clockWidgets: state.widgets,
      clockBackground: state.bgColor,
    });
    showSaveStatus(btn, 'Uhr-Screen gespeichert.', 'success');
  } catch (err) {
    showSaveStatus(btn, err.message || 'Fehler beim Speichern', 'error', 0);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Uhr-Screen speichern';
  }
}

// =========================================================================
// Config-Panel (rechte Sidebar)
// =========================================================================

function updateConfigPanel() {
  const panel = document.getElementById('widget-config-panel');
  if (!panel) return;
  clear(panel);
  panel.classList.remove('empty');

  const widget = state.widgets.find((w) => w.i === state.selectedId);
  if (!widget) {
    panel.classList.add('empty');
    panel.appendChild(el('p', { text: 'Widget ausw\u00e4hlen' }));
    return;
  }

  // Header
  const header = el('div', { className: 'widget-config-header' });
  header.appendChild(el('h3', { text: TYPE_LABEL[widget.type] || widget.type }));
  header.appendChild(el('button', {
    className: 'widget-config-delete',
    attrs: { type: 'button' },
    text: 'Widget entfernen',
    on: { click: () => deleteWidget(widget.i) },
  }));
  panel.appendChild(header);

  // Typ-spezifische Felder
  switch (widget.type) {
    case 'clock': buildClockConfig(panel, widget); break;
    case 'date':  buildDateConfig(panel, widget);  break;
    case 'text':  buildTextConfig(panel, widget);  break;
    case 'image': buildImageConfig(panel, widget); break;
  }
}

function update(widget, updates) {
  updateWidgetConfig(widget.i, { ...widget.config, ...updates });
}

function buildClockConfig(panel, widget) {
  panel.appendChild(rangeField({
    label: 'Schriftgr\u00f6\u00dfe',
    valueLabel: (v) => `${v} px`,
    value: widget.config.fontSize ?? 160,
    min: 80, max: 400, step: 10,
    onChange: (v) => update(widget, { fontSize: v }),
  }));
  panel.appendChild(colorField({
    label: 'Farbe',
    value: widget.config.color ?? '#f0f0f5',
    onChange: (v) => update(widget, { color: v }),
  }));
  panel.appendChild(checkboxField({
    label: 'Sekunden anzeigen',
    checked: widget.config.showSeconds !== false,
    onChange: (v) => update(widget, { showSeconds: v }),
  }));
}

function buildDateConfig(panel, widget) {
  panel.appendChild(rangeField({
    label: 'Schriftgr\u00f6\u00dfe',
    valueLabel: (v) => `${v} px`,
    value: widget.config.fontSize ?? 42,
    min: 20, max: 120, step: 2,
    onChange: (v) => update(widget, { fontSize: v }),
  }));
  panel.appendChild(colorField({
    label: 'Farbe',
    value: widget.config.color ?? '#a0a0b0',
    onChange: (v) => update(widget, { color: v }),
  }));
  panel.appendChild(selectField({
    label: 'Format',
    value: widget.config.format ?? 'long',
    options: [
      { value: 'long',  label: 'Lang (z. B. Montag, 8. Februar 2026)' },
      { value: 'short', label: 'Kurz (TT.MM.JJJJ)' },
    ],
    onChange: (v) => update(widget, { format: v }),
  }));
}

function buildTextConfig(panel, widget) {
  panel.appendChild(textField({
    label: 'Text',
    value: widget.config.text ?? '',
    placeholder: 'Willkommen!',
    onChange: (v) => update(widget, { text: v }),
  }));
  panel.appendChild(rangeField({
    label: 'Schriftgr\u00f6\u00dfe',
    valueLabel: (v) => `${v} px`,
    value: widget.config.fontSize ?? 32,
    min: 12, max: 120, step: 2,
    onChange: (v) => update(widget, { fontSize: v }),
  }));
  panel.appendChild(colorField({
    label: 'Farbe',
    value: widget.config.color ?? '#ffffff',
    onChange: (v) => update(widget, { color: v }),
  }));
  panel.appendChild(selectField({
    label: 'Schriftst\u00e4rke',
    value: widget.config.fontWeight ?? '400',
    options: [
      { value: '300', label: 'Leicht' },
      { value: '400', label: 'Normal' },
      { value: '600', label: 'Halbfett' },
      { value: '700', label: 'Fett' },
    ],
    onChange: (v) => update(widget, { fontWeight: v }),
  }));
  panel.appendChild(selectField({
    label: 'Ausrichtung',
    value: widget.config.textAlign ?? 'center',
    options: [
      { value: 'left',   label: 'Links' },
      { value: 'center', label: 'Zentriert' },
      { value: 'right',  label: 'Rechts' },
    ],
    onChange: (v) => update(widget, { textAlign: v }),
  }));
}

function buildImageConfig(panel, widget) {
  panel.appendChild(el('label', { html: '<strong>Quelle</strong>' }));
  const srcWrap = el('div', { className: 'widget-config-image-src' });

  const logoRadio = el('label', { className: 'widget-config-radio' });
  const logoInput = el('input', {
    attrs: { type: 'radio', name: `img-src-${widget.i}`, value: 'logo', checked: widget.config.src === 'logo' ? true : false },
    on: { change: () => update(widget, { src: 'logo', mediaType: 'image' }) },
  });
  logoRadio.appendChild(logoInput);
  logoRadio.appendChild(el('span', { text: 'Logo' }));
  srcWrap.appendChild(logoRadio);

  const customRadio = el('label', { className: 'widget-config-radio' });
  const customInput = el('input', {
    attrs: {
      type: 'radio',
      name: `img-src-${widget.i}`,
      value: 'custom',
      checked: (widget.config.src && widget.config.src !== 'logo') ? true : false,
    },
    on: { change: () => update(widget, { src: widget.config.src === 'logo' ? '' : widget.config.src }) },
  });
  customRadio.appendChild(customInput);
  customRadio.appendChild(el('span', { text: 'Eigenes Bild / Video' }));
  srcWrap.appendChild(customRadio);
  panel.appendChild(srcWrap);

  // Datei-Upload nur fuer "custom"
  if (widget.config.src !== 'logo') {
    const fileInput = el('input', {
      className: 'widget-config-file-input',
      attrs: { type: 'file', accept: 'image/*,video/mp4,video/webm,video/ogg' },
    });
    panel.appendChild(fileInput);

    const progressWrap = el('div', { className: 'widget-config-upload-progress', style: { display: 'none' } });
    const meta = el('div', { className: 'widget-config-upload-progress-meta' });
    const nameSpan = el('span', { className: 'widget-config-upload-progress-name' });
    const pctSpan  = el('span', { className: 'widget-config-upload-progress-percent', text: '0%' });
    meta.appendChild(nameSpan);
    meta.appendChild(pctSpan);
    const bar = el('div', { className: 'widget-config-upload-progress-bar' });
    const fill = el('div', { className: 'widget-config-upload-progress-bar-fill' });
    bar.appendChild(fill);
    progressWrap.appendChild(meta);
    progressWrap.appendChild(bar);
    panel.appendChild(progressWrap);

    if (widget.config.src && widget.config.src !== 'logo' && widget.config.mediaType === 'video') {
      panel.appendChild(el('span', { className: 'widget-config-media-hint', text: 'Aktuell: Video (stumm, geloopt)' }));
    }

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      progressWrap.style.display = '';
      nameSpan.textContent = file.name;
      pctSpan.textContent = '0%';
      fill.style.width = '0%';
      try {
        const response = await widgetMediaAPI.upload(file, ({ percent }) => {
          pctSpan.textContent = percent + '%';
          fill.style.width = percent + '%';
        });
        const mediaType = response.mediaType || (file.type.startsWith('video/') ? 'video' : 'image');
        update(widget, { src: response.id, mediaType });
        pctSpan.textContent = '100%';
        fill.style.width = '100%';
        // Erfolgsanzeige kurz stehen lassen, dann Panel neu rendern.
        setTimeout(() => { updateConfigPanel(); }, 800);
      } catch (err) {
        pctSpan.textContent = err.message || 'Fehler';
        fill.style.background = '#ef4444';
      }
    });
  }

  panel.appendChild(selectField({
    label: 'Darstellung',
    value: widget.config.objectFit ?? 'contain',
    options: [
      { value: 'contain', label: 'Enthalten (Proportionen)' },
      { value: 'cover',   label: 'Ausf\u00fcllen' },
      { value: 'fill',    label: 'Strecken' },
    ],
    onChange: (v) => update(widget, { objectFit: v }),
  }));
}

// =========================================================================
// Hilfs-Builder fuer Config-Felder
// =========================================================================

function rangeField({ label, valueLabel, value, min, max, step, onChange }) {
  const wrap = document.createDocumentFragment();
  const lbl = el('label');
  lbl.appendChild(el('strong', { text: label }));
  const span = el('span', { className: 'widget-config-value', text: valueLabel(value) });
  lbl.appendChild(span);
  wrap.appendChild(lbl);
  const input = el('input', {
    attrs: { type: 'range', min, max, step, value },
    on: {
      input: (e) => {
        const v = parseInt(e.target.value, 10);
        span.textContent = valueLabel(v);
        onChange(v);
      },
    },
  });
  wrap.appendChild(input);
  const container = el('div');
  container.appendChild(wrap);
  return container;
}

function colorField({ label, value, onChange }) {
  const container = el('div');
  container.appendChild(el('label', { html: `<strong>${escapeHtml(label)}</strong>` }));
  container.appendChild(el('input', {
    attrs: { type: 'color', value },
    on: { input: (e) => onChange(e.target.value) },
  }));
  return container;
}

function textField({ label, value, placeholder, onChange }) {
  const container = el('div');
  container.appendChild(el('label', { html: `<strong>${escapeHtml(label)}</strong>` }));
  container.appendChild(el('input', {
    attrs: { type: 'text', value, placeholder: placeholder || '' },
    on: { input: (e) => onChange(e.target.value) },
  }));
  return container;
}

function selectField({ label, value, options, onChange }) {
  const container = el('div');
  container.appendChild(el('label', { html: `<strong>${escapeHtml(label)}</strong>` }));
  const select = el('select', {
    on: { change: (e) => onChange(e.target.value) },
  });
  for (const opt of options) {
    const o = el('option', { attrs: { value: opt.value }, text: opt.label });
    if (opt.value === value) o.selected = true;
    select.appendChild(o);
  }
  container.appendChild(select);
  return container;
}

function checkboxField({ label, checked, onChange }) {
  const container = el('div');
  const lbl = el('label', { className: 'widget-config-check' });
  const input = el('input', {
    attrs: { type: 'checkbox', checked: checked ? true : false },
    on: { change: (e) => onChange(e.target.checked) },
  });
  lbl.appendChild(input);
  lbl.appendChild(document.createTextNode(' ' + label));
  container.appendChild(lbl);
  return container;
}

// =========================================================================
// Helpers
// =========================================================================

function generateWidgetId() {
  return 'widget-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
