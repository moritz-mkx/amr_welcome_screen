#!/bin/bash

# Startet Chromium im Kiosk-Modus für den Welcome Screen
# Die URL wird als Parameter übergeben oder verwendet den Standardwert

# Standard-URL (anpassen falls nötig).
# PHP-Version: die Display-Seite ist die Root-URL des Apache-Vhosts.
DEFAULT_URL="http://localhost/"

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

# Chromium-Flags:
#   --kiosk                                  Vollbild ohne UI
#   --noerrdialogs                           keine modalen Error-Dialoge
#   --disable-infobars                       keine Info-Bars
#   --autoplay-policy=no-user-gesture-required  Video-Autoplay erlauben (Slideshow!)
#   --disable-features=TranslateUI           kein Translate-Banner
#   --disable-session-crashed-bubble         kein "Chrome ist nicht ordnungsgemaess beendet"-Popup
#   --disable-restore-session-state          keine Tabs aus letzter Sitzung
#   --no-first-run                           kein First-Run-Wizard
#   --check-for-update-interval=31536000     ein Jahr keine Update-Checks
#   --password-store=basic                   keine Keyring-Popups
#   --overscroll-history-navigation=0        keine Touch-Gesten fuer Zurueck/Vor
#   --disable-pinch                          kein Pinch-Zoom
#
# Bewusst entfernt (vorher drin, aber unnoetig/schaedlich):
#   --disable-web-security        - schaltet Same-Origin-Schutz aus, hier ueberfluessig
#   --disable-features=VizDisplayCompositor - Legacy-Workaround, kann auf modernem Chromium Crashes verursachen

$CHROMIUM_CMD \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --autoplay-policy=no-user-gesture-required \
    --disable-features=TranslateUI \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --no-first-run \
    --check-for-update-interval=31536000 \
    --password-store=basic \
    --overscroll-history-navigation=0 \
    --disable-pinch \
    "$URL" &

echo "Chromium wurde gestartet. PID: $!"
echo "Drücken Sie Ctrl+C um zu beenden (oder schließen Sie das Fenster)"
