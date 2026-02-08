import { useState, useEffect } from 'react';
import { systemAPI } from '../../services/api';
import './SetupGuide.css';

function SetupGuide() {
  const [ips, setIps] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchIP = async () => {
      try {
        const data = await systemAPI.getIP();
        if (!cancelled && data.ips && data.ips.length > 0) {
          setIps(data.ips);
        }
      } catch {
        if (!cancelled) setIps(null);
      }
    };
    fetchIP();
    const interval = setInterval(fetchIP, 10000); // alle 10 s neu prüfen
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const baseUrl = ips && ips.length > 0
    ? `http://${ips[0]}:3000`
    : 'http://<IP-DES-RASPBERRY-PI>:3000';

  return (
    <div className="setup-guide">
      <div className="setup-guide-content">
        <h1>Welcome Screen – Einrichtung</h1>
        <p className="setup-intro">
          Es sind noch keine Bilder hinterlegt. So richten Sie das System ein:
        </p>
        <ol className="setup-steps">
          <li>Stellen Sie eine Verbindung zum gleichen WLAN wie dieser Raspberry Pi her.</li>
          <li>Öffnen Sie in einem Browser auf Ihrem Gerät die Admin-Oberfläche.</li>
          <li>Laden Sie Bilder oder PDFs hoch und speichern Sie die Einstellungen.</li>
          <li>Die Diashow startet automatisch, sobald Dateien vorhanden sind.</li>
        </ol>
        {ips && ips.length > 0 ? (
          <div className="setup-ip-box">
            <span className="setup-ip-label">Admin-Oberfläche im Browser öffnen:</span>
            <a href={baseUrl + '/admin'} className="setup-ip-link" target="_blank" rel="noopener noreferrer">
              {baseUrl}/admin
            </a>
            <span className="setup-ip-hint">IP-Adresse(n) dieses Geräts: {ips.join(', ')}</span>
          </div>
        ) : (
          <div className="setup-ip-box setup-ip-wait">
            <span className="setup-ip-label">Warten auf Netzwerkverbindung…</span>
            <span className="setup-ip-hint">Sobald der Pi mit dem Internet/WLAN verbunden ist, erscheint hier die Adresse.</span>
          </div>
        )}
        <p className="setup-footer">
          In den Einstellungen können Sie später wählen, stattdessen eine Uhr-Anzeige anzuzeigen.
        </p>
      </div>
    </div>
  );
}

export default SetupGuide;
