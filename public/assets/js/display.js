/**
 * Display-Logik fuer die Slideshow / den Uhr-Screen / die Einrichtungs-Hilfe.
 *
 * Port der React-Komponenten Slideshow.jsx, SlideItem.jsx, ClockScreen.jsx
 * und SetupGuide.jsx zu Vanilla JS.
 *
 * Verhalten:
 *   - Datenladen via fileAPI.getAll() + configAPI.get() alle 30 s
 *   - Active-Schedule via scheduleAPI.getActive()        alle 15 s
 *   - View-Routing:
 *       loading -> Spinner
 *       active-schedule -> Schedule-Takeover (eine Datei, Video loop)
 *       files vorhanden -> Slideshow mit Fade-Uebergaengen
 *       leer + emptyScreenMode=clock -> ClockScreen mit konfigurierten Widgets
 *       leer + emptyScreenMode=setup -> SetupGuide mit IP-Anzeige
 *   - Bei Videos in der Slideshow: Wechsel ueber `ended`-Event (kein Timer).
 *
 * Wichtige Property der `state`-Maschine: render() rendert nur dann neu,
 * wenn sich entweder die View oder der `viewKey` (Hash der angezeigten
 * Daten) geaendert hat. Damit wird die Slideshow nicht bei jedem Poll
 * zurueckgesetzt.
 */

import { fileAPI, configAPI, scheduleAPI, systemAPI } from './api.js';
import { renderWidget } from './renderWidget.js';

const root = document.getElementById('display-root');
if (!root) {
  throw new Error('Kein #display-root im DOM gefunden');
}

const DEFAULT_WIDGETS = [
  { i: 'widget-logo',  type: 'image', x: 4, y: 1, w: 4, h: 2, config: { src: 'logo', objectFit: 'contain' } },
  { i: 'widget-clock', type: 'clock', x: 3, y: 4, w: 6, h: 2, config: { fontSize: 160, color: '#f0f0f5', showSeconds: true } },
  { i: 'widget-date',  type: 'date',  x: 3, y: 7, w: 6, h: 1, config: { fontSize: 42,  color: '#a0a0b0', format: 'long' } },
];

const state = {
  files: [],
  config: {
    slideInterval: 5000,
    transitionDuration: 1000,
    emptyScreenMode: 'setup',
  },
  activeSchedule: null,
  loading: true,

  // Interner Renderer-State:
  view: null,
  viewKey: '',
  slideshowCurrentIndex: 0,
  slideshowTimer: null,
  widgetCleanups: [],
  setupIpTimer: null,
};

// =========================================================================
// View-Renderer (jeweils komplettes innerHTML/Append fuer #display-root)
// =========================================================================

function renderLoadingView() {
  root.innerHTML = '';
  const c = document.createElement('div');
  c.className = 'slideshow-container loading';
  const s = document.createElement('div');
  s.className = 'loading-spinner';
  s.textContent = 'Lade...';
  c.appendChild(s);
  root.appendChild(c);
}

function renderSetupGuide() {
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'setup-guide';
  wrap.innerHTML = `
    <div class="setup-guide-content">
      <h1>Welcome Screen \u2013 Einrichtung</h1>
      <p class="setup-intro">Es sind noch keine Bilder hinterlegt. So richten Sie das System ein:</p>
      <ol class="setup-steps">
        <li>Stellen Sie eine Verbindung zum gleichen WLAN wie dieser Raspberry Pi her.</li>
        <li>\u00d6ffnen Sie in einem Browser auf Ihrem Ger\u00e4t die Admin-Oberfl\u00e4che.</li>
        <li>Laden Sie Bilder oder PDFs hoch und speichern Sie die Einstellungen.</li>
        <li>Die Diashow startet automatisch, sobald Dateien vorhanden sind.</li>
      </ol>
      <div class="setup-ip-box setup-ip-wait" id="setup-ip-box">
        <span class="setup-ip-label">Warten auf Netzwerkverbindung\u2026</span>
        <span class="setup-ip-hint">Sobald der Pi mit dem Netzwerk verbunden ist, erscheint hier die Adresse.</span>
      </div>
      <p class="setup-footer">In den Einstellungen k\u00f6nnen Sie sp\u00e4ter w\u00e4hlen, stattdessen eine Uhr-Anzeige anzuzeigen.</p>
    </div>
  `;
  root.appendChild(wrap);

  // IP regelmaessig nachschauen.
  updateSetupIp();
  state.setupIpTimer = setInterval(updateSetupIp, 10000);
}

