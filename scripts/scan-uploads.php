<?php
/**
 * SFTP-Upload-Scan: synchronisiert das uploads-Verzeichnis mit der
 * Metadaten-Liste (`data/files.json`).
 *
 * Hintergrund: Dateien, die per SFTP direkt nach public/media/uploads/
 * gelegt werden, sind im Filesystem vorhanden, tauchen aber nicht im
 * Admin-Panel auf - weil dort die Liste aus data/files.json gerendert
 * wird. Dieses Skript schliesst die Luecke:
 *
 *   - Neue Dateien im uploads-Verzeichnis werden in files.json aufgenommen
 *     (MIME-Validierung via finfo, bei PDFs Konvertierung zur Seite-1-PNG).
 *   - "Orphan"-Eintraege in files.json (kein Filesystem-Pendant mehr) werden
 *     entfernt; die zugehoerige converted-Datei wird mitgeloescht.
 *
 * Aufruf (auf dem Pi, am sichersten als www-data):
 *     sudo -u www-data php scripts/scan-uploads.php [--dry-run] [-v|--verbose]
 *     sudo -u www-data php scripts/scan-uploads.php --help
 *
 * Exit-Codes:
 *     0  Erfolg
 *     1  Argument- oder Pfad-Fehler
 *     2  Schreib- oder Konvertierungs-Fehler (mindestens eine Datei)
 */

declare(strict_types=1);

require_once __DIR__ . '/../lib/paths.php';
require_once __DIR__ . '/../lib/json_store.php';
require_once __DIR__ . '/../lib/files.php';
require_once __DIR__ . '/../lib/upload.php';
require_once __DIR__ . '/../lib/pdf.php';

// =========================================================================
// Argument-Parsing
// =========================================================================

$opts = ['dry-run' => false, 'verbose' => false];
foreach ($argv as $i => $arg) {
    if ($i === 0) continue;
    switch ($arg) {
        case '--dry-run': $opts['dry-run'] = true; break;
        case '-v':
        case '--verbose': $opts['verbose'] = true; break;
        case '-h':
        case '--help':
            // Erste Doku-Zeilen aus dem File-Header ausgeben (alles zwischen /** und */).
            $lines = file(__FILE__) ?: [];
            for ($j = 2; $j < count($lines) && strpos(ltrim($lines[$j]), '*/') !== 0; $j++) {
                echo preg_replace('/^\s*\* ?/', '', $lines[$j]);
            }
            exit(0);
        default:
            fwrite(STDERR, "Unbekannte Option: $arg\n");
            fwrite(STDERR, "Aufruf: php scripts/scan-uploads.php [--dry-run] [-v|--verbose] [--help]\n");
            exit(1);
    }
}

// =========================================================================
// Helpers
// =========================================================================

/** MIME-Whitelist analog zu /api/upload.php. */
const ALLOWED_MIMES = ['image/', 'video/', 'application/pdf'];

/** Typ-Mapping aus MIME. */
function classify_mime(string $mime): ?string
{
    if (str_starts_with($mime, 'image/'))     return 'image';
    if (str_starts_with($mime, 'video/'))     return 'video';
    if ($mime === 'application/pdf')           return 'pdf';
    return null;
}

/**
 * Bytes lesbar (KB / MB / GB).
 */
function fmt_bytes(int $b): string
{
    if ($b < 1024)              return $b . ' B';
    if ($b < 1024 * 1024)       return number_format($b / 1024, 1) . ' KB';
    if ($b < 1024 * 1024 * 1024) return number_format($b / 1024 / 1024, 1) . ' MB';
    return number_format($b / 1024 / 1024 / 1024, 2) . ' GB';
}

/**
 * Erzeugt eine neue, kollisionssichere ID. Nutzt Millisekunden plus einen
 * statischen Counter, falls mehrere IDs in derselben Millisekunde entstehen.
 */
function next_file_id(): string
{
    static $counter = 0;
    static $lastMs  = 0;
    $ms = (int)(microtime(true) * 1000);
    if ($ms === $lastMs) {
        $counter++;
    } else {
        $counter = 0;
        $lastMs  = $ms;
    }
    return (string)($ms * 1000 + $counter);
}

/**
 * Listet alle regulaeren Dateien (nicht-Punkt) in einem Verzeichnis.
 *
 * @return string[]  Datei-Namen (nicht voller Pfad), sortiert.
 */
