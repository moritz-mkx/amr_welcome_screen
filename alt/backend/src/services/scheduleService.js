const fs = require('fs');
const path = require('path');

const SCHEDULES_FILE = path.join(__dirname, '../../schedules.json');

const RECURRENCE_TYPES = ['once', 'daily', 'weekly'];
const PRIORITY = { once: 3, weekly: 2, daily: 1 };

function loadSchedules() {
  try {
    if (fs.existsSync(SCHEDULES_FILE)) {
      const data = fs.readFileSync(SCHEDULES_FILE, 'utf8');
      const parsed = JSON.parse(data);
      return Array.isArray(parsed.schedules) ? parsed : { schedules: [] };
    }
    return { schedules: [] };
  } catch (error) {
    console.error('Fehler beim Laden der Schedules:', error);
    return { schedules: [] };
  }
}

function saveSchedules(data) {
  try {
    const dir = path.dirname(SCHEDULES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Fehler beim Speichern der Schedules:', error);
    throw error;
  }
}

function generateId() {
  return Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
}

function getAllSchedules() {
  return loadSchedules().schedules;
}

function getScheduleById(id) {
  return loadSchedules().schedules.find(s => s.id === id) || null;
}

function normalizeSchedule(input, existing = null) {
  const recurrenceIn = input.recurrence || (existing && existing.recurrence) || {};
  const type = RECURRENCE_TYPES.includes(recurrenceIn.type) ? recurrenceIn.type : 'once';

  const startDate = recurrenceIn.startDate || (existing && existing.recurrence && existing.recurrence.startDate);
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    throw new Error('recurrence.startDate (YYYY-MM-DD) ist erforderlich');
  }

  let endDate = recurrenceIn.endDate;
  if (endDate === undefined && existing && existing.recurrence) endDate = existing.recurrence.endDate;
  if (type === 'once') {
    endDate = startDate;
  } else if (endDate !== null && endDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new Error('recurrence.endDate muss YYYY-MM-DD sein oder null');
  }

  let weekdays = recurrenceIn.weekdays;
  if (weekdays === undefined && existing && existing.recurrence) weekdays = existing.recurrence.weekdays;
  if (type === 'weekly') {
    if (!Array.isArray(weekdays) || weekdays.length === 0) {
      throw new Error('Bei wöchentlicher Wiederholung muss mindestens ein Wochentag gewählt sein');
    }
    weekdays = weekdays
      .map(n => Number(n))
      .filter(n => Number.isInteger(n) && n >= 0 && n <= 6);
    if (weekdays.length === 0) {
      throw new Error('weekdays muss Zahlen 0-6 enthalten (0=So..6=Sa)');
    }
  } else {
    weekdays = undefined;
  }

  let interval = recurrenceIn.interval;
  if (interval === undefined && existing && existing.recurrence) interval = existing.recurrence.interval;
  interval = Number(interval) || 1;
  if (interval < 1) interval = 1;

  const startTime = input.startTime || (existing && existing.startTime);
  if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
    throw new Error('startTime (HH:MM) ist erforderlich');
  }
  const [hh, mm] = startTime.split(':').map(Number);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    throw new Error('startTime muss eine gültige Uhrzeit sein (HH:MM)');
  }

  let durationMinutes = input.durationMinutes !== undefined
    ? Number(input.durationMinutes)
    : (existing && existing.durationMinutes);
  if (!Number.isFinite(durationMinutes) || durationMinutes < 1) {
    throw new Error('durationMinutes muss eine positive Zahl sein');
  }
  durationMinutes = Math.floor(durationMinutes);

  const fileId = input.fileId || (existing && existing.fileId);
  if (!fileId) {
    throw new Error('fileId ist erforderlich');
  }

  const name = (input.name !== undefined ? input.name : (existing && existing.name)) || '';
  const enabled = input.enabled !== undefined
    ? Boolean(input.enabled)
    : (existing ? Boolean(existing.enabled) : true);

  const normalized = {
    id: existing ? existing.id : generateId(),
    name: String(name),
    fileId: String(fileId),
    startTime,
    durationMinutes,
    recurrence: {
      type,
      startDate,
      endDate: endDate || null,
      interval
    },
    enabled,
    createdAt: existing ? existing.createdAt : new Date().toISOString()
  };
  if (type === 'weekly') {
    normalized.recurrence.weekdays = weekdays;
  }
  return normalized;
}

