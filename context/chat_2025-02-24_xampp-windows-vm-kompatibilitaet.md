# Chat: XAMPP / Windows-VM Kompatibilität

**Chat-ID:** dfd8edf6-fa26-49f2-8a88-4606186283ca  
**Datum:** 2025-02-24  

---

## User

Kann ich diese Software auch auf einem XAMPP-Client laufen lassen, der auf einer Windows-VM läuft?

---

## Assistant

### Kurze Antwort

**Ja, grundsätzlich kannst du die Software auch auf einer Windows-VM mit XAMPP laufen lassen – aber XAMPP selbst ist dafür nicht wirklich nötig und ein paar Dinge musst du anpassen.**

### Etwas detaillierter

- **Technologie-Stack**
  - Backend: Node.js + Express (`backend/src/server.js`)
  - Frontend: React + Vite, wird zu statischen Dateien gebaut und vom Node-Backend ausgeliefert
  - Optional: PM2, Kiosk-Skripte, `poppler-utils` für PDF-Konvertierung

- **Was das bedeutet für Windows/XAMPP**
  - XAMPP bringt Apache + PHP + MySQL mit, aber dein Projekt nutzt **Node.js**, keinen PHP-Apache-Stack.
  - Du kannst das Projekt auf einer Windows-VM so betreiben:
    1. **Node.js 18+ für Windows installieren**
    2. In `backend` und `frontend` jeweils `npm install` ausführen (oder `npm run install-all`, wenn du das Skript auch unter Windows nutzt).
    3. Im `frontend` `npm run build` ausführen.
    4. Backend starten: `cd backend && npm start` (bzw. ein eigenes Windows-Äquivalent zu PM2 wie `pm2-windows-service` oder einfach per Task Scheduler o.ä.).
  - **XAMPP ist nur dann relevant**, wenn du z.B. über Apache einen Reverse Proxy vor dein Node-Backend setzen willst. Der eigentliche Server bleibt aber Node, nicht Apache/PHP.

- **PDF-Konvertierung unter Windows**
  - Du brauchst ein Pendant zu `poppler-utils` (z.B. Poppler for Windows), und musst sicherstellen, dass die `pdf-poppler`-Library den Pfad zu den Binaries kennt.
  - Das ist machbar, aber nicht „out of the box" wie im README für Raspberry Pi beschrieben – du musst das auf Windows manuell installieren/konfigurieren.

- **Kiosk-Modus**
  - Die `start-kiosk.sh`/`autostart-kiosk.sh`-Skripte sind Linux/Raspberry-Pi-spezifisch.
  - Unter Windows würdest du den Kiosk-Modus mit:
    - einem Browser im Vollbild (z.B. Chrome/Edge mit passender Commandline) und
    - Autostart über Aufgabenplanung/Autostart-Ordner
    nachbauen.

### Fazit

- **Ja, die Anwendung selbst kann auf einer Windows-VM laufen.**
- **Nein, sie läuft nicht „in XAMPP"**, sondern parallel dazu als eigener Node-Server.
- Wichtig ist: **Node.js + `pdf-poppler`/Poppler für Windows einrichten; Kiosk-Start musst du windows-spezifisch lösen.**

Wenn du willst, kann ich dir Schritt-für-Schritt sagen, welche Befehle du auf der Windows-VM ausführen musst und wie du Poppler dort einrichtest.
