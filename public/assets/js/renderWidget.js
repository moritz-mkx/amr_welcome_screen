/**
 * Widget-Renderer.
 *
 * Liefert ein DOM-Element fuer ein Widget-Objekt (Clock, Date, Text, Image).
 * Wird sowohl vom Display (Etappe 3) als auch vom Admin-Editor (Etappe 5)
 * verwendet, damit Vorschau und Anzeige nicht auseinanderlaufen.
 *
 * Schema des `widget`-Parameters (1:1 zur Node/React-Variante):
 *   { i: string, type: 'clock'|'date'|'text'|'image',
 *     x: int, y: int, w: int, h: int,
 *     config: object }
 *
 * Aufrufende Seite kuemmert sich um Positionierung (Grid-Cell). Hier wird
 * nur der Inhalt erzeugt.
 *
 * Bei Widgets mit "Liveness" (Clock, Date) startet der Renderer einen
 * setInterval. Damit das beim Re-Render nicht leakt, gibt der Renderer
 * eine Cleanup-Funktion zurueck:
 *
 *   const { element, cleanup } = renderWidget(widget);
 *   container.appendChild(element);
 *   // ... spaeter:
 *   cleanup();
 *
 * Sub-Module:
 *   - widgetClock, widgetDate, widgetText, widgetImage
 */

import { configAPI, widgetMediaAPI } from './api.js';

const PREVIEW_SCALE = 0.22;
function previewFontSize(size, preview) {
  if (!preview) return size;
  return Math.max(9, Math.round(size * PREVIEW_SCALE));
}

function formatTime(date, showSeconds) {
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12: false,
  });
}

function formatDate(date, format) {
  if (format === 'short') {
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function renderClock({ config = {}, preview }) {
  const el = document.createElement('div');
  el.className = 'grid-widget-clock';
  el.style.fontSize = previewFontSize(config.fontSize ?? 160, preview) + 'px';
  el.style.color = config.color ?? '#f0f0f5';
  const showSeconds = config.showSeconds !== false;
  const update = () => { el.textContent = formatTime(new Date(), showSeconds); };
  update();
  const intervalId = setInterval(update, 1000);
  return { element: el, cleanup: () => clearInterval(intervalId) };
}

function renderDate({ config = {}, preview }) {
  const el = document.createElement('div');
  el.className = 'grid-widget-date';
  el.style.fontSize = previewFontSize(config.fontSize ?? 42, preview) + 'px';
  el.style.color = config.color ?? '#a0a0b0';
  const format = config.format ?? 'long';
  const update = () => { el.textContent = formatDate(new Date(), format); };
  update();
  // Minuetlich genug; Datum aendert sich nur taeglich.
  const intervalId = setInterval(update, 60000);
  return { element: el, cleanup: () => clearInterval(intervalId) };
}

function renderText({ config = {}, preview }) {
  const el = document.createElement('div');
  el.className = 'grid-widget-text';
  el.style.fontSize = previewFontSize(config.fontSize ?? 32, preview) + 'px';
  el.style.color = config.color ?? '#ffffff';
  el.style.fontWeight = config.fontWeight ?? '400';
  el.style.textAlign = config.textAlign ?? 'center';
  el.textContent = (config.text ?? '') || 'Text';
  return { element: el, cleanup: () => {} };
}

function renderImage({ config = {} }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'grid-widget-image';

  const src = config.src;
  if (!src) {
    wrapper.classList.add('grid-widget-image-placeholder');
    wrapper.textContent = 'Bild / Video (Quelle waehlen)';
    return { element: wrapper, cleanup: () => {} };
  }

  const url = src === 'logo'
    ? configAPI.getLogoUrl()
    : widgetMediaAPI.getUrl(src);
  const objectFit = config.objectFit ?? 'contain';
  const isVideo = config.mediaType === 'video';

  let media;
  if (isVideo) {
    media = document.createElement('video');
    media.src = url;
    media.muted = true;
    media.autoplay = true;
    media.loop = true;
    media.playsInline = true;
    media.preload = 'auto';
    media.style.objectFit = objectFit;
  } else {
    media = document.createElement('img');
    media.src = url;
    media.alt = '';
    media.style.objectFit = objectFit;
  }

  const errorEl = document.createElement('div');
  errorEl.className = 'grid-widget-image-error';
  errorEl.textContent = isVideo ? 'Video nicht geladen' : 'Bild nicht geladen';
  errorEl.style.display = 'none';

  media.addEventListener('error', () => { errorEl.style.display = 'block'; });
  media.addEventListener(isVideo ? 'loadeddata' : 'load', () => { errorEl.style.display = 'none'; });

  wrapper.appendChild(media);
  wrapper.appendChild(errorEl);
  return { element: wrapper, cleanup: () => {} };
}

/**
 * Erzeugt das DOM-Element fuer ein Widget.
 *
 * @param {object} widget   { i, type, x, y, w, h, config }
 * @param {object} [opts]
 * @param {boolean} [opts.preview]  Editor-Vorschau (Schriften skaliert klein).
 * @returns {{element: HTMLElement, cleanup: () => void}}
 */
export function renderWidget(widget, opts = {}) {
  const preview = !!opts.preview;
  switch (widget?.type) {
    case 'clock': return renderClock({ config: widget.config, preview });
    case 'date':  return renderDate({ config: widget.config, preview });
    case 'text':  return renderText({ config: widget.config, preview });
    case 'image': return renderImage({ config: widget.config });
    default: {
      const el = document.createElement('div');
      el.className = 'grid-widget-unknown';
      el.textContent = 'Unbekannt: ' + (widget?.type ?? '');
      return { element: el, cleanup: () => {} };
    }
  }
}