function addSchedule(input) {
  const schedule = normalizeSchedule(input, null);
  const data = loadSchedules();
  data.schedules.push(schedule);
  saveSchedules(data);
  return schedule;
}

function updateSchedule(id, updates) {
  const data = loadSchedules();
  const index = data.schedules.findIndex(s => s.id === id);
  if (index === -1) {
    throw new Error('Schedule nicht gefunden');
  }
  const existing = data.schedules[index];
  const merged = {
    ...existing,
    ...updates,
    recurrence: { ...(existing.recurrence || {}), ...(updates.recurrence || {}) }
  };
  const normalized = normalizeSchedule(merged, existing);
  data.schedules[index] = normalized;
  saveSchedules(data);
  return normalized;
}

function deleteSchedule(id) {
  const data = loadSchedules();
  const before = data.schedules.length;
  data.schedules = data.schedules.filter(s => s.id !== id);
  if (data.schedules.length === before) {
    throw new Error('Schedule nicht gefunden');
  }
  saveSchedules(data);
  return true;
}

function deleteSchedulesByFileId(fileId) {
  const data = loadSchedules();
  const before = data.schedules.length;
  data.schedules = data.schedules.filter(s => s.fileId !== fileId);
  const removed = before - data.schedules.length;
  if (removed > 0) {
    saveSchedules(data);
  }
  return removed;
}

// --- Date helpers (alle Berechnungen in lokaler Zeit) ---

function toDateOnlyString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateOnly(str) {
  // YYYY-MM-DD -> Date um Mitternacht lokal
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function diffInDays(a, b) {
  // Anzahl ganzer Tage zwischen zwei lokalen Mitternachts-Daten (a - b)
  const MS = 24 * 60 * 60 * 1000;
  const aMid = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bMid = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((aMid - bMid) / MS);
}

function mondayOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=So..6=Sa
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  return d;
}

/**
 * Prüft, ob ein Schedule zum Zeitpunkt `now` aktiv ist.
 */
function isScheduleActiveAt(schedule, now) {
  if (!schedule || !schedule.enabled) return false;

  const rec = schedule.recurrence || {};
  const startDate = parseDateOnly(rec.startDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (today < startDate) return false;
  if (rec.endDate) {
    const endDate = parseDateOnly(rec.endDate);
    if (today > endDate) return false;
  }

  const [hh, mm] = schedule.startTime.split(':').map(Number);
  const startMinutes = hh * 60 + mm;
  const endMinutes = Math.min(startMinutes + schedule.durationMinutes, 24 * 60);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (nowMinutes < startMinutes || nowMinutes >= endMinutes) return false;

  const interval = rec.interval && rec.interval >= 1 ? rec.interval : 1;

  if (rec.type === 'once') {
    return toDateOnlyString(today) === rec.startDate;
  }
  if (rec.type === 'daily') {
    const days = diffInDays(today, startDate);
    return days >= 0 && days % interval === 0;
  }
  if (rec.type === 'weekly') {
    if (!Array.isArray(rec.weekdays) || !rec.weekdays.includes(now.getDay())) return false;
    const weeks = Math.floor(diffInDays(mondayOfWeek(today), mondayOfWeek(startDate)) / 7);
    return weeks >= 0 && weeks % interval === 0;
  }
  return false;
}

/**
 * Liefert das aktuell aktive Schedule (höchste Priorität: once > weekly > daily,
 * danach createdAt absteigend).
 */
function getActiveSchedule(now = new Date()) {
  const schedules = getAllSchedules().filter(s => isScheduleActiveAt(s, now));
  if (schedules.length === 0) return null;
  schedules.sort((a, b) => {
    const pa = PRIORITY[a.recurrence.type] || 0;
    const pb = PRIORITY[b.recurrence.type] || 0;
    if (pa !== pb) return pb - pa;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
  return schedules[0];
}

module.exports = {
  loadSchedules,
  saveSchedules,
  getAllSchedules,
  getScheduleById,
  addSchedule,
  updateSchedule,
  deleteSchedule,
  deleteSchedulesByFileId,
  isScheduleActiveAt,
  getActiveSchedule
};
