/**
 * Admin-Tab "Einstellungen".
 *
 * Port von Settings.jsx aus dem alten Frontend.
 *
 * Felder:
 *  - Bildschirm-Orientierung (landscape / portrait)
 *  - Anzeige bei leerem Bildschirm (setup / clock)
 *  - Slide-Intervall in ms (1000-60000)
 *  - Uebergangsdauer in ms (0-3000)
 *
 * Zusaetzlich (im alten React-Code definiert, aber in der UI nie exponiert):
 *  - Logo-Upload (Bild bis 5 MB) - landet als /media/static/logo.<ext>
 */

import { configAPI } from './api.js';
import { el, formatTime, showSaveStatus, clear } from './admin.js';

export async function mount(root) {
  clear(root);
  root.appendChild(el('div', { className: 'loading', text: 'Lade Einstellungen\u2026' }));
  let config;
  try {
    config = await configAPI.get();
  } catch (err) {
    clear(root);
    root.appendChild(el('div', { html: `<h2 style="color:#b00020">Fehler</h2><p>${err.message || err}</p>` }));
    return;
  }
  clear(root);
  root.appendChild(buildView(config));
}

function buildView(config) {
  const wrap = el('div', { className: 'settings' });
  wrap.appendChild(el('h2', { text: 'Einstellungen' }));
  const group = el('div', { className: 'settings-group' });
  wrap.appendChild(group);

  // --- Orientation ---
  let screenOrientation = config.screenOrientation || 'landscape';
  group.appendChild(buildRadioGroupSetting({
    title: 'Bildschirm-Orientierung',
    description: 'Legt fest, ob der Bildschirm im Quer- oder Hochformat betrieben wird. '
      + 'Das Grid im Uhr-Screen passt sich entsprechend an.',
    name: 'screenOrientation',
    value: screenOrientation,
    options: [
      { value: 'landscape', label: 'Querformat (16:9)' },
      { value: 'portrait',  label: 'Hochformat (9:16)' },
    ],
    onChange: (v) => { screenOrientation = v; },
  }));

  // --- emptyScreenMode ---
  let emptyScreenMode = config.emptyScreenMode || 'setup';
  group.appendChild(buildRadioGroupSetting({
    title: 'Anzeige bei leerem Bildschirm',
    description: 'Wenn noch keine Bilder hochgeladen wurden (oder Sie diese Option nutzen m\u00f6chten):',
    name: 'emptyScreenMode',
    value: emptyScreenMode,
    options: [
      { value: 'setup', label: 'Einrichtungs-Anleitung anzeigen' },
      { value: 'clock', label: 'Uhr und Datum anzeigen' },
    ],
    onChange: (v) => { emptyScreenMode = v; },
    afterNote: 'Layout der Uhr-Anzeige (Logo, Uhrzeit, Datum, Text, Bilder) konfigurieren Sie im Tab Uhr-Screen.',
  }));

  // --- slideInterval ---
  let slideInterval = Number(config.slideInterval) || 5000;
  const slideSetting = buildRangeSetting({
    title: 'Zeitintervall zwischen Slides',
    description: 'Wie lange jedes Bild angezeigt wird, bevor zum n\u00e4chsten gewechselt wird.',
    id: 'slideInterval',
    min: 1000, max: 60000, step: 500,
    value: slideInterval,
    minLabel: '1 Sekunde', maxLabel: '60 Sekunden',
    onChange: (v) => { slideInterval = v; },
  });
  group.appendChild(slideSetting);

  // --- transitionDuration ---
  let transitionDuration = Number(config.transitionDuration) || 1000;
  const transitionSetting = buildRangeSetting({
    title: '\u00dcbergangsdauer',
    description: 'Dauer des Fade-\u00dcbergangs zwischen den Slides.',
    id: 'transitionDuration',
    min: 0, max: 3000, step: 100,
    value: transitionDuration,
    minLabel: '0 ms', maxLabel: '3 Sekunden',
    onChange: (v) => { transitionDuration = v; },
  });
  group.appendChild(transitionSetting);

  // --- Logo-Upload ---
  group.appendChild(buildLogoSetting());

  // --- Speichern-Button ---
  const actions = el('div', { className: 'settings-actions' });
  const saveBtn = el('button', {
    className: 'save-button',
    attrs: { type: 'button' },
    text: 'Einstellungen speichern',
    on: {
      click: async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Speichere\u2026';
        try {
          await configAPI.update({
            screenOrientation,
            emptyScreenMode,
            slideInterval:      parseInt(slideInterval, 10),
            transitionDuration: parseInt(transitionDuration, 10),
          });
          showSaveStatus(saveBtn, 'Einstellungen gespeichert.', 'success');
        } catch (err) {
          showSaveStatus(saveBtn, err.message || 'Fehler beim Speichern', 'error', 0);
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Einstellungen speichern';
        }
      },
    },
  });
  actions.appendChild(saveBtn);
  wrap.appendChild(actions);

  return wrap;
}

