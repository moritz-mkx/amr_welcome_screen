#!/bin/bash
#
# Setup-Skript fuer Raspberry Pi: installiert Apache + PHP + poppler-utils
# und richtet den Welcome-Screen-Vhost ein. Aktiviert ausserdem den SSH-
# Server, ueber den SFTP-Zugriff erfolgt.
#
# Aufruf (aus dem Repo-Root):
#     sudo ./scripts/setup-apache.sh [--sftp-write]
#
# Optionale Flags:
#   --sftp-write   Den User, der das Skript aufruft (via $SUDO_USER), zur
#                  Gruppe `www-data` hinzufuegen, damit er per SFTP direkt
#                  nach public/media/uploads/ und data/ schreiben darf.
#                  ACHTUNG: SFTP-hochgeladene Slideshow-Dateien tauchen
#                  erst nach einem regulaeren Upload-API-Aufruf in der
#                  Slideshow auf. Fuer den Standard-Workflow ist das
#                  Admin-Panel-Upload der richtige Weg.
#
# Voraussetzungen:
#   - Raspberry Pi OS (Bookworm) oder Debian/Ubuntu
#   - sudo-Rechte
#
# Was passiert:
#   1) apt-Pakete installieren (apache2, libapache2-mod-php, php-cli,
#      poppler-utils, openssh-server)
#   2) Symlink /var/www/welcome-screen -> Repo-Verzeichnis
#   3) Vhost-Conf nach /etc/apache2/sites-available/welcome-screen.conf kopieren
#   4) Default-Site deaktivieren, neuen Vhost aktivieren
#   5) public/media/.htaccess aus Vorlage kopieren
#   6) Schreibrechte fuer www-data setzen (public/media/, data/)
#      Optional bei --sftp-write: setgid + User-zur-Gruppe
#   7) SSH-Server aktivieren und starten (fuer SFTP)
#   8) Apache reloaden
#
# Hinweis: dieses Skript veraendert keine globale php.ini.
# PHP-Limits (upload_max_filesize etc.) stehen im Vhost-File.

set -euo pipefail

# --- Argumente parsen ---------------------------------------------------
SFTP_WRITE=0
for arg in "$@"; do
    case "$arg" in
        --sftp-write) SFTP_WRITE=1 ;;
        -h|--help)
            sed -n '2,25p' "$0"
            exit 0 ;;
        *)
            echo "Unbekannte Option: $arg" >&2
            echo "Aufruf: $0 [--sftp-write]" >&2
            exit 1 ;;
    esac
done

# --- Pfade ---------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGET_LINK="/var/www/welcome-screen"
VHOST_SRC="${REPO_DIR}/deploy/apache-welcome-screen.conf"
VHOST_DST="/etc/apache2/sites-available/welcome-screen.conf"
HTACCESS_SRC="${REPO_DIR}/deploy/htaccess-media"
HTACCESS_DST="${REPO_DIR}/public/media/.htaccess"

# --- Sudo-Check ----------------------------------------------------------
if [[ $EUID -ne 0 ]]; then
    echo "Fehler: bitte mit sudo ausfuehren." >&2
    echo "  Beispiel:  sudo $0 ${*:-}" >&2
    exit 1
fi

echo "=== Welcome-Screen Apache-Setup ==="
echo "Repo:          ${REPO_DIR}"
echo "Symlink-Ziel:  ${TARGET_LINK} -> ${REPO_DIR}"
if [[ ${SFTP_WRITE} -eq 1 ]]; then
    echo "SFTP-Write:    AKTIV (User wird zur Gruppe www-data hinzugefuegt)"
fi
echo ""

# --- 1) Pakete installieren ---------------------------------------------
echo "[1/8] Pakete installieren..."
apt-get update
apt-get install -y \
    apache2 \
    libapache2-mod-php \
    php-cli \
    poppler-utils \
    openssh-server

# --- 2) Symlink anlegen --------------------------------------------------
echo ""
echo "[2/8] Symlink ${TARGET_LINK} anlegen..."
if [[ -L "${TARGET_LINK}" ]]; then
    CURRENT="$(readlink -f "${TARGET_LINK}")"
    if [[ "${CURRENT}" == "${REPO_DIR}" ]]; then
        echo "  bereits korrekt verlinkt."
    else
        echo "  bestehender Symlink zeigt auf ${CURRENT}, wird ersetzt."
        rm "${TARGET_LINK}"
        ln -s "${REPO_DIR}" "${TARGET_LINK}"
    fi
elif [[ -e "${TARGET_LINK}" ]]; then
    echo "Fehler: ${TARGET_LINK} existiert bereits und ist kein Symlink." >&2
    echo "Bitte manuell pruefen/entfernen." >&2
    exit 1
else
    ln -s "${REPO_DIR}" "${TARGET_LINK}"
    echo "  Symlink angelegt."
fi

# --- 3) Vhost installieren -----------------------------------------------
echo ""
echo "[3/8] Vhost-Datei installieren..."
if [[ ! -f "${VHOST_SRC}" ]]; then
    echo "Fehler: Vhost-Vorlage nicht gefunden: ${VHOST_SRC}" >&2
    exit 1
fi
cp "${VHOST_SRC}" "${VHOST_DST}"
echo "  ${VHOST_DST} aktualisiert."

# --- 4) Sites umschalten -------------------------------------------------
echo ""
echo "[4/8] Default-Site deaktivieren, Welcome-Screen aktivieren..."
if a2query -s 000-default >/dev/null 2>&1; then
    a2dissite 000-default.conf >/dev/null
    echo "  000-default deaktiviert."
