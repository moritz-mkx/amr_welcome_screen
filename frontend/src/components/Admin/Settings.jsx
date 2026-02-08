import { useState, useEffect, useRef } from 'react';
import { configAPI } from '../../services/api';
import './Settings.css';

function Settings({ config, onUpdate }) {
  const [slideInterval, setSlideInterval] = useState(config.slideInterval || 5000);
  const [transitionDuration, setTransitionDuration] = useState(config.transitionDuration || 1000);
  const [emptyScreenMode, setEmptyScreenMode] = useState(config.emptyScreenMode || 'setup');
  const [timeFontSize, setTimeFontSize] = useState(config.timeFontSize ?? 160);
  const [dateFontSize, setDateFontSize] = useState(config.dateFontSize ?? 42);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoKey, setLogoKey] = useState(0);
  const logoInputRef = useRef(null);

  useEffect(() => {
    setSlideInterval(config.slideInterval || 5000);
    setTransitionDuration(config.transitionDuration || 1000);
    setEmptyScreenMode(config.emptyScreenMode || 'setup');
    setTimeFontSize(config.timeFontSize ?? 160);
    setDateFontSize(config.dateFontSize ?? 42);
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate({
        slideInterval: parseInt(slideInterval, 10),
        transitionDuration: parseInt(transitionDuration, 10),
        emptyScreenMode,
        timeFontSize: parseInt(timeFontSize, 10),
        dateFontSize: parseInt(dateFontSize, 10)
      });
      alert('Einstellungen gespeichert!');
    } catch (error) {
      alert('Fehler beim Speichern der Einstellungen');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setLogoUploading(true);
    try {
      await configAPI.uploadLogo(file);
      setLogoKey(k => k + 1);
    } catch (err) {
      alert(err.response?.data?.error || 'Fehler beim Logo-Upload');
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
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
          <label>
            <strong>Uhr-Anzeige: Logo</strong>
          </label>
          <p className="setting-description">
            Logo, das über der Uhrzeit angezeigt wird (z. B. Firmenlogo). Ersetzt das bisherige Logo.
          </p>
          <div className="setting-logo-row">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              disabled={logoUploading}
              className="setting-logo-input"
            />
            {logoUploading && <span className="setting-logo-status">Wird hochgeladen…</span>}
          </div>
          <div className="setting-logo-preview">
            <img
              key={logoKey}
              src={configAPI.getLogoUrl() + '?t=' + Date.now()}
              alt="Logo Vorschau"
              onError={(e) => { e.target.style.display = 'none'; }}
              className="setting-logo-img"
            />
          </div>
        </div>

        <div className="setting-item">
          <label htmlFor="timeFontSize">
            <strong>Uhr-Anzeige: Größe der Uhrzeit</strong>
            <span className="setting-value">{timeFontSize} px</span>
          </label>
          <input
            id="timeFontSize"
            type="range"
            min="80"
            max="400"
            step="10"
            value={timeFontSize}
            onChange={(e) => setTimeFontSize(Number(e.target.value))}
          />
          <div className="setting-range-labels">
            <span>80 px</span>
            <span>400 px</span>
          </div>
        </div>

        <div className="setting-item">
          <label htmlFor="dateFontSize">
            <strong>Uhr-Anzeige: Größe des Datums</strong>
            <span className="setting-value">{dateFontSize} px</span>
          </label>
          <input
            id="dateFontSize"
            type="range"
            min="20"
            max="120"
            step="2"
            value={dateFontSize}
            onChange={(e) => setDateFontSize(Number(e.target.value))}
          />
          <div className="setting-range-labels">
            <span>20 px</span>
            <span>120 px</span>
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
