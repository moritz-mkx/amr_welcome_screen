<?php
/**
 * Upload-Hilfsfunktionen.
 *
 * Aufgaben:
 *  - $_FILES-Fehlercodes in lesbare Fehlermeldungen wandeln
 *  - MIME-Type validieren - aber **per finfo_file()** (echter Inhalt),
 *    nicht per Datei-Endung. Sonst koennte ein als .png getarntes Script
 *    durchrutschen.
 *  - Dateinamen sicher generieren (kein Pfadteil im Namen, kein Whitespace)
 *  - move_uploaded_file() in das Zielverzeichnis
 *
 * Whitelisten werden vom Aufrufer (Endpunkt) als Array uebergeben, weil die
 * verschiedenen Endpunkte unterschiedliche Typen erlauben:
 *   - /api/upload:       image/video/pdf
 *   - /api/config/logo:  nur image
 *   - /api/widget-media: image + video
 */

declare(strict_types=1);

require_once __DIR__ . '/paths.php';

/**
 * Liefert eine lesbare Fehlermeldung fuer einen PHP-Upload-Fehlercode.
 */
function ws_upload_error_message(int $code): string
{
    switch ($code) {
        case UPLOAD_ERR_OK:
            return 'OK';
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
            return 'Datei zu gross. Maximalgroesse ueberschritten.';
        case UPLOAD_ERR_PARTIAL:
            return 'Datei wurde nur teilweise hochgeladen.';
        case UPLOAD_ERR_NO_FILE:
            return 'Keine Datei hochgeladen';
        case UPLOAD_ERR_NO_TMP_DIR:
            return 'Server-Konfigurationsfehler: temporaeres Verzeichnis fehlt.';
        case UPLOAD_ERR_CANT_WRITE:
            return 'Datei konnte nicht geschrieben werden.';
        case UPLOAD_ERR_EXTENSION:
            return 'Upload durch PHP-Erweiterung blockiert.';
        default:
            return 'Unbekannter Upload-Fehler (Code ' . $code . ').';
    }
}

/**
 * Pruegt eine $_FILES-Struktur (single-file). Wirft InvalidArgumentException
 * bei jedem Fehlerfall - der Endpunkt uebersetzt das in eine 400-Antwort.
 *
 * Rueckgabe: assoziatives Array mit `tmp_name`, `name` (original), `size`, `mimetype`.
 *
 * @param array|null   $file        $_FILES['xy'] - kann null sein, wenn das Feld fehlt.
 * @param string[]     $allowedMimes Liste erlaubter MIME-Praefixe oder vollstaendiger Typen.
 *                                   Erlaubt sind:
 *                                     - voller Typ:    "application/pdf"
 *                                     - Praefix:       "image/" (matched image/jpeg, image/png, ...)
 * @param int          $maxBytes     Maximale Groesse in Bytes.
 */
