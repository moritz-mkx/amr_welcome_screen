#!/bin/bash

# Autostart-Script für den Kiosk-Modus
# Dieses Script kann in der Autostart-Konfiguration des Raspberry Pi verwendet werden
# z.B. in ~/.config/autostart/welcome-screen.desktop oder in /etc/xdg/autostart/

# Warte bis der Server läuft (maximal 60 Sekunden)
MAX_WAIT=60
WAIT_COUNT=0
URL="http://localhost:3000/display"

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if curl -s "$URL" > /dev/null 2>&1; then
        echo "Server ist bereit!"
        break
    fi
    echo "Warte auf Server... ($WAIT_COUNT/$MAX_WAIT)"
    sleep 2
    WAIT_COUNT=$((WAIT_COUNT + 2))
done

# Starte Kiosk-Modus
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/start-kiosk.sh" "$URL"