async function updateSetupIp() {
  const box = document.getElementById('setup-ip-box');
  if (!box) return;
  try {
    const data = await systemAPI.getIP();
    if (data && Array.isArray(data.ips) && data.ips.length > 0) {
      const url = `http://${data.ips[0]}/admin.php`;
      box.classList.remove('setup-ip-wait');
      box.innerHTML = `
        <span class="setup-ip-label">Admin-Oberfl\u00e4che im Browser \u00f6ffnen:</span>
        <a href="${url}" class="setup-ip-link" rel="noopener noreferrer">${url}</a>
        <span class="setup-ip-hint">IP-Adresse(n) dieses Ger\u00e4ts: ${data.ips.join(', ')}</span>
      `;
    }
    // Wenn keine IP da: Box bleibt im Warte-Zustand.
  } catch (err) {
    // Stillschweigend ignorieren - der naechste Tick versucht es wieder.
  }
}

function renderClockScreen(config) {
  root.innerHTML = '';
  const orientation = config.screenOrientation ?? 'landscape';
  const widgets = (Array.isArray(config.clockWidgets) && config.clockWidgets.length > 0)
    ? config.clockWidgets
    : DEFAULT_WIDGETS;

  const screen = document.createElement('div');
  screen.className = 'clock-screen clock-screen-grid'
    + (orientation === 'portrait' ? ' clock-screen-portrait' : '');
  screen.style.background = config.clockBackground ?? '#0d0d12';

  state.widgetCleanups = [];
  for (const widget of widgets) {
    const cell = document.createElement('div');
    cell.className = 'clock-screen-cell';
    cell.style.gridColumn = `${widget.x + 1} / span ${widget.w}`;
    cell.style.gridRow    = `${widget.y + 1} / span ${widget.h}`;

    const inner = document.createElement('div');
    inner.className = 'clock-screen-cell-inner';
    const { element, cleanup } = renderWidget(widget);
    inner.appendChild(element);
    cell.appendChild(inner);
    screen.appendChild(cell);
    state.widgetCleanups.push(cleanup);
  }
  root.appendChild(screen);
}

function createSlideElement(file, transitionMs, isActive, isLooping) {
  const slide = document.createElement('div');
  slide.className = 'slide-item' + (isActive ? ' active' : '');
  slide.style.transition = `opacity ${transitionMs}ms ease-in-out`;

  if (file.type === 'video') {
    const video = document.createElement('video');
    video.src = file.url;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.className = 'slide-video';
    if (isLooping) video.loop = true;
    video.addEventListener('error', () => {
      console.error('[display] Video-Ladefehler:', file.originalName);
    });
    slide.appendChild(video);
  } else {
    const img = document.createElement('img');
    img.src = file.displayUrl || file.url;
    img.alt = file.originalName || '';
    img.className = 'slide-image';
    img.addEventListener('error', () => {
      console.error('[display] Bild-Ladefehler:', file.originalName);
      img.style.display = 'none';
    });
    slide.appendChild(img);
  }
  return slide;
}

function renderSlideshow(files, config) {
  root.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'slideshow-container';
  const transitionMs = config.transitionDuration || 1000;

  files.forEach((file, i) => {
    container.appendChild(createSlideElement(file, transitionMs, i === 0, false));
  });
  root.appendChild(container);

  state.slideshowCurrentIndex = 0;
  attachVideoEndedHandlers();
  // Erstes Slide aktivieren (Video starten falls noetig)
  activateSlide(0);
  scheduleNextSlide();
}

function attachVideoEndedHandlers() {
  const container = document.querySelector('.slideshow-container');
  if (!container) return;
  container.querySelectorAll('.slide-item video').forEach((video) => {
    video.addEventListener('ended', () => {
      const slide = video.closest('.slide-item');
      if (slide && slide.classList.contains('active')) {
        advanceSlideshow();
      }
    });
  });
}

function scheduleNextSlide() {
  if (state.slideshowTimer) {
    clearTimeout(state.slideshowTimer);
    state.slideshowTimer = null;
  }
  const visibleFiles = currentVisibleFiles();
  if (visibleFiles.length === 0) return;
  const current = visibleFiles[state.slideshowCurrentIndex];
  // Bei Videos: kein Timer - Wechsel erfolgt durch `ended`-Event.
  if (current?.type === 'video') return;
  const ms = state.config.slideInterval || 5000;
  state.slideshowTimer = setTimeout(advanceSlideshow, ms);
}

function advanceSlideshow() {
  const files = currentVisibleFiles();
  if (files.length === 0) return;
  const next = (state.slideshowCurrentIndex + 1) % files.length;
  activateSlide(next);
  scheduleNextSlide();
}

