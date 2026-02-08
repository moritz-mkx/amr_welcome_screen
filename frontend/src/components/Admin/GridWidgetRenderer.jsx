import { useState, useEffect } from 'react';
import { configAPI, widgetImageAPI } from '../../services/api';

function formatTime(date, showSeconds = true) {
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12: false
  });
}

function formatDate(date, format = 'long') {
  if (format === 'short') {
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function WidgetClock({ config = {} }) {
  const [now, setNow] = useState(new Date());
  const fontSize = config.fontSize ?? 160;
  const color = config.color ?? '#f0f0f5';
  const showSeconds = config.showSeconds !== false;

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="grid-widget-clock"
      style={{ fontSize: `${fontSize}px`, color }}
    >
      {formatTime(now, showSeconds)}
    </div>
  );
}

function WidgetDate({ config = {} }) {
  const [now, setNow] = useState(new Date());
  const fontSize = config.fontSize ?? 42;
  const color = config.color ?? '#a0a0b0';
  const format = config.format ?? 'long';

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="grid-widget-date"
      style={{ fontSize: `${fontSize}px`, color }}
    >
      {formatDate(now, format)}
    </div>
  );
}

function WidgetText({ config = {} }) {
  const text = config.text ?? '';
  const fontSize = config.fontSize ?? 32;
  const color = config.color ?? '#ffffff';
  const fontWeight = config.fontWeight ?? '400';
  const textAlign = config.textAlign ?? 'center';

  return (
    <div
      className="grid-widget-text"
      style={{ fontSize: `${fontSize}px`, color, fontWeight, textAlign }}
    >
      {text || 'Text'}
    </div>
  );
}

function WidgetImage({ config = {} }) {
  const [error, setError] = useState(false);
  const src = config.src;
  const objectFit = config.objectFit ?? 'contain';

  if (!src) {
    return (
      <div className="grid-widget-image grid-widget-image-placeholder">
        Bild (Quelle wählen)
      </div>
    );
  }

  const url = src === 'logo'
    ? configAPI.getLogoUrl()
    : widgetImageAPI.getUrl(src);

  return (
    <div className="grid-widget-image">
      <img
        src={url}
        alt=""
        style={{ objectFit }}
        onLoad={() => setError(false)}
        onError={() => setError(true)}
      />
      {error && (
        <div className="grid-widget-image-error">Bild nicht geladen</div>
      )}
    </div>
  );
}

/**
 * Rendert ein einzelnes Widget (Text, Uhrzeit, Datum, Bild).
 * Wird im Editor und auf dem Display verwendet.
 */
function GridWidgetRenderer({ widget }) {
  const { type, config = {} } = widget;

  switch (type) {
    case 'clock':
      return <WidgetClock config={config} />;
    case 'date':
      return <WidgetDate config={config} />;
    case 'text':
      return <WidgetText config={config} />;
    case 'image':
      return <WidgetImage config={config} />;
    default:
      return <div className="grid-widget-unknown">Unbekannt: {type}</div>;
  }
}

export default GridWidgetRenderer;