fi
a2ensite welcome-screen.conf >/dev/null
echo "  welcome-screen aktiviert."

# Optionale Module (Rewrite ist harmlos und oft nuetzlich).
a2enmod rewrite >/dev/null

# --- 5) .htaccess fuer media/ --------------------------------------------
echo ""
echo "[5/8] public/media/.htaccess installieren..."
if [[ ! -f "${HTACCESS_SRC}" ]]; then
    echo "Fehler: .htaccess-Vorlage nicht gefunden: ${HTACCESS_SRC}" >&2
    exit 1
fi
mkdir -p "$(dirname "${HTACCESS_DST}")"
cp "${HTACCESS_SRC}" "${HTACCESS_DST}"
echo "  ${HTACCESS_DST} geschrieben."

# --- 6) Schreibrechte setzen --------------------------------------------
echo ""
echo "[6/8] Schreibrechte setzen..."

mkdir -p "${REPO_DIR}/data" \
         "${REPO_DIR}/public/media/uploads" \
         "${REPO_DIR}/public/media/converted" \
         "${REPO_DIR}/public/media/static/widgets"

# Eigentuemer ist immer www-data (Apache schreibt die Dateien).
chown -R www-data:www-data \
    "${REPO_DIR}/data" \
    "${REPO_DIR}/public/media"

if [[ ${SFTP_WRITE} -eq 1 ]]; then
    # --sftp-write: Gruppenrechte erweitern + setgid-Bit setzen, damit neue
    # Dateien (auch per SFTP angelegte) automatisch in der www-data-Gruppe
    # landen und vom Apache gelesen werden koennen.
    chmod -R u+rwX,g+rwX,o+rX \
        "${REPO_DIR}/data" \
        "${REPO_DIR}/public/media"
    # setgid auf Verzeichnissen: neue Dateien erben die Gruppe (www-data).
    find "${REPO_DIR}/data" "${REPO_DIR}/public/media" -type d \
        -exec chmod g+s {} +

    # Den User, der sudo aufruft, zur www-data-Gruppe hinzufuegen.
    SFTP_USER="${SUDO_USER:-}"
    if [[ -z "${SFTP_USER}" || "${SFTP_USER}" == "root" ]]; then
        echo "  Warnung: kein nicht-root User ueber \$SUDO_USER ermittelbar."
        echo "  Bitte manuell ausfuehren:  sudo usermod -a -G www-data <user>"
    else
        if id -nG "${SFTP_USER}" | tr ' ' '\n' | grep -qx www-data; then
            echo "  User '${SFTP_USER}' ist bereits in der Gruppe www-data."
        else
            usermod -a -G www-data "${SFTP_USER}"
            echo "  User '${SFTP_USER}' zur Gruppe www-data hinzugefuegt."
            echo "  WICHTIG: Bitte einmal aus-/einloggen (oder neu starten),"
            echo "  damit die neue Gruppen-Mitgliedschaft wirksam wird."
        fi
    fi
else
    # Default: nur Owner schreibt, Gruppe + Andere lesen.
    chmod -R u+rwX,g+rX,o+rX \
        "${REPO_DIR}/data" \
        "${REPO_DIR}/public/media"
fi
echo "  Rechte gesetzt."

# --- 7) SSH/SFTP aktivieren ---------------------------------------------
echo ""
echo "[7/8] SSH-Server aktivieren (fuer SFTP)..."
if systemctl is-enabled ssh >/dev/null 2>&1; then
    echo "  ssh ist bereits enabled."
else
    systemctl enable ssh
    echo "  ssh enabled."
fi
if systemctl is-active ssh >/dev/null 2>&1; then
    echo "  ssh laeuft."
else
    systemctl start ssh
    echo "  ssh gestartet."
fi

# --- 8) Apache reload ----------------------------------------------------
echo ""
echo "[8/8] Apache-Konfig testen und neu laden..."
if ! apache2ctl configtest 2>&1 | tee /tmp/apache-configtest.log | grep -q "Syntax OK"; then
    echo "Fehler: Apache-Konfig ist nicht ok:" >&2
    cat /tmp/apache-configtest.log >&2
    exit 1
fi
systemctl reload apache2
echo "  Apache neu geladen."

# --- Fertig --------------------------------------------------------------
echo ""
echo "=== Fertig ==="
echo ""
echo "IP-Adresse(n):"
hostname -I | tr ' ' '\n' | sed 's/^/  /'
echo ""
echo "Naechste Schritte:"
echo "  1) Daten migrieren (falls altes Node-System Daten hat):"
echo "       sudo -u www-data php ${REPO_DIR}/scripts/migrate-from-node.php --dry-run"
echo "     Wenn die Ausgabe stimmt, ohne --dry-run wiederholen."
echo "  2) Im Browser oeffnen:"
echo "       Display:        http://<ip>/"
echo "       Konfiguration:  http://<ip>/admin.php"
echo "  3) Kiosk-Browser starten:"
echo "       ${REPO_DIR}/scripts/start-kiosk.sh"
echo "  4) SFTP-Zugriff testen (z. B. mit FileZilla/Cyberduck):"
echo "       Protokoll: SFTP   Host: <ip>   Port: 22"
echo "       Benutzer:  ${SUDO_USER:-<dein-pi-user>}   Passwort: <dein-Passwort>"
