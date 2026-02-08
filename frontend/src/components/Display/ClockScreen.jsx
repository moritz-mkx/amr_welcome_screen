import { useState, useEffect } from 'react';
import './ClockScreen.css';

function formatTime(date) {
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function formatDate(date) {
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function ClockScreen({ config = {} }) {
  const [now, setNow] = useState(new Date());
  const [logoOk, setLogoOk] = useState(false);

  const timeFontSize = config.timeFontSize ?? 160;
  const dateFontSize = config.dateFontSize ?? 42;
  const logoMaxWidth = config.logoMaxWidth ?? 320;
  const logoMaxHeight = config.logoMaxHeight ?? 120;

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="clock-screen">
      <img
        className="clock-logo"
        src="/api/logo"
        alt=""
        onLoad={() => setLogoOk(true)}
        onError={() => setLogoOk(false)}
        style={{
          display: logoOk ? 'block' : 'none',
          maxWidth: `${logoMaxWidth}px`,
          maxHeight: `${logoMaxHeight}px`
        }}
      />
      <div
        className="clock-time"
        style={{ fontSize: `${timeFontSize}px` }}
      >
        {formatTime(now)}
      </div>
      <div
        className="clock-date"
        style={{ fontSize: `${dateFontSize}px` }}
      >
        {formatDate(now)}
      </div>
    </div>
  );
}

export default ClockScreen;
