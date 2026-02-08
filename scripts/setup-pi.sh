#!/bin/bash

# Setup-Script für Raspberry Pi
# Dieses Script installiert alle notwendigen Abhängigkeiten und richtet das System ein

set -e

echo "=== Welcome Screen Setup für Raspberry Pi ==="
echo ""

# Prüfe ob Node.js installiert ist
if ! command -v node &> /dev/null; then
    echo "Node.js wird installiert..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "Node.js ist bereits installiert: $(node --version)"
fi

# Prüfe ob npm installiert ist
if ! command -v npm &> /dev/null; then
    echo "npm wird installiert..."
    sudo apt-get install -y npm
else
    echo "npm ist bereits installiert: $(npm --version)"
fi

# Installiere poppler-utils für PDF-Konvertierung
echo ""
echo "Poppler-utils wird installiert (für PDF-Konvertierung)..."
sudo apt-get update
sudo apt-get install -y poppler-utils

# Installiere PM2 für Prozess-Management
if ! command -v pm2 &> /dev/null; then
    echo ""
    echo "PM2 wird installiert..."
    sudo npm install -g pm2
else
    echo "PM2 ist bereits installiert"
fi

# Installiere Chromium falls nicht vorhanden
if ! command -v chromium-browser &> /dev/null && ! command -v chromium &> /dev/null; then
    echo ""
    echo "Chromium wird installiert..."
    sudo apt-get install -y chromium-browser || sudo apt-get install -y chromium
fi

echo ""
echo "=== Setup abgeschlossen ==="
echo ""
echo "Nächste Schritte:"
echo "1. Navigieren Sie zum Projektverzeichnis: cd $(pwd)"
echo "2. Installieren Sie die Abhängigkeiten: npm run install-all"
echo "3. Bauen Sie das Frontend: cd frontend && npm run build"
echo "4. Starten Sie den Server: cd ../backend && npm start"
echo "5. Testen Sie die Anwendung im Browser"
echo "6. Verwenden Sie scripts/start-kiosk.sh um den Browser im Kiosk-Modus zu starten"
echo "7. Richten Sie PM2 für Autostart ein: pm2 start ../backend/src/server.js --name welcome-screen"
echo "8. Speichern Sie PM2: pm2 save"
echo "9. Richten Sie PM2 Autostart ein: pm2 startup"