// =========================================================================
// Hilfs-Builder
// =========================================================================

function buildRadioGroupSetting({ title, description, name, value, options, onChange, afterNote }) {
  const item = el('div', { className: 'setting-item' });
  item.appendChild(el('label', { html: `<strong>${escapeHtml(title)}</strong>` }));
  if (description) item.appendChild(el('p', { className: 'setting-description', text: description }));

  const radios = el('div', { className: 'setting-radio-group' });
  for (const opt of options) {
    const lbl = el('label', { className: 'setting-radio' });
    const input = el('input', {
      attrs: { type: 'radio', name, value: opt.value, checked: opt.value === value ? true : false },
      on: { change: (e) => { if (e.target.checked) onChange(opt.value); } },
    });
    lbl.appendChild(input);
    lbl.appendChild(el('span', { text: opt.label }));
    radios.appendChild(lbl);
  }
  item.appendChild(radios);
  if (afterNote) item.appendChild(el('p', { className: 'setting-description', html: afterNote.replace('Uhr-Screen', '<strong>Uhr-Screen</strong>') }));
  return item;
}

function buildRangeSetting({ title, description, id, min, max, step, value, minLabel, maxLabel, onChange }) {
  const item = el('div', { className: 'setting-item' });
  const lbl = el('label', { attrs: { for: id } });
  lbl.appendChild(el('strong', { text: title }));
  const valSpan = el('span', { className: 'setting-value', text: formatTime(value) });
  lbl.appendChild(valSpan);
  item.appendChild(lbl);

  const input = el('input', {
    id,
    attrs: { type: 'range', min, max, step, value },
    on: {
      input: (e) => {
        const v = Number(e.target.value);
        valSpan.textContent = formatTime(v);
        onChange(v);
      },
    },
  });
  item.appendChild(input);
  const labels = el('div', { className: 'setting-range-labels' });
  labels.appendChild(el('span', { text: minLabel }));
  labels.appendChild(el('span', { text: maxLabel }));
  item.appendChild(labels);
  if (description) item.appendChild(el('p', { className: 'setting-description', text: description }));
  return item;
}

function buildLogoSetting() {
  const item = el('div', { className: 'setting-item' });
  item.appendChild(el('label', { html: '<strong>Logo</strong>' }));
  item.appendChild(el('p', {
    className: 'setting-description',
    text: 'Wird im Uhr-Screen \u00fcber das Logo-Widget angezeigt. Empfohlene Gr\u00f6\u00dfe: bis 200x80 px, max. 5 MB.',
  }));

  const preview = el('div', { className: 'setting-logo-preview' });
  refreshLogoPreview(preview);

  const fileInput = el('input', {
    className: 'setting-logo-input',
    attrs: { type: 'file', accept: 'image/*' },
  });
  const status = el('span', { className: 'setting-logo-status' });
  const uploadBtn = el('button', {
    className: 'save-button',
    style: { padding: '8px 16px', fontSize: '14px' },
    attrs: { type: 'button' },
    text: 'Logo hochladen',
    on: {
      click: async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) {
          status.textContent = 'Bitte Datei ausw\u00e4hlen.';
          status.style.color = '#b00020';
          return;
        }
        uploadBtn.disabled = true;
        status.style.color = '#666';
        status.textContent = 'L\u00e4dt hoch\u2026';
        try {
          await configAPI.uploadLogo(file);
          status.style.color = '#16a34a';
          status.textContent = 'Logo aktualisiert.';
          fileInput.value = '';
          refreshLogoPreview(preview);
        } catch (err) {
          status.style.color = '#b00020';
          status.textContent = err.message || 'Fehler beim Hochladen';
        } finally {
          uploadBtn.disabled = false;
        }
      },
    },
  });

  const row = el('div', { className: 'setting-logo-row' });
  row.appendChild(fileInput);
  row.appendChild(uploadBtn);
  row.appendChild(status);
  item.appendChild(row);
  item.appendChild(preview);
  return item;
}

function refreshLogoPreview(container) {
  clear(container);
  const buster = Date.now();
  const img = el('img', {
    className: 'setting-logo-img',
    attrs: { src: configAPI.getLogoUrl() + '?v=' + buster, alt: 'Logo' },
  });
  img.addEventListener('error', () => { img.style.display = 'none'; });
  container.appendChild(img);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
