# Welcome Screen Slideshow System (PHP-Version)

Ein Slideshow-System für einen Welcome Screen im Eingangsbereich.
Läuft auf einem Raspberry Pi mit **Apache + PHP**; ein Chromium im
Kiosk-Modus zeigt die Display-Seite an, die Konfiguration läuft im
Browser eines beliebigen Geräts im LAN.

> Das System wurde von Node/Express + React auf Apache + PHP portiert.
> Der alte Node-/React-Code liegt zur Referenz in [`alt/`](./alt/) und ist
> dort separat dokumentiert ([alt/README.md](./alt/README.md)).

## Features

- **Vollbild-Slideshow** mit Fade-Übergängen
- **PDF-Unterstützung** (erste Seite wird automatisch konvertiert)
- **Videos** (MP4, WEBM)
- **Konfigurations-Oberfläche** im Browser (Datei-Upload, Reihenfolge, Sichtbarkeit, Einstellungen, Zeitplan, Uhr-Screen)
- **Drag&Drop-Editor** für den Uhr-Screen (Uhrzeit, Datum, Texte, Logo, Bilder) via GridStack.js
- **Zeitplan** (einmalig / täglich / wöchentlich) übernimmt zeitgesteuert ein anderes Medium
- **Kiosk-Modus** auf dem Pi (Chromium im Vollbild)

## Tech-Stack

- **Webserver:** Apache 2.4 mit `mod_php`
- **Sprache:** PHP 8.1+
- **Frontend:** klassisches HTML + Vanilla JS + CSS, kein Build-Step. Zusätzlich GridStack.js (Drag&Drop-Raster) und SortableJS (Listen-Sortierung) als statische Assets.
- **PDF-Konvertierung:** `poppler-utils` (`pdftoppm`)
- **Persistenz:** JSON-Dateien in `data/` (config, files, schedules)
- **Browser:** Chromium im Kiosk-Modus

## Projektstruktur

```text
amr_welcome_screen/
├── public/                  # DocumentRoot von Apache
│   ├── index.php            # Display-Seite (Slideshow / Uhr / SetupGuide)
│   ├── admin.php            # Konfigurations-Panel
│   ├── api/                 # REST-Endpunkte (files, config, schedules, upload, …)
│   ├── assets/
│   │   ├── js/              # display.js, admin.js, renderWidget.js, libs/
│   │   └── css/
│   └── media/               # öffentlich erreichbare Mediendateien
│       ├── uploads/         # hochgeladene Bilder/Videos/PDFs
│       ├── converted/       # automatisch erzeugte PDF-Seite-1-Bilder
│       └── static/          # Logo + Widget-Bilder
├── data/                    # NICHT im DocumentRoot, nur PHP liest/schreibt
│   ├── config.json
│   ├── files.json
│   └── schedules.json
├── lib/                     # PHP-Helper (JSON-IO, Auth, Validierung, Pfade)
├── deploy/
│   ├── apache-welcome-screen.conf   # Vhost-Vorlage
│   └── htaccess-media               # .htaccess für media/ (deaktiviert PHP)
├── scripts/
│   ├── setup-apache.sh              # Pi-Setup: Pakete + Vhost + Rechte
│   ├── migrate-from-node.php        # Daten/Medien aus altem Node-System übernehmen
│   ├── start-kiosk.sh               # Chromium im Kiosk-Modus starten
│   └── autostart-kiosk.sh
└── alt/                     # Archiv: altes Node/Express + React/Vite System
    ├── README.md            # Doku der alten Node-Version (Referenz)
    ├── backend/             # Express-Server, Routes, Services
    ├── frontend/            # React/Vite-Quellen
    ├── package.json         # Root-npm-Scripts (install-all, dev, build)
    └── scripts/             # pm2-ecosystem.config.js, setup-pi.sh
```

## Installation auf dem Raspberry Pi

### Voraussetzungen

- Raspberry Pi 4 oder 5 mit Raspberry Pi OS (Bookworm)
- SSH-Zugriff oder direkter Tastatur-/Maus-Zugriff
- Aktive Internet-Verbindung (für `apt-get install` und den initialen Klon)
- Mindestens 8 GB freier SD-Karten-Speicher

Welche Variante? Such dir aus, was auf dich zutrifft:

