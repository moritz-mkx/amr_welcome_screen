import { useState, useEffect, useRef } from 'react';
import { configAPI, widgetImageAPI } from '../../services/api';
import './WidgetConfigPanel.css';

function WidgetConfigPanel({ widget, onConfigChange, onDelete }) {
  const [config, setConfig] = useState(widget?.config ?? {});
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef(null);

  useEffect(() => {
    setConfig(widget?.config ?? {});
  }, [widget]);

  if (!widget) {
    return (
      <div className="widget-config-panel empty">
        <p>Widget auswählen</p>
      </div>
    );
  }

  const update = (updates) => {
    const next = { ...config, ...updates };
    setConfig(next);
    onConfigChange(next);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setImageUploading(true);
    try {
      const { id } = await widgetImageAPI.upload(file);
      update({ src: id });
    } catch (err) {
      alert(err.response?.data?.error || 'Fehler beim Hochladen');
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const typeLabel = { clock: 'Uhrzeit', date: 'Datum', text: 'Text', image: 'Bild' }[widget.type] || widget.type;

  return (
    <div className="widget-config-panel">
      <div className="widget-config-header">
        <h3>{typeLabel}</h3>
        <button type="button" className="widget-config-delete" onClick={onDelete}>
          Widget entfernen
        </button>
      </div>

      {widget.type === 'clock' && (
        <>
          <label>
            <strong>Schriftgröße</strong>
            <span className="widget-config-value">{config.fontSize ?? 160} px</span>
          </label>
          <input
            type="range"
            min="80"
            max="400"
            step="10"
            value={config.fontSize ?? 160}
            onChange={(e) => update({ fontSize: parseInt(e.target.value, 10) })}
          />
          <label>
            <strong>Farbe</strong>
          </label>
          <input
            type="color"
            value={config.color ?? '#f0f0f5'}
            onChange={(e) => update({ color: e.target.value })}
          />
          <label className="widget-config-check">
            <input
              type="checkbox"
              checked={config.showSeconds !== false}
              onChange={(e) => update({ showSeconds: e.target.checked })}
            />
            Sekunden anzeigen
          </label>
        </>
      )}

      {widget.type === 'date' && (
        <>
          <label>
            <strong>Schriftgröße</strong>
            <span className="widget-config-value">{config.fontSize ?? 42} px</span>
          </label>
          <input
            type="range"
            min="20"
            max="120"
            step="2"
            value={config.fontSize ?? 42}
            onChange={(e) => update({ fontSize: parseInt(e.target.value, 10) })}
          />
          <label>
            <strong>Farbe</strong>
          </label>
          <input
            type="color"
            value={config.color ?? '#a0a0b0'}
            onChange={(e) => update({ color: e.target.value })}
          />
          <label>
            <strong>Format</strong>
          </label>
          <select
            value={config.format ?? 'long'}
            onChange={(e) => update({ format: e.target.value })}
          >
            <option value="long">Lang (z. B. Montag, 8. Februar 2026)</option>
            <option value="short">Kurz (TT.MM.JJJJ)</option>
          </select>
        </>
      )}

      {widget.type === 'text' && (
        <>
          <label>
            <strong>Text</strong>
          </label>
          <input
            type="text"
            value={config.text ?? ''}
            onChange={(e) => update({ text: e.target.value })}
            placeholder="Willkommen!"
          />
          <label>
            <strong>Schriftgröße</strong>
            <span className="widget-config-value">{config.fontSize ?? 32} px</span>
          </label>
          <input
            type="range"
            min="12"
            max="120"
            step="2"
            value={config.fontSize ?? 32}
            onChange={(e) => update({ fontSize: parseInt(e.target.value, 10) })}
          />
          <label>
            <strong>Farbe</strong>
          </label>
          <input
            type="color"
            value={config.color ?? '#ffffff'}
            onChange={(e) => update({ color: e.target.value })}
          />
          <label>
            <strong>Schriftstärke</strong>
          </label>
          <select
            value={config.fontWeight ?? '400'}
            onChange={(e) => update({ fontWeight: e.target.value })}
          >
            <option value="300">Leicht</option>
            <option value="400">Normal</option>
            <option value="600">Halbfett</option>
            <option value="700">Fett</option>
          </select>
          <label>
            <strong>Ausrichtung</strong>
          </label>
          <select
            value={config.textAlign ?? 'center'}
            onChange={(e) => update({ textAlign: e.target.value })}
          >
            <option value="left">Links</option>
            <option value="center">Zentriert</option>
            <option value="right">Rechts</option>
          </select>
        </>
      )}

      {widget.type === 'image' && (
        <>
          <label>
            <strong>Quelle</strong>
          </label>
          <div className="widget-config-image-src">
            <label className="widget-config-radio">
              <input
                type="radio"
                name={`img-src-${widget.i}`}
                value="logo"
                checked={config.src === 'logo'}
                onChange={() => update({ src: 'logo' })}
              />
              <span>Logo</span>
            </label>
            <label className="widget-config-radio">
              <input
                type="radio"
                name={`img-src-${widget.i}`}
                value="custom"
                checked={config.src && config.src !== 'logo'}
                onChange={() => update({ src: config.src === 'logo' ? '' : config.src })}
              />
              <span>Eigenes Bild</span>
            </label>
          </div>
          {config.src !== 'logo' && (
            <>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={imageUploading}
                className="widget-config-file-input"
              />
              {imageUploading && <span className="widget-config-upload-status">Wird hochgeladen…</span>}
            </>
          )}
          <label>
            <strong>Darstellung</strong>
          </label>
          <select
            value={config.objectFit ?? 'contain'}
            onChange={(e) => update({ objectFit: e.target.value })}
          >
            <option value="contain">Enthalten (Proportionen)</option>
            <option value="cover">Ausfüllen</option>
            <option value="fill">Strecken</option>
          </select>
        </>
      )}

    </div>
  );
}

export default WidgetConfigPanel;