function list_regular_files(string $dir): array
{
    if (!is_dir($dir)) return [];
    $out = [];
    foreach (scandir($dir) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        if (str_starts_with($entry, '.'))      continue; // Punkt-Dateien ignorieren
        if (!is_file($dir . '/' . $entry))      continue;
        $out[] = $entry;
    }
    sort($out, SORT_NATURAL | SORT_FLAG_CASE);
    return $out;
}

// =========================================================================
// Hauptlogik
// =========================================================================

echo "=== SFTP-Upload-Scan ===\n";
echo "Uploads:    " . WS_UPLOADS_DIR . "\n";
echo "Converted:  " . WS_CONVERTED_DIR . "\n";
echo "Metadaten:  " . WS_FILES_FILE . "\n";
echo "Modus:      " . ($opts['dry-run'] ? 'DRY-RUN' : 'LIVE') . "\n";
echo "\n";

try {
    ws_ensure_dirs();
} catch (Throwable $e) {
    fwrite(STDERR, "Verzeichnis-Setup fehlgeschlagen: " . $e->getMessage() . "\n");
    exit(1);
}

// Schreibrechte sanity-checken (sonst spaeter unverstaendliche Fehler).
if (!$opts['dry-run']) {
    $dataParent = dirname(WS_FILES_FILE);
    if (!is_writable($dataParent) || (file_exists(WS_FILES_FILE) && !is_writable(WS_FILES_FILE))) {
        fwrite(STDERR, "Kein Schreibzugriff auf " . WS_FILES_FILE . "\n");
        fwrite(STDERR, "Tipp: als www-data ausfuehren:  sudo -u www-data php scripts/scan-uploads.php\n");
        exit(1);
    }
}

$exitCode = 0;

// Atomare Lese-Modifizieren-Schreiben-Operation unter Lock.
$summary = ws_with_lock('files', function () use ($opts, &$exitCode): array {
    $data    = ws_read_json(WS_FILES_FILE, ['files' => []]);
    $entries = is_array($data['files'] ?? null) ? $data['files'] : [];

    // ---- 1) Bestehende Eintraege indexieren --------------------------------
    $byFilename = [];
    foreach ($entries as $idx => $f) {
        $byFilename[(string)($f['filename'] ?? '')] = $idx;
    }

    $diskFiles = list_regular_files(WS_UPLOADS_DIR);

    // ---- 2) Neue Dateien hinzufuegen ---------------------------------------
    $added       = [];
    $convertErrs = [];
    $skipped     = []; // unbekannter MIME-Type o.ae.
    foreach ($diskFiles as $filename) {
        if (isset($byFilename[$filename])) continue; // schon bekannt

        $path = WS_UPLOADS_DIR . '/' . $filename;
        $size = (int)(filesize($path) ?: 0);
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($path) ?: '';
        if (!is_string($mime) || $mime === '' || !ws_upload_mime_allowed($mime, ALLOWED_MIMES)) {
            $skipped[] = ['filename' => $filename, 'reason' => "Ungueltiger MIME-Type: $mime"];
            continue;
        }
        $type = classify_mime($mime);
        if ($type === null) {
            $skipped[] = ['filename' => $filename, 'reason' => "Unbekannter Typ fuer MIME: $mime"];
            continue;
        }

        $convertedFilename = null;
        if ($type === 'pdf') {
            $targetPng = ws_pdf_target_path($filename);
            if ($opts['dry-run']) {
                $convertedFilename = basename($targetPng) . ' (waere konvertiert)';
            } else {
                try {
                    ws_pdf_convert_first_page($path, $targetPng);
                    $convertedFilename = basename($targetPng);
                } catch (Throwable $e) {
                    $convertErrs[] = [
                        'filename' => $filename,
                        'error'    => $e->getMessage(),
                    ];
                    // Wir nehmen den Eintrag trotzdem mit auf, ohne convertedFilename.
                    // Im Admin-Panel wird dann die Original-PDF als Fallback genutzt
                    // (was meist nicht im Browser darstellbar ist - sichtbar als Fehler).
                    $convertedFilename = null;
                }
            }
        }

        $entry = [
            'id'                => next_file_id(),
            'filename'          => $filename,
            'originalName'      => $filename, // SFTP-Upload: Disk-Name = Original-Name
            'type'              => $type,
            'mimetype'          => $mime,
            'convertedFilename' => $convertedFilename,
            'uploadedAt'        => gmdate('Y-m-d\TH:i:s\Z'),
            'size'              => $size,
            'hidden'            => false,
        ];
        $entries[]                = $entry;
        $byFilename[$filename]    = count($entries) - 1;
        $added[]                  = $entry;
    }

    // ---- 3) Orphans entfernen ----------------------------------------------
    $orphansRemoved = [];
    $filteredEntries = [];
    foreach ($entries as $f) {
        $filename = (string)($f['filename'] ?? '');
        $filePath = WS_UPLOADS_DIR . '/' . $filename;
        if (!is_file($filePath)) {
            // Orphan: in files.json, aber Datei fehlt.
            $orphansRemoved[] = $f;
            // Converted-Datei (falls vorhanden) ebenfalls aufraeumen.
            $cf = (string)($f['convertedFilename'] ?? '');
            if ($cf !== '' && !$opts['dry-run']) {
                $cp = WS_CONVERTED_DIR . '/' . $cf;
                if (is_file($cp)) @unlink($cp);
            }
            continue;
        }
        $filteredEntries[] = $f;
    }

    // ---- 4) Schreiben (nur bei Aenderungen + nicht im Dry-Run) -------------
    $changed = (count($added) > 0) || (count($orphansRemoved) > 0);
    if ($changed && !$opts['dry-run']) {
        $data['files'] = $filteredEntries;
        try {
            ws_write_json_atomic(WS_FILES_FILE, $data);
        } catch (Throwable $e) {
            fwrite(STDERR, "Schreiben von files.json fehlgeschlagen: " . $e->getMessage() . "\n");
            $exitCode = 2;
        }
    }

    return [
        'added'          => $added,
        'orphansRemoved' => $orphansRemoved,
        'skipped'        => $skipped,
        'convertErrs'    => $convertErrs,
        'total'          => count($filteredEntries),
        'diskCount'      => count($diskFiles),
    ];
});

