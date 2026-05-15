/**
 * Admin-Tab "Planung".
 *
 * Port von ScheduleManager.jsx aus dem alten Frontend. Funktional 1:1:
 *  - Liste vorhandener Plaene mit Pausieren/Bearbeiten/Loeschen
 *  - Formular zum Anlegen/Bearbeiten eines Plans
 *  - 7-Tage-Vorschau mit den jeweils aktiven Plaenen
 *
 * Schema (aus lib/schedules.php):
 *   { id, name, fileId, startTime, durationMinutes, enabled,
 *     recurrence: { type: 'once'|'daily'|'weekly',
 *                   startDate, endDate, interval, weekdays? },
 *     createdAt }
 */

import { scheduleAPI, fileAPI, ApiError } from './api.js';
import { el, clear } from './admin.js';

const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WEEKDAY_ORDER_MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

// =========================================================================
// Mount
// =========================================================================

const state = {
  files: [],
  schedules: [],
  form: emptyForm(),
  editingId: null,
  error: '',
  root: null,
};

export async function mount(root) {
  state.root = root;
  state.form = emptyForm();
  state.editingId = null;
  state.error = '';
  clear(root);
  root.appendChild(el('div', { className: 'loading', text: 'Lade Pl\u00e4ne\u2026' }));
  try {
    const [files, schedules] = await Promise.all([fileAPI.getAll(), scheduleAPI.getAll()]);
    state.files = Array.isArray(files) ? files : [];
    state.schedules = Array.isArray(schedules) ? schedules : [];
  } catch (err) {
    clear(root);
    root.appendChild(el('div', { html: `<h2 style="color:#b00020">Fehler</h2><p>${err.message || err}</p>` }));
    return;
  }
  rerender();
}

function rerender() {
  if (!state.root) return;
  clear(state.root);
  state.root.appendChild(buildView());
}

// =========================================================================
// View
// =========================================================================

function buildView() {
  const wrap = el('div', { className: 'schedule-manager' });
  wrap.appendChild(el('h2', { text: 'Anzeige planen' }));
  wrap.appendChild(el('p', {
    className: 'hint',
    text: 'Lege fest, dass eine bestimmte Datei zu einer geplanten Zeit exklusiv angezeigt wird. '
        + 'W\u00e4hrend des Zeitfensters pausiert die normale Slideshow.',
  }));

  const layout = el('div', { className: 'schedule-layout' });
  layout.appendChild(buildFormSection());
  layout.appendChild(buildListSection());
  wrap.appendChild(layout);

  wrap.appendChild(buildWeekOverview());
  return wrap;
}

// =========================================================================
// Formular
// =========================================================================

