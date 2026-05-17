#!/bin/bash
#
# Verlegt die Upload-Verzeichnisse aus public/media/ in ein gemeinsames
# <repo>/upload/-Verzeichnis und richtet Symlinks ein.
#
# Hintergrund: per SFTP ist es bequemer, alle hochgeladenen Mediendateien
# unter einem flachen Verzeichnis im Home zu sehen ($HOME/amr_welcome_screen/
# upload/) statt unter public/media/. Apache liefert die Dateien weiterhin
# statisch aus, weil die alten Pfade als Symlinks bestehen bleiben und der
# Vhost FollowSymLinks erlaubt.
#
# Aufruf (aus dem Repo-Root):
#     sudo ./scripts/setup-upload-symlink.sh           # einrichten
#     sudo ./scripts/setup-upload-symlink.sh --undo    # rueckgaengig
#     sudo ./scripts/setup-upload-symlink.sh --help
#
# Idempotent: kann mehrfach ausgefuehrt werden, ohne Daten zu verlieren.
#
# Verzeichnis-Layout nach dem Einrichten:
#     upload/
#         uploads/         <- Slideshow-Dateien (Bilder/Videos/PDFs)
#         converted/       <- konvertierte PDF-Seite-1-PNGs
#         static/          <- Logo (logo.<ext>)
#             widgets/     <- Widget-Bilder/-Videos
#
#     public/media/
#         uploads/  -> ../../upload/uploads/         (Symlink)
#         converted/ -> ../../upload/converted/       (Symlink)
#         static/   -> ../../upload/static/          (Symlink)
#         .htaccess                                   (bleibt physisch, schuetzt rekursiv)

set -euo pipefail

# --- Pfade ---------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
UPLOAD_ROOT="${REPO_DIR}/upload"
MEDIA_ROOT="${REPO_DIR}/public/media"

# Welche Unterverzeichnisse werden umgezogen?
SUBS=(uploads converted static)

# --- Argumente parsen ---------------------------------------------------
MODE=setup
for arg in "${@:-}"; do
    case "$arg" in
        ''|--setup) MODE=setup ;;
        --undo)     MODE=undo ;;
        -h|--help)
            sed -n '2,30p' "$0"
            exit 0 ;;
        *)
            echo "Unbekannte Option: $arg" >&2
            echo "Aufruf: $0 [--setup|--undo|--help]" >&2
            exit 1 ;;
    esac
done

# --- Sudo-Check ---------------------------------------------------------
if [[ $EUID -ne 0 ]]; then
    echo "Fehler: bitte mit sudo ausfuehren." >&2
    echo "  Beispiel:  sudo $0 ${*:-}" >&2
    exit 1
fi

# --- Hilfsfunktionen ----------------------------------------------------

