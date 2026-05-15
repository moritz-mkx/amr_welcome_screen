import { useEffect, useMemo, useState } from 'react';
import { scheduleAPI } from '../../services/api';
import './ScheduleManager.css';

const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WEEKDAY_ORDER_MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function emptyForm() {
  return {
    id: null,
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
      interval: 1
    }
  };
}

function parseDateOnly(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function diffInDays(a, b) {
  const MS = 24 * 60 * 60 * 1000;
  const aMid = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bMid = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((aMid - bMid) / MS);
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

function ScheduleManager({ files }) {
  const [schedules, setSchedules] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const usableFiles = useMemo(() => files.filter(f => !!f && !!f.id), [files]);

  useEffect(() => {
    loadSchedules();
  }, []);

  async function loadSchedules() {
    try {
      setLoading(true);
      const data = await scheduleAPI.getAll();
      setSchedules(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm(emptyForm());
    setEditingId(null);
    setError('');
  }

  function startEdit(schedule) {
    setEditingId(schedule.id);
    setForm({
      id: schedule.id,
      name: schedule.name || '',
      fileId: schedule.fileId,
      startTime: schedule.startTime,
      durationMinutes: schedule.durationMinutes,
      enabled: schedule.enabled,
      recurrence: {
        type: schedule.recurrence.type,
        startDate: schedule.recurrence.startDate,
        endDate: schedule.recurrence.endDate || '',
        weekdays: Array.isArray(schedule.recurrence.weekdays) ? schedule.recurrence.weekdays : [],
        interval: schedule.recurrence.interval || 1
      }
    });
    setError('');
  }

  function toggleWeekday(day) {
    setForm(f => {
      const current = new Set(f.recurrence.weekdays);
      if (current.has(day)) current.delete(day);
      else current.add(day);
      return {
        ...f,
        recurrence: { ...f.recurrence, weekdays: Array.from(current).sort((a, b) => a - b) }
      };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.fileId) {
      setError('Bitte eine Datei auswählen.');
      return;
    }
    const payload = {
      name: form.name,
      fileId: form.fileId,
      startTime: form.startTime,
      durationMinutes: Number(form.durationMinutes),
      enabled: form.enabled,
      recurrence: {
        type: form.recurrence.type,
        startDate: form.recurrence.startDate,
        endDate: form.recurrence.endDate || null,
        interval: Number(form.recurrence.interval) || 1
      }
    };
    if (form.recurrence.type === 'weekly') {
      payload.recurrence.weekdays = form.recurrence.weekdays;
    }
    try {
      if (editingId) {
        await scheduleAPI.update(editingId, payload);
      } else {
        await scheduleAPI.create(payload);
      }
      resetForm();
      await loadSchedules();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Fehler beim Speichern';
      setError(msg);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Diesen Plan wirklich löschen?')) return;
    try {
      await scheduleAPI.delete(id);
      if (editingId === id) resetForm();
      await loadSchedules();
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Fehler beim Löschen');
    }
  }

  async function handleToggleEnabled(schedule) {
    try {
      await scheduleAPI.update(schedule.id, { enabled: !schedule.enabled });
      await loadSchedules();
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Fehler beim Aktualisieren');
    }
  }

  const fileById = useMemo(() => {
    const map = new Map();
    usableFiles.forEach(f => map.set(f.id, f));
    return map;
  }, [usableFiles]);

  // Wochenübersicht: heute + 6 weitere Tage (Mo–So-Logik nicht nötig, einfach 7 Tage ab heute)
  const weekDays = useMemo(() => {
    const days = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, []);

  function describeRecurrence(schedule) {
    const rec = schedule.recurrence || {};
    if (rec.type === 'once') {
      return `Einmalig am ${rec.startDate}`;
    }
    if (rec.type === 'daily') {
      const intervalText = rec.interval > 1 ? `alle ${rec.interval} Tage` : 'täglich';
      return `${intervalText} ab ${rec.startDate}${rec.endDate ? ' bis ' + rec.endDate : ''}`;
    }
    if (rec.type === 'weekly') {
      const days = (rec.weekdays || []).map(w => WEEKDAY_LABELS[w]).join(', ');
      const intervalText = rec.interval > 1 ? ` (alle ${rec.interval} Wochen)` : '';
      return `Wöchentlich: ${days}${intervalText} ab ${rec.startDate}${rec.endDate ? ' bis ' + rec.endDate : ''}`;
    }
    return '';
  }

  return (
    <div className="schedule-manager">
      <h2>Anzeige planen</h2>
      <p className="hint">
        Lege fest, dass eine bestimmte Datei zu einer geplanten Zeit exklusiv angezeigt wird.
        Während des Zeitfensters pausiert die normale Slideshow.
      </p>

      <div className="schedule-layout">
        <section className="schedule-form-section">
          <h3>{editingId ? 'Plan bearbeiten' : 'Neuen Plan erstellen'}</h3>
          <form onSubmit={handleSubmit} className="schedule-form">
            <label>
              <span>Name (optional)</span>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="z. B. Begrüßung Morgenmeeting"
              />
            </label>

            <label>
              <span>Datei</span>
              <select
                value={form.fileId}
                onChange={e => setForm({ ...form, fileId: e.target.value })}
                required
              >
                <option value="">– bitte wählen –</option>
                {usableFiles.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.originalName} ({f.type})
                  </option>
                ))}
              </select>
            </label>

            <div className="row">
              <label>
                <span>Startzeit</span>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={e => setForm({ ...form, startTime: e.target.value })}
                  required
                />
              </label>
              <label>
                <span>Dauer (Minuten)</span>
                <input
                  type="number"
                  min="1"
                  value={form.durationMinutes}
                  onChange={e => setForm({ ...form, durationMinutes: e.target.value })}
                  required
                />
              </label>
            </div>

            <label>
              <span>Wiederholung</span>
              <select
                value={form.recurrence.type}
                onChange={e => setForm({
                  ...form,
                  recurrence: { ...form.recurrence, type: e.target.value }
                })}
              >
                <option value="once">Einmalig</option>
                <option value="daily">Täglich</option>
                <option value="weekly">Wöchentlich</option>
              </select>
            </label>

            <div className="row">
              <label>
                <span>Startdatum</span>
                <input
                  type="date"
                  value={form.recurrence.startDate}
                  onChange={e => setForm({
                    ...form,
                    recurrence: { ...form.recurrence, startDate: e.target.value }
                  })}
                  required
                />
              </label>
              {form.recurrence.type !== 'once' && (
                <label>
                  <span>Enddatum (optional)</span>
                  <input
                    type="date"
                    value={form.recurrence.endDate}
                    onChange={e => setForm({
                      ...form,
                      recurrence: { ...form.recurrence, endDate: e.target.value }
                    })}
                  />
                </label>
              )}
            </div>

            {form.recurrence.type === 'weekly' && (
              <fieldset className="weekday-picker">
                <legend>Wochentage</legend>
                {WEEKDAY_ORDER_MON_FIRST.map(day => (
                  <label key={day} className="weekday-option">
                    <input
                      type="checkbox"
                      checked={form.recurrence.weekdays.includes(day)}
                      onChange={() => toggleWeekday(day)}
                    />
                    {WEEKDAY_LABELS[day]}
                  </label>
                ))}
              </fieldset>
            )}

            {form.recurrence.type !== 'once' && (
              <label>
                <span>Intervall (alle X {form.recurrence.type === 'weekly' ? 'Wochen' : 'Tage'})</span>
                <input
                  type="number"
                  min="1"
                  value={form.recurrence.interval}
                  onChange={e => setForm({
                    ...form,
                    recurrence: { ...form.recurrence, interval: e.target.value }
                  })}
                />
              </label>
            )}

            <label className="inline">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={e => setForm({ ...form, enabled: e.target.checked })}
              />
              <span>Aktiv</span>
            </label>

            {error && <div className="form-error">{error}</div>}

            <div className="form-actions">
              <button type="submit" className="primary">
                {editingId ? 'Plan speichern' : 'Plan erstellen'}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm}>
                  Abbrechen
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="schedule-list-section">
          <h3>Vorhandene Pläne</h3>
          {loading ? (
            <p>Lade…</p>
          ) : schedules.length === 0 ? (
            <p className="empty">Noch keine Pläne angelegt.</p>
          ) : (
            <ul className="schedule-list">
              {schedules.map(s => {
                const file = fileById.get(s.fileId);
                return (
                  <li key={s.id} className={`schedule-item ${s.enabled ? '' : 'disabled'}`}>
                    <div className="schedule-item-main">
                      <div className="schedule-item-title">
                        <strong>{s.name || (file ? file.originalName : 'Unbenannt')}</strong>
                        <span className="time">
                          {s.startTime} · {s.durationMinutes} Min.
                        </span>
                      </div>
                      <div className="schedule-item-meta">
                        {file ? (
                          <span className="file-ref">{file.originalName} ({file.type})</span>
                        ) : (
                          <span className="file-ref missing">Datei fehlt</span>
                        )}
                        <span className="recurrence">{describeRecurrence(s)}</span>
                      </div>
                    </div>
                    <div className="schedule-item-actions">
                      <button onClick={() => handleToggleEnabled(s)}>
                        {s.enabled ? 'Pausieren' : 'Aktivieren'}
                      </button>
                      <button onClick={() => startEdit(s)}>Bearbeiten</button>
                      <button className="danger" onClick={() => handleDelete(s.id)}>
                        Löschen
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="schedule-week-overview">
        <h3>Vorschau: Nächste 7 Tage</h3>
        {schedules.length === 0 ? (
          <p className="empty">Keine Pläne vorhanden.</p>
        ) : (
          <div className="week-grid">
            {weekDays.map(day => {
              const todays = schedules
                .filter(s => isActiveOnDay(s, day))
                .sort((a, b) => a.startTime.localeCompare(b.startTime));
              return (
                <div key={day.toISOString()} className="week-day">
                  <div className="week-day-header">{formatDateLabel(day)}</div>
                  {todays.length === 0 ? (
                    <div className="week-day-empty">–</div>
                  ) : (
                    <ul>
                      {todays.map(s => {
                        const file = fileById.get(s.fileId);
                        return (
                          <li key={s.id}>
                            <span className="slot-time">{s.startTime}</span>
                            <span className="slot-name">
                              {s.name || (file ? file.originalName : 'Plan')}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default ScheduleManager;