function activateSlide(index) {
  state.slideshowCurrentIndex = index;
  const container = document.querySelector('.slideshow-container');
  if (!container) return;
  const slides = container.querySelectorAll('.slide-item');
  slides.forEach((s, i) => {
    const video = s.querySelector('video');
    if (i === index) {
      s.classList.add('active');
      if (video) playVideoSafely(video);
    } else {
      s.classList.remove('active');
      if (video && !video.paused) video.pause();
    }
  });
}

function playVideoSafely(video) {
  try {
    if (video.readyState >= 1) {
      try { video.currentTime = 0; } catch (e) { /* InvalidStateError ignorieren */ }
    }
    const p = video.play();
    if (p && typeof p.catch === 'function') {
      p.catch((err) => console.warn('[display] Video-Autoplay verzoegert:', err));
    }
  } catch (err) {
    console.warn('[display] video.play() fehlgeschlagen:', err);
  }
}

function renderScheduleTakeover(scheduleData, config) {
  root.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'slideshow-container';
  const transitionMs = config.transitionDuration || 1000;
  const slide = createSlideElement(scheduleData.file, transitionMs, true, true /* loop */);
  container.appendChild(slide);
  root.appendChild(container);
  // Bei Bildern: kein Timer (das eine Slide bleibt sichtbar). Bei Videos:
  // loop=true (siehe createSlideElement).
}

// =========================================================================
// View-Routing
// =========================================================================

function currentVisibleFiles() {
  return state.files.filter(f => !f.hidden);
}

function chooseView() {
  if (state.loading) return 'loading';
  if (state.activeSchedule && state.activeSchedule.file) return 'schedule';
  if (currentVisibleFiles().length > 0) return 'slideshow';
  return state.config.emptyScreenMode === 'clock' ? 'clock' : 'setup';
}

/**
 * Identifiziert die "Daten", die in der aktuellen View dargestellt werden.
 * Aendert sich nichts an diesem Schluessel, wird auch nicht neu gerendert
 * (verhindert Slideshow-Resets bei jedem Poll-Tick).
 */
function viewKey(view) {
  switch (view) {
    case 'loading': return 'loading';
    case 'schedule': {
      const s = state.activeSchedule.schedule;
      const f = state.activeSchedule.file;
      return `schedule|${s.id}|${f.id}|${state.config.transitionDuration}`;
    }
    case 'slideshow': {
      const ids = currentVisibleFiles().map(f => `${f.id}:${f.type}`).join(',');
      return `slideshow|${ids}|${state.config.slideInterval}|${state.config.transitionDuration}`;
    }
    case 'clock': {
      return 'clock|'
        + JSON.stringify(state.config.clockWidgets || []) + '|'
        + (state.config.clockBackground ?? '') + '|'
        + (state.config.screenOrientation ?? '');
    }
    case 'setup': return 'setup';
    default:      return 'unknown';
  }
}

function cleanupBeforeViewChange() {
  if (state.slideshowTimer) {
    clearTimeout(state.slideshowTimer);
    state.slideshowTimer = null;
  }
  if (Array.isArray(state.widgetCleanups)) {
    state.widgetCleanups.forEach(fn => { try { fn(); } catch {} });
    state.widgetCleanups = [];
  }
  if (state.setupIpTimer) {
    clearInterval(state.setupIpTimer);
    state.setupIpTimer = null;
  }
}

function render() {
  const view = chooseView();
  const key = viewKey(view);
  if (view === state.view && key === state.viewKey) return;
  cleanupBeforeViewChange();
  state.view = view;
  state.viewKey = key;
  switch (view) {
    case 'loading':   renderLoadingView(); break;
    case 'schedule':  renderScheduleTakeover(state.activeSchedule, state.config); break;
    case 'slideshow': renderSlideshow(currentVisibleFiles(), state.config); break;
    case 'clock':     renderClockScreen(state.config); break;
    case 'setup':     renderSetupGuide(); break;
  }
}

// =========================================================================
// Polling
// =========================================================================

async function loadData() {
  try {
    const [files, config] = await Promise.all([fileAPI.getAll(), configAPI.get()]);
    state.files  = Array.isArray(files) ? files : [];
    state.config = (config && typeof config === 'object') ? config : state.config;
  } catch (err) {
    console.error('[display] Datenladen fehlgeschlagen:', err);
  } finally {
    state.loading = false;
    render();
  }
}

async function loadActiveSchedule() {
  try {
    const data = await scheduleAPI.getActive();
    state.activeSchedule = (data && data.schedule && data.file) ? data : null;
  } catch (err) {
    console.error('[display] active-schedule fehlgeschlagen:', err);
    state.activeSchedule = null;
  }
  render();
}

// =========================================================================
// Start
// =========================================================================

renderLoadingView();
loadData();
loadActiveSchedule();
setInterval(loadData,           30000);
setInterval(loadActiveSchedule, 15000);