- **Variante A** — frischer Pi, noch nichts installiert → [hier weiterlesen](#variante-a--frischer-pi)
- **Variante B** — Pi läuft schon mit dem alten Node-System → [hier weiterlesen](#variante-b--migration-vom-node-system)

---

### Variante A — frischer Pi

#### A.1 Vorbereitung am eigenen Rechner

```bash
# Pi-IP herausfinden (oder via Router-Web-Oberfläche, Hostname `raspberrypi.local`).
ping raspberrypi.local

# Per SSH einloggen (User-Name ist der bei Pi-OS-Setup vergebene):
ssh <user>@raspberrypi.local
```

#### A.2 Repo klonen

```bash
cd ~
git clone <repo-url> amr_welcome_screen
cd amr_welcome_screen
```

#### A.3 Apache + PHP + SSH einrichten

```bash
sudo ./scripts/setup-apache.sh
```

Das Skript erledigt in einem Rutsch:

1. installiert `apache2`, `libapache2-mod-php`, `php-cli`, `poppler-utils`, `openssh-server`
2. legt den Symlink `/var/www/welcome-screen → <repo>` an
3. installiert den Vhost (`welcome-screen.conf`) und deaktiviert die Default-Site
4. setzt die `.htaccess` für `public/media/` (deaktiviert PHP in Upload-Verzeichnissen)
5. setzt Schreibrechte für `www-data` auf `data/` und `public/media/`
6. aktiviert und startet den SSH-Server (damit SFTP funktioniert)
7. lädt Apache neu

Am Ende zeigt das Skript die IP-Adresse(n) des Pi sowie die nächsten Schritte an.

> **Optional:** Wenn du Dateien per SFTP **direkt** nach `public/media/uploads/` schreiben können willst, rufe stattdessen `sudo ./scripts/setup-apache.sh --sftp-write` auf. Das fügt deinen User zur Gruppe `www-data` hinzu und setzt das `setgid`-Bit. Details: siehe Abschnitt [SFTP-Zugriff](#sftp-zugriff). **Default-Workflow ist und bleibt das Admin-Panel-Upload** — siehe Hinweisbox dort.

#### A.4 Funktion prüfen

```bash
hostname -I        # liefert die IP, z. B. 192.168.1.42
```

Im Browser auf einem anderen Gerät im LAN:

- Display:        `http://<ip>/`
- Konfiguration:  `http://<ip>/admin.php`

#### A.5 Kiosk-Browser einrichten (auf dem Pi)

Sicherstellen, dass Chromium installiert ist:

```bash
sudo apt-get install -y chromium-browser || sudo apt-get install -y chromium
```

Einmalig manuell starten (zum Testen):

```bash
./scripts/start-kiosk.sh
```

Autostart so einrichten, dass beim Boot der Browser im Vollbild startet:

```bash
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/welcome-screen.desktop << EOF
[Desktop Entry]
Type=Application
Name=Welcome Screen
Exec=$HOME/amr_welcome_screen/scripts/autostart-kiosk.sh
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF
```

`autostart-kiosk.sh` wartet bis zu 60 s auf `http://localhost/` und ruft dann `start-kiosk.sh` auf.

#### A.6 Reboot-Test

```bash
sudo reboot
```

Nach dem Neustart sollte:
- Apache automatisch laufen (als systemd-Dienst)
- Chromium im Vollbild die Display-Seite zeigen (SetupGuide mit IP-Anzeige, weil noch keine Dateien hochgeladen sind)
- SSH/SFTP auf Port 22 erreichbar sein

Jetzt kannst du im Admin-Panel auf einem anderen Gerät Dateien hochladen.

---

### Variante B — Migration vom Node-System

Du hast bereits einen laufenden Pi mit dem alten Node-/React-System (PM2 + Port 3000) und willst auf die PHP-Version umziehen. Mache **vorher unbedingt ein Backup** der Daten.

#### B.1 Backup anlegen

Per SSH auf dem alten Pi:

```bash
cd ~/amr_welcome_screen
mkdir -p ~/welcome-screen-backup
cp -r backend/uploads     ~/welcome-screen-backup/
cp -r backend/converted   ~/welcome-screen-backup/ 2>/dev/null || true
cp -r backend/static      ~/welcome-screen-backup/ 2>/dev/null || true
cp backend/config.json    ~/welcome-screen-backup/ 2>/dev/null || true
cp backend/files-metadata.json ~/welcome-screen-backup/ 2>/dev/null || true
cp backend/schedules.json ~/welcome-screen-backup/ 2>/dev/null || true
ls -la ~/welcome-screen-backup/
```

Optional: das Backup auf einen anderen Rechner ziehen (per `scp` oder SFTP), damit du es notfalls außerhalb des Pi hast.

#### B.2 Altes Node-System stoppen

```bash
# PM2 stoppen und aus dem Autostart entfernen.
pm2 stop welcome-screen
pm2 delete welcome-screen
pm2 save
sudo pm2 unstartup systemd

# (Optional) PM2 selbst deinstallieren:
sudo npm uninstall -g pm2
```

Falls der Kiosk-Autostart auf `welcome-screen.desktop` zeigt — den lassen wir, der wird in B.6 durch die neue URL weiterverwendet.

#### B.3 Repo auf den neuen Stand bringen

```bash
cd ~/amr_welcome_screen
git fetch origin
git status                    # sollte clean sein, oder du sicherst lokale Aenderungen
git pull
```

Nach dem Pull sind die alten `backend/` und `frontend/` automatisch in `alt/` verschoben, das PHP-System liegt unter `public/`, `lib/`, `data/`, `deploy/`.

#### B.4 PHP-System einrichten

```bash
sudo ./scripts/setup-apache.sh
```

Wenn du **direkt per SFTP** in `public/media/uploads/` schreiben können willst (siehe Abschnitt [SFTP-Zugriff](#sftp-zugriff)), nutze:

```bash
sudo ./scripts/setup-apache.sh --sftp-write
```

#### B.5 Daten migrieren

Da `backend/` jetzt unter `alt/backend/` liegt, findet das Migrationsskript die Daten automatisch:

```bash
# 1) Erst anschauen, was passieren würde:
sudo -u www-data php scripts/migrate-from-node.php --dry-run

# 2) Wenn die Ausgabe stimmt, scharf schalten:
sudo -u www-data php scripts/migrate-from-node.php
```

Falls dein Backup an einer anderen Stelle liegt:

```bash
sudo -u www-data php scripts/migrate-from-node.php --source ~/welcome-screen-backup
```

Der Lauf ist idempotent — bestehende Dateien in `public/media/` werden nicht überschrieben (außer mit `--force`). JSON-Zieldateien werden vor dem Überschreiben als `<name>.bak` gesichert.

#### B.6 Kiosk-URL aktualisieren

Die Kiosk-Skripte zeigen ab jetzt auf `http://localhost/` (Apache, Port 80) statt `http://localhost:3000/display`. Wenn du `scripts/start-kiosk.sh` über die Autostart-Desktop-Datei aufrufst, wird die neue URL automatisch übernommen — du musst nichts manuell ändern.

Falls du in `~/.config/autostart/welcome-screen.desktop` eine **explizite URL** hinterlegt hast (z. B. `Exec=.../start-kiosk.sh http://localhost:3000/display`), passe sie an oder lass das Argument weg, damit der Default greift:

```bash
$EDITOR ~/.config/autostart/welcome-screen.desktop
# Exec=/home/<user>/amr_welcome_screen/scripts/autostart-kiosk.sh
```

#### B.7 Testen + Reboot

```bash
# Im Browser auf einem anderen Geraet:
#   Display:        http://<pi-ip>/
#   Konfiguration:  http://<pi-ip>/admin.php
# Auf dem Pi:
curl -s http://localhost/api/config.php | head -c 200    # sollte JSON liefern
```

Wenn alles stimmt:

```bash
sudo reboot
```

Nach dem Neustart sollte der Kiosk-Browser automatisch die neue Display-Seite zeigen.

#### B.8 Aufräumen (optional)

Wenn du sicher bist, dass alles funktioniert:

```bash
# Node-Modules aus dem Archiv entfernen (sparen ~200 MB):
rm -rf alt/backend/node_modules alt/frontend/node_modules

# Falls du `alt/` komplett loswerden willst (NICHT empfohlen — bleib lieber bei der Archiv-Variante):
# rm -rf alt/
```

---

## SFTP-Zugriff

Der `setup-apache.sh`-Schritt aktiviert bereits den SSH-Server. Damit hast du automatisch **SFTP-Zugriff** auf den Pi — ohne dass du eine zusätzliche Software installieren musst. Jeder gängige SFTP-Client (FileZilla, Cyberduck, WinSCP, Transmit, OpenSSH-`sftp`) funktioniert direkt.

### Verbinden

| Feld       | Wert                                       |
|---|---|
| Protokoll  | **SFTP** (NICHT FTP)                       |
| Host       | `<pi-ip>` oder `raspberrypi.local`         |
| Port       | `22`                                       |
| Benutzer   | dein Pi-User (z. B. `pi` oder selbst angelegter Name) |
| Passwort   | Pi-Passwort *(oder besser: SSH-Key)*       |

Befehlszeile zum Testen:

```bash
sftp <user>@<pi-ip>
# Im sftp-Prompt:
sftp> pwd        # /home/<user>
sftp> ls
sftp> put datei.png             # lädt nach /home/<user>/
sftp> bye
```

### Wo lädst du Dateien hin?

Nach dem Login landest du in deinem Home-Verzeichnis (`/home/<user>/`). Von dort hast du **lesenden** Zugriff auf das ganze System.

**Beschreibbar mit Default-Setup** (ohne `--sftp-write`):

- `/home/<user>/` — dein Home-Verzeichnis. Geeignet für Backups, Logs, Config-Dateien.

**Nur lesbar mit Default-Setup**:

- `/var/www/welcome-screen/data/` — JSON-Konfiguration. Lesen ok, Schreiben darf nur `www-data`.
- `/var/www/welcome-screen/public/media/` — Mediendateien (Bilder, Videos, PDFs).

### Wenn du Slideshow-Dateien per SFTP hochladen willst

> **Wichtig**: Auch wenn du eine Datei direkt nach `public/media/uploads/` kopierst, **erscheint sie nicht automatisch in der Slideshow**. Das System verwaltet eine eigene Metadaten-Liste (`data/files.json`) mit ID, Dateityp, Größe und Sichtbarkeit. Diese Liste wird **nur** vom Admin-Panel-Upload (`/api/upload.php`) gepflegt.
>
> **Empfohlener Workflow**: Lade Bilder/Videos/PDFs über das Admin-Panel hoch (Tab „Dateien"). Dort funktionieren:
> - Multi-Upload mit Live-Progress
> - automatische PDF-Konvertierung
> - sichere MIME-Type-Validierung
> - sortierbare Reihenfolge
> - Sichtbarkeit umschalten

Für **Spezialfälle** (z. B. eine bestehende Bildsammlung in einem Rutsch transferieren) kannst du `--sftp-write` beim Setup nutzen, damit dein User in `public/media/uploads/` schreiben darf. Anschließend musst du die Dateien aber trotzdem einmalig über das Admin-Panel hinzufügen, damit `data/files.json` die Metadaten kennt — dafür gibt es aktuell **keine** „Sync"-Funktion. Sprich mich gerne an, wenn du so eine Funktion willst (kleines Feature, kann ich nachrüsten).

### SSH-Key statt Passwort (optional, empfohlen)

Sicherer und bequemer als Passwort-Login:

```bash
# Auf deinem eigenen Rechner einen Key erzeugen (falls noch keiner da):
ssh-keygen -t ed25519 -C "welcome-screen-pi"

# Public Key zum Pi kopieren:
ssh-copy-id <user>@<pi-ip>

# Test: sollte ohne Passwort funktionieren:
ssh <user>@<pi-ip>
```

### Hinweis: klassisches FTP (Port 21)

Klassisches FTP ist auf dem Pi **nicht aktiv** — und das ist Absicht. Es überträgt Benutzernamen und Passwörter im Klartext und ist auch im LAN unnötig riskant. Wenn du es wirklich brauchst (z. B. weil ein Legacy-Client kein SFTP kann), kannst du es manuell mit `vsftpd` einrichten:

```bash
sudo apt-get install -y vsftpd
sudo systemctl enable --now vsftpd
sudo nano /etc/vsftpd.conf       # write_enable=YES, local_enable=YES
sudo systemctl restart vsftpd
```

Eine sicherere Variante ist FTPS (FTP über TLS) — bei vsftpd via `ssl_enable=YES` plus Zertifikat. Wenn du diesen Weg brauchst, sag Bescheid, dann ergänze ich eine ausführliche Anleitung mit Zertifikat-Erstellung.

---

## Entwicklung (auf macOS/Linux ohne Apache)

Das PHP-Built-in-Server reicht für lokales Entwickeln:

```bash
php -S localhost:8000 -t public
```

Browser: <http://localhost:8000/>. Datei-Uploads landen in `public/media/uploads/`,
die JSON-Daten in `data/`.

## Konfiguration

### PHP-Limits

Die Upload-Limits stehen im Vhost-File (`deploy/apache-welcome-screen.conf`),
nicht in der globalen `php.ini`:

```apache
php_value upload_max_filesize 510M
php_value post_max_size 520M
php_value max_execution_time 300
php_value max_input_time 300
php_value memory_limit 512M
```

Anpassen → `sudo systemctl reload apache2`.

Anwendungsseitige Limits (in `lib/paths.php`):

- Slideshow-Dateien (Bilder/Videos/PDFs): **500 MB**
- Logo-Bild: **5 MB**
- Widget-Bild/-Video: **100 MB**

### Datenformat

- `data/config.json` — Slide-Intervall, Übergänge, Uhr-Widgets, Bildschirm-Orientierung
- `data/files.json` — Liste der hochgeladenen Dateien (id, filename, type, …)
- `data/schedules.json` — Zeitpläne (once / daily / weekly)

Jede Schreiboperation nutzt `flock()` und schreibt atomar
(`tmp-file` + `rename()`), damit parallele Admin-Tabs nicht in Race-Conditions laufen.

### Sicherheit

- `data/` liegt **außerhalb** des DocumentRoots → nicht über HTTP erreichbar.
- `public/media/` hat eine `.htaccess`, die `mod_php` für dieses Verzeichnis deaktiviert. So kann eine als Bild getarnte `.php`-Datei nicht ausgeführt werden.
- Upload-Validierung erfolgt server-seitig per `finfo_file()` (echter MIME-Type), nicht über die Datei-Endung.

> Die Admin-Seite ist absichtlich **nicht** authentifiziert (LAN-only).
> Wenn das System aus dem Internet erreichbar gemacht wird, **muss** vor
> Inbetriebnahme HTTP-Basic-Auth oder eine andere Auth nachgerüstet werden.

## Migrations-Historie

Das Repo wurde in sechs Etappen von Node/Express + React auf Apache + PHP portiert.

| Etappe | Inhalt | Status |
|---|---|---|
| 1 | Grundgerüst, Migration, Apache-Vorlagen, README | ✅ erledigt |
| 2 | PHP-API-Endpunkte (Files, Config, Schedules, Upload, PDF-Konvertierung) | ✅ erledigt |
| 3 | Display-Seite mit Slideshow, Schedule-Takeover, ClockScreen, SetupGuide | ✅ erledigt |
| 4 | Admin-Tabs „Dateien", „Einstellungen", „Planung" | ✅ erledigt |
| 5 | Admin-Tab „Uhr-Screen" mit GridStack.js | ✅ erledigt |
| 6 | Aufräumen: altes System nach `alt/` verschoben, Kiosk-URLs aktualisiert | ✅ erledigt |

### API-Endpunkte

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/files.php` | Liste aller Dateien (mit `url` und `displayUrl`) |
| GET | `/api/files.php?id=<id>` | 302-Redirect auf die Original-Datei |
| GET | `/api/files.php?id=<id>&display=1` | 302-Redirect auf Anzeigeversion (PDF→PNG) |
| DELETE | `/api/files.php?id=<id>` | Eintrag + Datei löschen, Schedules cascade |
| PUT | `/api/files.php?id=<id>&action=toggle-hidden` | Sichtbarkeit umschalten |
| PUT | `/api/files-order.php` | Reihenfolge (Body `{ fileIds: [...] }`) |
| GET / PUT | `/api/config.php` | Konfiguration lesen / partiell aktualisieren |
| POST | `/api/upload.php` | Datei-Upload (Feld `file`), automatische PDF-Konvertierung |
| GET | `/api/logo.php` | 302-Redirect auf das aktuelle Logo |
| POST | `/api/config-logo.php` | Logo-Upload (Feld `logo`, ersetzt vorhandenes) |
| POST | `/api/widget-media.php` | Widget-Medium hochladen (Feld `media` oder `image`) |
| GET / DELETE | `/api/widget-image.php?id=widget-<uuid>.<ext>` | Widget-Medium abrufen / löschen |
| GET | `/api/system-ip.php` | IPv4-Adressen des Servers |
| GET / POST | `/api/schedules.php` | Schedules listen / anlegen |
| PUT / DELETE | `/api/schedules.php?id=<id>` | Schedule aktualisieren / löschen |
| GET | `/api/active-schedule.php` | Aktuell aktiver Schedule + zugehörige Datei |

## Lizenz

MIT