function ws_upload_validate(?array $file, array $allowedMimes, int $maxBytes = WS_MAX_UPLOAD_BYTES): array
{
    if ($file === null || !isset($file['error'])) {
        throw new InvalidArgumentException('Keine Datei hochgeladen');
    }
    $err = (int)$file['error'];
    if ($err !== UPLOAD_ERR_OK) {
        throw new InvalidArgumentException(ws_upload_error_message($err));
    }
    if (!is_uploaded_file((string)$file['tmp_name'])) {
        throw new InvalidArgumentException('Ungueltige Upload-Datei');
    }
    $size = (int)($file['size'] ?? 0);
    if ($size <= 0) {
        throw new InvalidArgumentException('Leere Datei');
    }
    if ($size > $maxBytes) {
        throw new InvalidArgumentException(sprintf(
            'Datei zu gross (%d > %d Bytes)',
            $size,
            $maxBytes
        ));
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file((string)$file['tmp_name']);
    if (!is_string($mime) || $mime === '') {
        throw new InvalidArgumentException('MIME-Type konnte nicht ermittelt werden');
    }
    if (!ws_upload_mime_allowed($mime, $allowedMimes)) {
        throw new InvalidArgumentException('Ungueltiger Dateityp: ' . $mime);
    }

    return [
        'tmp_name' => (string)$file['tmp_name'],
        'name'     => (string)($file['name'] ?? 'upload'),
        'size'     => $size,
        'mimetype' => $mime,
    ];
}

/**
 * Prueft, ob ein MIME-Type auf der Whitelist steht.
 * Whitelist-Eintraege duerfen voller Typ ("application/pdf") oder Praefix
 * mit Schraegstrich ("image/") sein.
 *
 * @param string[] $allowed
 */
function ws_upload_mime_allowed(string $mime, array $allowed): bool
{
    foreach ($allowed as $entry) {
        if (str_ends_with($entry, '/')) {
            if (str_starts_with($mime, $entry)) {
                return true;
            }
        } elseif ($entry === $mime) {
            return true;
        }
    }
    return false;
}

/**
 * Erzeugt einen sicheren Zieldateinamen analog zum frueheren Multer-Layout:
 *   "<timestamp-ms>-<sanitized-basename>"
 *
 * Sanitization:
 *  - nur Datei-Basisname (kein Pfad)
 *  - alle Zeichen ausser [A-Za-z0-9._-] werden zu _
 *  - mehrfache Unterstriche werden zusammengezogen
 *  - leere Namen werden zu "datei"
 */
function ws_upload_safe_filename(string $originalName, string $forceExt = ''): string
{
    $base = basename($originalName);
    $ext  = $forceExt !== '' ? $forceExt : (pathinfo($base, PATHINFO_EXTENSION) ?: '');
    $stem = pathinfo($base, PATHINFO_FILENAME);
    $stem = preg_replace('/[^A-Za-z0-9._-]+/', '_', $stem) ?? '';
    $stem = trim($stem, '._-');
    if ($stem === '') {
        $stem = 'datei';
    }
    $ext = preg_replace('/[^A-Za-z0-9]+/', '', $ext) ?? '';
    $timestamp = (int)(microtime(true) * 1000);
    return $ext !== ''
        ? sprintf('%d-%s.%s', $timestamp, $stem, strtolower($ext))
        : sprintf('%d-%s', $timestamp, $stem);
}

/**
 * Verschiebt eine validierte Upload-Datei in das Zielverzeichnis.
 *
 * @param array  $validated  Rueckgabe von ws_upload_validate()
 * @param string $targetDir  Absoluter Pfad zum Zielordner.
 * @param string $forceExt   Optionale Datei-Endung (z. B. wenn aus MIME abgeleitet).
 * @return array { filename, path, size, mimetype, originalName }
 */
function ws_upload_move(array $validated, string $targetDir, string $forceExt = ''): array
{
    if (!is_dir($targetDir) && !@mkdir($targetDir, 0775, true) && !is_dir($targetDir)) {
        throw new RuntimeException("Zielverzeichnis nicht anlegbar: $targetDir");
    }
    $filename = ws_upload_safe_filename($validated['name'], $forceExt);
    $target   = $targetDir . '/' . $filename;
    if (!@move_uploaded_file($validated['tmp_name'], $target)) {
        throw new RuntimeException("Datei konnte nicht verschoben werden: $target");
    }
    @chmod($target, 0664);
    return [
        'filename'     => $filename,
        'path'         => $target,
        'size'         => $validated['size'],
        'mimetype'     => $validated['mimetype'],
        'originalName' => $validated['name'],
    ];
}

/**
 * Liefert eine sinnvolle Datei-Endung anhand des MIME-Typs.
 * Fallback: leere Endung.
 */
function ws_upload_ext_from_mime(string $mime): string
{
    static $map = [
        'image/jpeg'       => 'jpg',
        'image/png'        => 'png',
        'image/gif'        => 'gif',
        'image/webp'       => 'webp',
        'image/svg+xml'    => 'svg',
        'video/mp4'        => 'mp4',
        'video/webm'       => 'webm',
        'video/ogg'        => 'ogv',
        'video/quicktime'  => 'mov',
        'application/pdf'  => 'pdf',
    ];
    return $map[$mime] ?? '';
}