function buildFormSection() {
  const section = el('section', { className: 'schedule-form-section' });
  section.appendChild(el('h3', { text: state.editingId ? 'Plan bearbeiten' : 'Neuen Plan erstellen' }));

  const form = el('form', { className: 'schedule-form' });
  form.addEventListener('submit', handleSubmit);

  // Name
  form.appendChild(labelInput('Name (optional)', {
    attrs: { type: 'text', value: state.form.name, placeholder: 'z. B. Begr\u00fc\u00dfung Morgenmeeting' },
    on: { input: (e) => { state.form.name = e.target.value; } },
  }));

  // Datei-Select
  const selectLabel = el('label');
  selectLabel.appendChild(el('span', { text: 'Datei' }));
  const select = el('select', { attrs: { required: true } });
  select.appendChild(el('option', { attrs: { value: '' }, text: '\u2013 bitte w\u00e4hlen \u2013' }));
  for (const f of state.files) {
    const opt = el('option', { attrs: { value: f.id }, text: `${f.originalName || f.filename} (${f.type})` });
    if (state.form.fileId === f.id) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener('change', (e) => { state.form.fileId = e.target.value; });
  selectLabel.appendChild(select);
  form.appendChild(selectLabel);

  // Startzeit + Dauer
  const row1 = el('div', { className: 'row' });
  row1.appendChild(labelInput('Startzeit', {
    attrs: { type: 'time', value: state.form.startTime, required: true },
    on: { input: (e) => { state.form.startTime = e.target.value; } },
  }));
  row1.appendChild(labelInput('Dauer (Minuten)', {
    attrs: { type: 'number', min: '1', value: String(state.form.durationMinutes), required: true },
    on: { input: (e) => { state.form.durationMinutes = e.target.value; } },
  }));
  form.appendChild(row1);

  // Wiederholungstyp
  const recurrenceLabel = el('label');
  recurrenceLabel.appendChild(el('span', { text: 'Wiederholung' }));
  const recurrenceSelect = el('select');
  for (const opt of [
    { value: 'once',   label: 'Einmalig' },
    { value: 'daily',  label: 'T\u00e4glich' },
    { value: 'weekly', label: 'W\u00f6chentlich' },
  ]) {
    const o = el('option', { attrs: { value: opt.value }, text: opt.label });
    if (state.form.recurrence.type === opt.value) o.selected = true;
    recurrenceSelect.appendChild(o);
  }
  recurrenceSelect.addEventListener('change', (e) => {
    state.form.recurrence.type = e.target.value;
    rerender(); // Form-Felder unter recurrence aendern sich
  });
  recurrenceLabel.appendChild(recurrenceSelect);
  form.appendChild(recurrenceLabel);

  // Start-/Enddatum
  const row2 = el('div', { className: 'row' });
  row2.appendChild(labelInput('Startdatum', {
    attrs: { type: 'date', value: state.form.recurrence.startDate, required: true },
    on: { input: (e) => { state.form.recurrence.startDate = e.target.value; } },
  }));
  if (state.form.recurrence.type !== 'once') {
    row2.appendChild(labelInput('Enddatum (optional)', {
      attrs: { type: 'date', value: state.form.recurrence.endDate || '' },
      on: { input: (e) => { state.form.recurrence.endDate = e.target.value; } },
    }));
  }
  form.appendChild(row2);

  // Wochentage (nur bei weekly)
  if (state.form.recurrence.type === 'weekly') {
    const fieldset = el('fieldset', { className: 'weekday-picker' });
    fieldset.appendChild(el('legend', { text: 'Wochentage' }));
    for (const day of WEEKDAY_ORDER_MON_FIRST) {
      const lbl = el('label', { className: 'weekday-option' });
      const input = el('input', {
        attrs: {
          type: 'checkbox',
          checked: state.form.recurrence.weekdays.includes(day) ? true : false,
        },
        on: {
          change: (e) => {
            const set = new Set(state.form.recurrence.weekdays);
            if (e.target.checked) set.add(day); else set.delete(day);
            state.form.recurrence.weekdays = Array.from(set).sort((a, b) => a - b);
          },
        },
      });
      lbl.appendChild(input);
      lbl.appendChild(document.createTextNode(' ' + WEEKDAY_LABELS[day]));
      fieldset.appendChild(lbl);
    }
    form.appendChild(fieldset);
  }

  // Intervall (nur bei daily/weekly)
  if (state.form.recurrence.type !== 'once') {
    const unit = state.form.recurrence.type === 'weekly' ? 'Wochen' : 'Tage';
    form.appendChild(labelInput(`Intervall (alle X ${unit})`, {
      attrs: { type: 'number', min: '1', value: String(state.form.recurrence.interval) },
      on: { input: (e) => { state.form.recurrence.interval = e.target.value; } },
    }));
  }

  // Aktiv
  const activeLabel = el('label', { className: 'inline' });
  const activeInput = el('input', {
    attrs: { type: 'checkbox', checked: state.form.enabled ? true : false },
    on: { change: (e) => { state.form.enabled = e.target.checked; } },
  });
  activeLabel.appendChild(activeInput);
  activeLabel.appendChild(el('span', { text: 'Aktiv' }));
  form.appendChild(activeLabel);

  if (state.error) {
    form.appendChild(el('div', { className: 'form-error', text: state.error }));
  }

  const actions = el('div', { className: 'form-actions' });
  actions.appendChild(el('button', {
    className: 'primary',
    attrs: { type: 'submit' },
    text: state.editingId ? 'Plan speichern' : 'Plan erstellen',
  }));
  if (state.editingId) {
    actions.appendChild(el('button', {
      attrs: { type: 'button' },
      text: 'Abbrechen',
      on: {
        click: () => {
          state.form = emptyForm();
          state.editingId = null;
          state.error = '';
          rerender();
        },
      },
    }));
  }
  form.appendChild(actions);

  section.appendChild(form);
  return section;
}

async function handleSubmit(e) {
  e.preventDefault();
  state.error = '';
  if (!state.form.fileId) {
    state.error = 'Bitte eine Datei ausw\u00e4hlen.';
    rerender();
    return;
  }
  const payload = {
    name: state.form.name,
    fileId: state.form.fileId,
    startTime: state.form.startTime,
    durationMinutes: Number(state.form.durationMinutes),
    enabled: state.form.enabled,
    recurrence: {
      type: state.form.recurrence.type,
      startDate: state.form.recurrence.startDate,
      endDate: state.form.recurrence.endDate || null,
      interval: Number(state.form.recurrence.interval) || 1,
    },
  };
  if (state.form.recurrence.type === 'weekly') {
    payload.recurrence.weekdays = state.form.recurrence.weekdays;
  }
  try {
    if (state.editingId) {
      await scheduleAPI.update(state.editingId, payload);
    } else {
      await scheduleAPI.create(payload);
    }
    state.form = emptyForm();
    state.editingId = null;
    state.schedules = await scheduleAPI.getAll();
    rerender();
  } catch (err) {
    state.error = (err instanceof ApiError) ? err.message : (err.message || 'Fehler beim Speichern');
    rerender();
  }
}

// =========================================================================
// Liste vorhandener Plaene
// =========================================================================

function buildListSection() {
  const section = el('section', { className: 'schedule-list-section' });
  section.appendChild(el('h3', { text: 'Vorhandene Pl\u00e4ne' }));
  if (state.schedules.length === 0) {
    section.appendChild(el('p', { className: 'empty', text: 'Noch keine Pl\u00e4ne angelegt.' }));
    return section;
  }
  const list = el('ul', { className: 'schedule-list' });
  for (const s of state.schedules) {
    list.appendChild(buildScheduleItem(s));
  }
  section.appendChild(list);
  return section;
}

function buildScheduleItem(s) {
  const file = state.files.find((f) => f.id === s.fileId);
  const li = el('li', { className: 'schedule-item' + (s.enabled ? '' : ' disabled') });
  const main = el('div', { className: 'schedule-item-main' });

  const title = el('div', { className: 'schedule-item-title' });
  title.appendChild(el('strong', { text: s.name || (file ? (file.originalName || file.filename) : 'Unbenannt') }));
  title.appendChild(el('span', { className: 'time', text: `${s.startTime} \u00b7 ${s.durationMinutes} Min.` }));
  main.appendChild(title);

  const meta = el('div', { className: 'schedule-item-meta' });
  if (file) {
    meta.appendChild(el('span', { className: 'file-ref', text: `${file.originalName || file.filename} (${file.type})` }));
  } else {
    meta.appendChild(el('span', { className: 'file-ref missing', text: 'Datei fehlt' }));
  }
  meta.appendChild(el('span', { className: 'recurrence', text: describeRecurrence(s) }));
  main.appendChild(meta);

  const actions = el('div', { className: 'schedule-item-actions' });
  actions.appendChild(el('button', {
    attrs: { type: 'button' },
    text: s.enabled ? 'Pausieren' : 'Aktivieren',
    on: {
      click: async () => {
        try {
          await scheduleAPI.update(s.id, { enabled: !s.enabled });
          state.schedules = await scheduleAPI.getAll();
          rerender();
        } catch (err) {
          alert(err.message || 'Fehler beim Aktualisieren');
        }
      },
    },
  }));
  actions.appendChild(el('button', {
    attrs: { type: 'button' },
    text: 'Bearbeiten',
    on: {
      click: () => {
        state.editingId = s.id;
        state.form = {
          name: s.name || '',
          fileId: s.fileId,
          startTime: s.startTime,
          durationMinutes: s.durationMinutes,
          enabled: !!s.enabled,
          recurrence: {
            type: s.recurrence.type,
            startDate: s.recurrence.startDate,
            endDate: s.recurrence.endDate || '',
            interval: s.recurrence.interval || 1,
            weekdays: Array.isArray(s.recurrence.weekdays) ? s.recurrence.weekdays : [1, 2, 3, 4, 5],
          },
        };
        state.error = '';
        rerender();
        // Form ins Sichtfeld scrollen.
        document.querySelector('.schedule-form-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    },
  }));
  actions.appendChild(el('button', {
    className: 'danger',
    attrs: { type: 'button' },
    text: 'L\u00f6schen',
    on: {
      click: async () => {
        if (!window.confirm('Diesen Plan wirklich l\u00f6schen?')) return;
        try {
          await scheduleAPI.remove(s.id);
          if (state.editingId === s.id) {
            state.editingId = null;
            state.form = emptyForm();
          }
          state.schedules = await scheduleAPI.getAll();
          rerender();
        } catch (err) {
          alert(err.message || 'Fehler beim L\u00f6schen');
        }
      },
    },
  }));

  li.appendChild(main);
  li.appendChild(actions);
  return li;
}

// =========================================================================
// Wochenvorschau
// =========================================================================

function buildWeekOverview() {
  const section = el('section', { className: 'schedule-week-overview' });
  section.appendChild(el('h3', { text: 'Vorschau: N\u00e4chste 7 Tage' }));
  if (state.schedules.length === 0) {
    section.appendChild(el('p', { className: 'empty', text: 'Keine Pl\u00e4ne vorhanden.' }));
    return section;
  }

  const days = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const grid = el('div', { className: 'week-grid' });
  for (const day of days) {
    const cell = el('div', { className: 'week-day' });
    cell.appendChild(el('div', { className: 'week-day-header', text: formatDateLabel(day) }));
    const todays = state.schedules
      .filter((s) => isActiveOnDay(s, day))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (todays.length === 0) {
      cell.appendChild(el('div', { className: 'week-day-empty', text: '\u2013' }));
    } else {
      const list = el('ul');
      for (const s of todays) {
        const file = state.files.find((f) => f.id === s.fileId);
        const li = el('li');
        li.appendChild(el('span', { className: 'slot-time', text: s.startTime }));
        li.appendChild(el('span', {
          className: 'slot-name',
          text: s.name || (file ? (file.originalName || file.filename) : 'Plan'),
        }));
        list.appendChild(li);
      }
      cell.appendChild(list);
    }
    grid.appendChild(cell);
  }
  section.appendChild(grid);
  return section;
}

// =========================================================================
// Helpers
// =========================================================================

function emptyForm() {
  return {
    name: '',
    fileId: '',
    startTime: '08:00',
    durationMinutes: 30,
    enabled: true,
    recurrence: {
      type: 'once',
      startDate: todayString(),
      endDate: '',
      weekdays: [1, 2, 3, 4, 5],
      interval: 1,
    },
  };
}

function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateOnly(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function diffInDays(a, b) {
  const aMid = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bMid = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((aMid - bMid) / (24 * 60 * 60 * 1000));
}

function mondayOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffToMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  return d;
}

function isActiveOnDay(schedule, day) {
  if (!schedule.enabled) return false;
  const rec = schedule.recurrence || {};
  if (!rec.startDate) return false;
  const startDate = parseDateOnly(rec.startDate);
  const today = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  if (today < startDate) return false;
  if (rec.endDate) {
    const endDate = parseDateOnly(rec.endDate);
    if (today > endDate) return false;
  }
  const interval = rec.interval && rec.interval >= 1 ? rec.interval : 1;
  if (rec.type === 'once') {
    return diffInDays(today, startDate) === 0;
  }
  if (rec.type === 'daily') {
    const days = diffInDays(today, startDate);
    return days >= 0 && days % interval === 0;
  }
  if (rec.type === 'weekly') {
    if (!Array.isArray(rec.weekdays) || !rec.weekdays.includes(today.getDay())) return false;
    const weeks = Math.floor(diffInDays(mondayOfWeek(today), mondayOfWeek(startDate)) / 7);
    return weeks >= 0 && weeks % interval === 0;
  }
  return false;
}

function formatDateLabel(date) {
  return date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function describeRecurrence(schedule) {
  const rec = schedule.recurrence || {};
  if (rec.type === 'once') {
    return `Einmalig am ${rec.startDate}`;
  }
  if (rec.type === 'daily') {
    const intervalText = rec.interval > 1 ? `alle ${rec.interval} Tage` : 't\u00e4glich';
    return `${intervalText} ab ${rec.startDate}${rec.endDate ? ' bis ' + rec.endDate : ''}`;
  }
  if (rec.type === 'weekly') {
    const days = (rec.weekdays || []).map((w) => WEEKDAY_LABELS[w]).join(', ');
    const intervalText = rec.interval > 1 ? ` (alle ${rec.interval} Wochen)` : '';
    return `W\u00f6chentlich: ${days}${intervalText} ab ${rec.startDate}${rec.endDate ? ' bis ' + rec.endDate : ''}`;
  }
  return '';
}

// =========================================================================
// kleiner Hilfs-Builder (Label + Input)
// =========================================================================

function labelInput(labelText, inputOpts) {
  const lbl = el('label');
  lbl.appendChild(el('span', { text: labelText }));
  lbl.appendChild(el('input', inputOpts));
  return lbl;
}
