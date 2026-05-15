# Welcome Screen Slideshow System

Ein vollständiges Slideshow-System für einen Welcome Screen im Eingangsbereich eines Unternehmens. Das System läuft auf einem Raspberry Pi 5 und ermöglicht die Konfiguration über ein separates Gerät im Netzwerk.

## Features

- **Vollbild-Slideshow**: Automatische Präsentation von Bildern und PDFs
- **PDF-Unterstützung**: PDFs werden automatisch in Bilder konvertiert (erste Seite)
- **Konfigurationsoberfläche**: Einfache Verwaltung über Web-Interface
- **Drag & Drop Upload**: Einfaches Hochladen von Dateien
- **Reihenfolge ändern**: Drag & Drop zum Sortieren der Slides
- **Einstellungen**: Konfigurierbares Zeitintervall und Übergangsdauer
- **Kiosk-Modus**: Automatischer Start im Vollbild-Modus

## Technologie-Stack

- **Backend**: Node.js mit Express
- **Frontend**: React mit Vite
- **PDF-Konvertierung**: pdf-poppler (poppler-utils)
- **Prozess-Management**: PM2

## Installation

### Voraussetzungen

- Raspberry Pi 5 mit Raspberry Pi OS
- Node.js 18+ und npm
- poppler-utils (für PDF-Konvertierung)
- Chromium Browser (für Kiosk-Modus)

### Schritt 1: Projekt klonen/kopieren

```bash
cd /home/pi
git clone <repository-url> amr_welcome_screen
cd amr_welcome_screen
```

### Schritt 2: Automatisches Setup (empfohlen)

```bash
chmod +x scripts/setup-pi.sh
./scripts/setup-pi.sh
```

Dieses Script installiert automatisch:
- Node.js und npm
- poppler-utils
- PM2
- Chromium

### Schritt 3: Manuelle Installation (falls Setup-Script nicht verwendet wird)

```bash
# Node.js installieren (falls nicht vorhanden)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# poppler-utils installieren
sudo apt-get update
sudo apt-get install -y poppler-utils

# PM2 installieren
sudo npm install -g pm2

# Chromium installieren
sudo apt-get install -y chromium-browser
```

### Schritt 4: Projekt-Abhängigkeiten installieren

```bash
# Installiere alle Abhängigkeiten
npm run install-all

# Oder manuell:
cd backend && npm install && cd ../frontend && npm install
```

### Schritt 5: Frontend bauen

```bash
cd frontend
npm run build
cd ..
```

### Schritt 6: Server starten

#### Entwicklung (manuell):

```bash
cd backend
npm start
```

#### Produktion (mit PM2):

```bash
# Starte mit PM2
pm2 start scripts/pm2-ecosystem.config.js

# Oder direkt:
cd backend
pm2 start src/server.js --name welcome-screen

# PM2 Status anzeigen
pm2 status

# Logs anzeigen
pm2 logs welcome-screen

# PM2 speichern (für Autostart)
pm2 save

# PM2 Autostart einrichten
pm2 startup
# Folgen Sie den Anweisungen
```

## Verwendung

### Display-Modus

Der Display-Modus zeigt die Slideshow im Vollbild an:

- **URL**: `http://<raspberry-pi-ip>:3000/display`
- Automatischer Wechsel zwischen Slides
- Fade-Übergänge zwischen Bildern

### Admin-Modus

Die Konfigurationsoberfläche ist über folgende URL erreichbar:

- **URL**: `http://<raspberry-pi-ip>:3000/admin`

**Funktionen:**
- Dateien hochladen (Drag & Drop oder Datei-Auswahl)
- Dateien löschen
- Reihenfolge ändern (Drag & Drop)
- Einstellungen anpassen (Zeitintervall, Übergangsdauer)

### Kiosk-Modus starten

```bash
# Standard-URL (localhost:3000/display)
./scripts/start-kiosk.sh

# Oder mit eigener URL
./scripts/start-kiosk.sh http://192.168.1.100:3000/display
```

## Autostart einrichten

### Option 1: PM2 + Autostart-Script

1. PM2 für Autostart konfigurieren:
```bash
pm2 start scripts/pm2-ecosystem.config.js
pm2 save
pm2 startup
```

2. Kiosk-Modus Autostart einrichten:

Erstellen Sie eine Desktop-Datei für den Autostart:

```bash
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/welcome-screen.desktop << EOF
[Desktop Entry]
Type=Application
Name=Welcome Screen
Exec=/home/pi/amr_welcome_screen/scripts/autostart-kiosk.sh
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF
```

### Option 2: Systemd Service (für Headless-Setup)