// =========================================================================
// Ausgabe
// =========================================================================

if (count($summary['added']) > 0) {
    echo "[+] Neue Dateien aufgenommen:\n";
    foreach ($summary['added'] as $f) {
        printf("    + %s  (%s, %s)  id=%s\n",
            $f['filename'], $f['type'], fmt_bytes((int)$f['size']), $f['id']);
        if ($f['type'] === 'pdf' && !empty($f['convertedFilename'])) {
            echo "      \u{21B3} PDF-Seite-1 konvertiert: " . $f['convertedFilename'] . "\n";
        }
    }
    echo "\n";
}

if (count($summary['orphansRemoved']) > 0) {
    echo "[-] Orphan-Eintraege entfernt:\n";
    foreach ($summary['orphansRemoved'] as $f) {
        printf("    - %s  (id=%s; Datei nicht mehr im Filesystem)\n",
            (string)($f['filename'] ?? '?'), (string)($f['id'] ?? '?'));
    }
    echo "\n";
}

if (count($summary['skipped']) > 0) {
    echo "[!] Dateien uebersprungen:\n";
    foreach ($summary['skipped'] as $s) {
        echo "    ? {$s['filename']}: {$s['reason']}\n";
    }
    echo "\n";
}

if (count($summary['convertErrs']) > 0) {
    echo "[!] PDF-Konvertierung fehlgeschlagen (Eintrag trotzdem angelegt, ohne Vorschau):\n";
    foreach ($summary['convertErrs'] as $err) {
        echo "    ? {$err['filename']}: {$err['error']}\n";
    }
    echo "\n";
    if ($exitCode === 0) $exitCode = 2;
}

echo "Zusammenfassung:\n";
printf("  Auf der Disk:        %d Datei(en)\n",  $summary['diskCount']);
printf("  Hinzugefuegt:        %d\n",            count($summary['added']));
printf("  Orphans entfernt:    %d\n",            count($summary['orphansRemoved']));
printf("  Uebersprungen:       %d\n",            count($summary['skipped']));
printf("  Total in files.json: %d\n",            $summary['total']);

if ($opts['dry-run']) {
    echo "\n(DRY-RUN: keine Aenderungen geschrieben.)\n";
}

if ($opts['verbose'] && count($summary['added']) === 0
    && count($summary['orphansRemoved']) === 0
    && count($summary['skipped']) === 0) {
    echo "Nichts zu tun - files.json ist mit dem uploads-Verzeichnis synchron.\n";
}

exit($exitCode);
