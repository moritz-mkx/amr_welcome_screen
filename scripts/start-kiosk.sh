#!/bin/bash

# Startet Chromium im Kiosk-Modus für den Welcome Screen
# Die URL wird als Parameter übergeben oder verwendet den Standardwert

# Standard-URL (anpassen falls nötig)
DEFAULT_URL="http://localhost:3000/display"

# URL aus Parameter oder Standard verwenden
URL=${1:-$DEFAULT_URL}

# Prüfe ob Chromium installiert ist
if command -v chromium-browser &> /dev/null; then
    CHROMIUM_CMD="chromium-browser"
elif command -v chromium &> /dev/null; then
    CHROMIUM_CMD="chromium"
else
    echo "Fehler: Chromium ist nicht installiert!"
    echo "Installieren Sie es mit: sudo apt-get install chromium-browser"
    exit 1
fi

# Starte Chromium im Kiosk-Modus
echo "Starte Chromium im Kiosk-Modus mit URL: $URL"

# Optionen:
# --kiosk: Vollbild-Modus ohne UI
# --noerrdialogs: Keine Fehlerdialoge
# --disable-infobars: Keine Info-Bars
# --autoplay-policy=no-user-gesture-required: Autoplay erlauben
# --disable-features=TranslateUI: Übersetzungs-UI deaktivieren
# --disable-session-crashed-bubble: Keine Crash-Meldungen
# --disable-restore-session-state: Keine Session-Wiederherstellung

$CHROMIUM_CMD \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --autoplay-policy=no-user-gesture-required \
    --disable-features=TranslateUI \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --disable-web-security \
    --disable-features=VizDisplayCompositor \
    "$URL" &

echo "Chromium wurde gestartet. PID: $!"
echo "Drücken Sie Ctrl+C um zu beenden (oder schließen Sie das Fenster)"