Erstellen Sie einen Systemd-Service:

```bash
sudo nano /etc/systemd/system/welcome-screen.service
```

Fügen Sie folgendes ein:

```ini
[Unit]
Description=Welcome Screen Slideshow
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/amr_welcome_screen
ExecStart=/usr/bin/node /home/pi/amr_welcome_screen/backend/src/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Aktivieren Sie den Service:

```bash
sudo systemctl enable welcome-screen.service
sudo systemctl start welcome-screen.service
```

## Konfiguration

### Server-Konfiguration

Die Konfiguration wird in `backend/config.json` gespeichert:

```json
{
  "slideInterval": 5000,
  "transitionDuration": 1000,
  "transitionType": "fade"
}
```

- **slideInterval**: Zeit in Millisekunden zwischen den Slides (Standard: 5000 = 5 Sekunden)
- **transitionDuration**: Dauer des Fade-Übergangs in Millisekunden (Standard: 1000 = 1 Sekunde)
- **transitionType**: Art des Übergangs (aktuell nur "fade" unterstützt)

Die Konfiguration kann über die Admin-Oberfläche geändert werden.

### Port ändern

Um den Port zu ändern, setzen Sie die Umgebungsvariable:

```bash
PORT=8080 npm start
```

Oder in der PM2-Konfiguration (`scripts/pm2-ecosystem.config.js`):

```javascript
env: {
  PORT: 8080
}
```

## API-Endpunkte

### Dateien

- `GET /api/files` - Liste aller Dateien
- `POST /api/upload` - Datei hochladen
- `GET /api/files/:id` - Datei abrufen
- `GET /api/files/:id/display` - Display-Version abrufen
- `DELETE /api/files/:id` - Datei löschen
- `PUT /api/files/order` - Reihenfolge aktualisieren

### Konfiguration

- `GET /api/config` - Konfiguration abrufen
- `PUT /api/config` - Konfiguration aktualisieren

## Unterstützte Dateiformate

- **Bilder**: JPG, JPEG, PNG, GIF, WEBP
- **PDFs**: PDF (erste Seite wird als Bild konvertiert)

Maximale Dateigröße: 50 MB

## Fehlerbehebung

### PDF-Konvertierung funktioniert nicht

Stellen Sie sicher, dass poppler-utils installiert ist:

```bash
sudo apt-get install -y poppler-utils
```

### Server startet nicht

1. Prüfen Sie die Logs:
```bash
pm2 logs welcome-screen
```

2. Prüfen Sie ob der Port bereits belegt ist:
```bash
sudo netstat -tulpn | grep 3000
```

3. Prüfen Sie die Node.js-Version:
```bash
node --version  # Sollte 18+ sein
```

### Kiosk-Modus startet nicht

1. Prüfen Sie ob Chromium installiert ist:
```bash
which chromium-browser || which chromium
```

2. Prüfen Sie ob der Server läuft:
```bash
curl http://localhost:3000/api/config
```

### Dateien werden nicht angezeigt

1. Prüfen Sie die Upload-Verzeichnisse:
```bash
ls -la backend/uploads/
ls -la backend/converted/
```

2. Prüfen Sie die Dateiberechtigungen:
```bash
chmod -R 755 backend/uploads backend/converted
```

## Projektstruktur

```
amr_welcome_screen/
├── backend/                 # Backend-Server
│   ├── src/
│   │   ├── server.js       # Express Server
│   │   ├── routes/         # API Routes
│   │   ├── services/       # Business Logic
│   │   └── middleware/     # Middleware
│   ├── uploads/            # Hochgeladene Dateien
│   ├── converted/          # Konvertierte PDFs
│   └── config.json         # Konfiguration
├── frontend/               # React Frontend
│   ├── src/
│   │   ├── components/     # React Komponenten
│   │   └── services/       # API Client
│   └── dist/               # Gebautes Frontend
├── scripts/                # Setup-Scripts
│   ├── setup-pi.sh         # Automatisches Setup
│   ├── start-kiosk.sh      # Kiosk-Modus starten
│   └── autostart-kiosk.sh   # Autostart-Script
└── README.md
```

## Entwicklung

### Entwicklungsserver starten

```bash
# Backend und Frontend gleichzeitig
npm run dev

# Oder einzeln:
npm run dev:backend  # Port 3000
npm run dev:frontend # Port 5173
```

### Frontend bauen

```bash
cd frontend
npm run build
```

Das gebaute Frontend wird in `frontend/dist/` gespeichert und automatisch vom Backend serviert.

## Lizenz

MIT

## Support

Bei Problemen oder Fragen erstellen Sie bitte ein Issue im Repository.
