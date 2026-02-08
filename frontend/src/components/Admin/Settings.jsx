import { useState, useEffect } from 'react';
import './Settings.css';

function Settings({ config, onUpdate }) {
  const [slideInterval, setSlideInterval] = useState(config.slideInterval || 5000);
  const [transitionDuration, setTransitionDuration] = useState(config.transitionDuration || 1000);
  const [emptyScreenMode, setEmptyScreenMode] = useState(config.emptyScreenMode || 'setup');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSlideInterval(config.slideInterval || 5000);
    setTransitionDuration(config.transitionDuration || 1000);
    setEmptyScreenMode(config.emptyScreenMode || 'setup');
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate({
        slideInterval: parseInt(slideInterval, 10),
        transitionDuration: parseInt(transitionDuration, 10),
        emptyScreenMode
      });
      alert('Einstellungen gespeichert!');
    } catch (error) {
      alert('Fehler beim Speichern der Einstellungen');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (ms) => {
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
  };

  return (
    <div className="settings">
      <h2>Einstellungen</h2>

      <div className="settings-group">
        <div className="setting-item">
          <label>
            <strong>Anzeige bei leerem Bildschirm</strong>
          </label>
          <p className="setting-description">
            Wenn noch keine Bilder hochgeladen wurden (oder Sie diese Option nutzen möchten):
          </p>
          <div className="setting-radio-group">
            <label className="setting-radio">
              <input
                type="radio"
                name="emptyScreenMode"
                value="setup"
                checked={emptyScreenMode === 'setup'}
                onChange={(e) => setEmptyScreenMode(e.target.value)}
              />
              <span>Einrichtungs-Anleitung anzeigen</span>
            </label>
            <label className="setting-radio">
              <input
                type="radio"
                name="emptyScreenMode"
                value="clock"
                checked={emptyScreenMode === 'clock'}
                onChange={(e) => setEmptyScreenMode(e.target.value)}
              />
              <span>Uhr und Datum anzeigen</span>
            </label>
          </div>
        </div>

        <div className="setting-item">
          <label htmlFor="slideInterval">
            <strong>Zeitintervall zwischen Slides</strong>
            <span className="setting-value">{formatTime(slideInterval)}</span>
          </label>
          <input
            id="slideInterval"
            type="range"
            min="1000"
            max="60000"
            step="500"
            value={slideInterval}
            onChange={(e) => setSlideInterval(e.target.value)}
          />
          <div className="setting-range-labels">
            <span>1 Sekunde</span>
            <span>60 Sekunden</span>
          </div>
          <p className="setting-description">
            Wie lange jedes Bild angezeigt wird, bevor zum nächsten gewechselt wird.
          </p>
        </div>

        <div className="setting-item">
          <label htmlFor="transitionDuration">
            <strong>Übergangsdauer</strong>
            <span className="setting-value">{formatTime(transitionDuration)}</span>
          </label>
          <input
            id="transitionDuration"
            type="range"
            min="0"
            max="3000"
            step="100"
            value={transitionDuration}
            onChange={(e) => setTransitionDuration(e.target.value)}
          />
          <div className="setting-range-labels">
            <span>0 ms</span>
            <span>3 Sekunden</span>
          </div>
          <p className="setting-description">
            Dauer des Fade-Übergangs zwischen den Slides.
          </p>
        </div>
      </div>

      <div className="settings-actions">
        <button
          className="save-button"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Speichere...' : 'Einstellungen speichern'}
        </button>
      </div>
    </div>
  );
}

export default Settings;