# Verschiebt alle Inhalte (inkl. Punkt-Dateien wie .gitkeep) von $1 nach $2.
#
# Verhalten bei Namens-Kollisionen:
#   - Verzeichnis + Verzeichnis: rekursiv mergen (selbe Funktion erneut aufrufen).
#   - Datei + Datei:             ueberspringen mit Hinweis (nichts ueberschreiben).
#   - Sonst:                     ueberspringen mit Hinweis.
move_contents() {
    local src="$1" dst="$2"
    mkdir -p "$dst"
    shopt -s dotglob nullglob
    local items=("$src"/*)
    shopt -u dotglob nullglob
    for item in "${items[@]}"; do
        local name target
        name="$(basename "$item")"
        target="$dst/$name"
        if [[ -e "$target" || -L "$target" ]]; then
            if [[ -d "$item" && -d "$target" && ! -L "$target" ]]; then
                # Verzeichnis-zu-Verzeichnis: rekursiv mergen, dann leeres
                # Quell-Verzeichnis entfernen.
                move_contents "$item" "$target"
                rmdir "$item" 2>/dev/null || true
                continue
            fi
            echo "    uebersprungen (existiert schon): $name"
            continue
        fi
        mv "$item" "$dst/"
    done
}

# --- SETUP --------------------------------------------------------------
if [[ $MODE == setup ]]; then
    echo "=== Upload-Symlink-Setup ==="
    echo "Repo:        ${REPO_DIR}"
    echo "Upload-Root: ${UPLOAD_ROOT}"
    echo ""

    # 1) Zielstruktur anlegen (Top-Level-Subs).
    # WICHTIG: die tieferen Unterordner (z. B. static/widgets/) NICHT vorab
    # anlegen - das wuerde mit der Verschiebe-Logik unten kollidieren
    # (Verzeichnis-zu-Verzeichnis-Merge). Sie werden entweder mit-verschoben
    # oder am Ende ergaenzt.
    echo "[1/4] Zielverzeichnisse anlegen..."
    for sub in "${SUBS[@]}"; do
        mkdir -p "${UPLOAD_ROOT}/${sub}"
    done
    echo "  ok"

    # 2) Pro Sub: ggf. verschieben + Symlink anlegen
    echo ""
    echo "[2/4] Inhalte verschieben und Symlinks setzen..."
    for sub in "${SUBS[@]}"; do
        src="${MEDIA_ROOT}/${sub}"
        dst="${UPLOAD_ROOT}/${sub}"

        if [[ -L "$src" ]]; then
            current="$(readlink -f "$src")"
            if [[ "$current" == "$dst" ]]; then
                echo "  ${sub}/: bereits korrekt verlinkt"
                continue
            fi
            echo "  ${sub}/: vorhandener Symlink zeigt auf ${current}"
            echo "    -> wird durch korrekten Symlink ersetzt"
            rm "$src"
            ln -s "$dst" "$src"
            continue
        fi

        if [[ -d "$src" ]]; then
            echo "  ${sub}/: verschiebe Inhalte nach ${dst}/"
            move_contents "$src" "$dst"
            # rmdir schlaegt fehl, wenn noch Reste drin sind (z. B. uebersprungene Duplikate).
            if ! rmdir "$src" 2>/dev/null; then
                echo "    Fehler: ${src} ist nicht leer (Duplikate?). Bitte manuell pruefen." >&2
                echo "    Verbleibende Eintraege:" >&2
                ls -la "$src" >&2
                exit 1
            fi
            ln -s "$dst" "$src"
            echo "    -> Symlink angelegt"
        elif [[ ! -e "$src" ]]; then
            ln -s "$dst" "$src"
            echo "  ${sub}/: Symlink neu angelegt (kein Quellverzeichnis vorhanden)"
        else
            echo "  ${sub}/: ${src} existiert, ist aber weder Verzeichnis noch Symlink. Abbruch." >&2
            exit 1
        fi
    done

    # Idempotenz-Garantie: stelle sicher, dass static/widgets/ existiert
    # (falls Source komplett leer war).
    mkdir -p "${UPLOAD_ROOT}/static/widgets"

    # 3) Rechte setzen (analog setup-apache.sh)
    echo ""
    echo "[3/4] Rechte setzen..."
    chown -R www-data:www-data "${UPLOAD_ROOT}"
    chmod -R u+rwX,g+rwX,o+rX "${UPLOAD_ROOT}"
    # setgid auf Verzeichnissen: neu angelegte Dateien erben Gruppe www-data.
    find "${UPLOAD_ROOT}" -type d -exec chmod g+s {} +
    echo "  Owner=www-data, Gruppe=www-data, setgid auf Verzeichnissen"

    # 4) Sanity-Check
    echo ""
    echo "[4/4] Sanity-Check..."
    for sub in "${SUBS[@]}"; do
        if [[ -L "${MEDIA_ROOT}/${sub}" ]]; then
            target="$(readlink -f "${MEDIA_ROOT}/${sub}")"
            echo "  public/media/${sub}/ -> ${target}/ ok"
        else
            echo "  FEHLER: public/media/${sub}/ ist KEIN Symlink" >&2
            exit 1
        fi
    done

    echo ""
    echo "=== Fertig ==="
    echo ""
    echo "Per SFTP siehst du jetzt alle Uploads unter:"
    echo "  ${UPLOAD_ROOT}/uploads/      (Slideshow-Bilder/Videos/PDFs)"
    echo "  ${UPLOAD_ROOT}/converted/    (PDF-Seite-1-Renderings)"
    echo "  ${UPLOAD_ROOT}/static/       (Logo)"
    echo "  ${UPLOAD_ROOT}/static/widgets/  (Widget-Bilder/Videos)"
    echo ""
    echo "HINWEIS: Per SFTP eingespielte Slideshow-Dateien tauchen nicht"
    echo "automatisch in der Slideshow auf. Nach dem SFTP-Upload einmal"
    echo "synchronisieren:"
    echo "  sudo -u www-data php ${REPO_DIR}/scripts/scan-uploads.php --dry-run"
    echo "  sudo -u www-data php ${REPO_DIR}/scripts/scan-uploads.php"
    exit 0
fi

# --- UNDO ---------------------------------------------------------------
if [[ $MODE == undo ]]; then
    echo "=== Upload-Symlink-Setup: RUECKGAENGIG ==="
    echo "Repo:        ${REPO_DIR}"
    echo "Upload-Root: ${UPLOAD_ROOT}"
    echo ""

    # Pro Sub: Symlink durch echtes Verzeichnis ersetzen, Inhalte zurueck verschieben.
    for sub in "${SUBS[@]}"; do
        src="${MEDIA_ROOT}/${sub}"
        dst="${UPLOAD_ROOT}/${sub}"

        if [[ ! -L "$src" ]]; then
            if [[ -d "$src" ]]; then
                echo "  ${sub}/: ist bereits ein echtes Verzeichnis, ueberspringe"
            else
                echo "  ${sub}/: weder Symlink noch Verzeichnis, ueberspringe"
            fi
            continue
        fi

        echo "  ${sub}/: Symlink entfernen + Inhalte zurueck verschieben"
        rm "$src"
        mkdir -p "$src"

        if [[ -d "$dst" ]]; then
            move_contents "$dst" "$src"
            rmdir "$dst" 2>/dev/null || \
                echo "    Hinweis: ${dst} nicht leer geraeumt (manuell pruefen)"
        fi
    done

    # Falls upload/ jetzt leer ist, koennen wir es entfernen.
    # (static/widgets/ kann zurueckbleiben, weil es ein Unter-Sub ist.)
    if [[ -d "${UPLOAD_ROOT}" ]]; then
        rmdir "${UPLOAD_ROOT}/static/widgets" 2>/dev/null || true
        rmdir "${UPLOAD_ROOT}/static"          2>/dev/null || true
        for sub in "${SUBS[@]}"; do
            rmdir "${UPLOAD_ROOT}/${sub}" 2>/dev/null || true
        done
        rmdir "${UPLOAD_ROOT}" 2>/dev/null \
            && echo "  ${UPLOAD_ROOT} entfernt (war leer)" \
            || echo "  Hinweis: ${UPLOAD_ROOT} ist nicht leer und bleibt erhalten"
    fi

    # Rechte auf den Original-Pfaden wiederherstellen.
    chown -R www-data:www-data "${MEDIA_ROOT}"
    chmod -R u+rwX,g+rwX,o+rX  "${MEDIA_ROOT}"

    echo ""
    echo "=== Fertig ==="
    echo "Uploads liegen wieder unter public/media/."
    exit 0
fi
