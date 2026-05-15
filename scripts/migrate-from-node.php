<?php
/**
 * Migrationsskript: Node/Express-Daten -> PHP-System
 *
 * Liest die JSON-Daten und Medien aus dem alten Node-Backend (Standard:
 * `alt/backend/` - dorthin wurde das System in Etappe 6 verschoben) und
 * uebernimmt sie in die neue PHP-Struktur (`data/`, `public/media/`).
 *
 * Aufruf (aus dem Repo-Root):
 *     php scripts/migrate-from-node.php [--force] [--dry-run] [--source <pfad>]
 *
 * Optionen:
 *   --dry-run         Nichts schreiben/kopieren, nur anzeigen.
 *   --force           Bestehende Zieldateien ueberschreiben.
 *   --source <pfad>   Pfad zum alten Node-Backend (Default: ./alt/backend).
 *                     Beispiel: --source /backup/welcome-screen/backend
 *
 * Idempotent: Bei wiederholtem Lauf werden bestehende Zieldateien NICHT
 * ueberschrieben (ausser mit --force). Bestehende Ziel-JSONs werden vor dem
 * Schreiben als <name>.bak gesichert.
 *
 * Schema-Aenderung gegenueber dem alten System:
 *   - `path` / `convertedPath` (absolute Filesystem-Pfade) werden NICHT mehr
 *     gespeichert. Stattdessen nur `filename` (im uploads-Verzeichnis) und
 *     optional `convertedFilename` (im converted-Verzeichnis).
 *   - Pfade werden vom PHP-Backend zur Laufzeit aus diesen Dateinamen
 *     konstruiert.
 *
 * Voraussetzungen: PHP 7.4+
 */

declare(strict_types=1);

// --- Argumente parsen ----------------------------------------------------
$opts = [
    'force'   => in_array('--force', $argv, true),
    'dry-run' => in_array('--dry-run', $argv, true),
    'source'  => null,
];
for ($i = 1; $i < count($argv); $i++) {
    if ($argv[$i] === '--source' && isset($argv[$i + 1])) {
        $opts['source'] = $argv[$i + 1];
        $i++;
    } elseif (str_starts_with($argv[$i], '--source=')) {
        $opts['source'] = substr($argv[$i], strlen('--source='));
    }
}

// --- Pfade definieren ----------------------------------------------------
$repoRoot = realpath(__DIR__ . '/..');
if ($repoRoot === false) {
    fwrite(STDERR, "Repo-Root konnte nicht ermittelt werden.\n");
    exit(1);
}

// Quellpfad: --source-Argument hat Vorrang, sonst Default alt/backend.
$sourceRoot = $opts['source'] ?? ($repoRoot . '/alt/backend');
if (!is_dir($sourceRoot)) {
    fwrite(STDERR, "Quellverzeichnis nicht gefunden: $sourceRoot\n");
    fwrite(STDERR, "Mit --source <pfad> einen anderen Quellordner angeben.\n");
    exit(1);
}

$src = [
    'config'       => $sourceRoot . '/config.json',
    'filesMeta'    => $sourceRoot . '/files-metadata.json',
    'schedules'    => $sourceRoot . '/schedules.json',
    'uploadsDir'   => $sourceRoot . '/uploads',
    'convertedDir' => $sourceRoot . '/converted',
    'staticDir'    => $sourceRoot . '/static',
];

$dst = [
    'config'       => $repoRoot . '/data/config.json',
    'files'        => $repoRoot . '/data/files.json',
    'schedules'    => $repoRoot . '/data/schedules.json',
    'uploadsDir'   => $repoRoot . '/public/media/uploads',
    'convertedDir' => $repoRoot . '/public/media/converted',
    'staticDir'    => $repoRoot . '/public/media/static',
];

// --- Helpers -------------------------------------------------------------

/**
 * Liest JSON-Datei. Wirft RuntimeException bei Lese-/Parsefehlern.
 * Gibt $default zurueck, wenn Datei nicht existiert.
 *
 * @return mixed
 */
function read_json(string $path, $default = null)
{
    if (!file_exists($path)) {
        return $default;
    }
    $raw = file_get_contents($path);
    if ($raw === false) {
        throw new RuntimeException("Datei nicht lesbar: $path");
    }
    $data = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new RuntimeException("Ungueltiges JSON in $path: " . json_last_error_msg());
    }
    return $data;
}

/**
 * Schreibt JSON pretty-printed. Legt vorher Backup .bak an, falls die
 * Zieldatei existiert. Im Dry-Run nur Logging.
 */
function write_json(string $path, $data, bool $dryRun): void
{
    if ($dryRun) {
        echo "  [dry-run] schreiben: $path\n";
        return;
    }
    if (file_exists($path)) {
        $bak = $path . '.bak';
        if (!@copy($path, $bak)) {
            throw new RuntimeException("Backup fehlgeschlagen: $bak");
        }
        echo "  Backup angelegt: " . basename($bak) . "\n";
    }
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException("Verzeichnis nicht anlegbar: $dir");
    }
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        throw new RuntimeException("JSON-Encoding fehlgeschlagen fuer $path");
    }
    if (file_put_contents($path, $json) === false) {
        throw new RuntimeException("Schreiben fehlgeschlagen: $path");
    }
}

/**
 * Kopiert eine einzelne Datei. Ueberspringt, wenn das Ziel existiert und
 * --force nicht gesetzt ist. Gibt true zurueck, wenn kopiert wurde.
 */
function copy_file(string $src, string $dst, bool $force, bool $dryRun): bool
{
    if (!file_exists($src)) {
        return false;
    }
    if (file_exists($dst) && !$force) {
        echo "  uebersprungen (existiert): " . basename($dst) . "\n";
        return false;
    }
    if ($dryRun) {
        echo "  [dry-run] kopieren: " . basename($src) . " -> " . basename($dst) . "\n";
        return true;
    }
    $dir = dirname($dst);
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException("Verzeichnis nicht anlegbar: $dir");
    }
    if (!@copy($src, $dst)) {
        throw new RuntimeException("Kopieren fehlgeschlagen: $src -> $dst");
    }
    return true;
}

/**
 * Kopiert alle Dateien aus $srcDir nach $dstDir (rekursiv, eine Ebene tief).
 * Verzeichnisse innerhalb werden ebenfalls als Unterordner uebernommen.
 */
function copy_dir(string $srcDir, string $dstDir, bool $force, bool $dryRun): int
{
    if (!is_dir($srcDir)) {
        echo "  Quellverzeichnis fehlt, ueberspringe: $srcDir\n";
        return 0;
    }
    if (!is_dir($dstDir) && !$dryRun) {
        if (!mkdir($dstDir, 0775, true) && !is_dir($dstDir)) {
            throw new RuntimeException("Verzeichnis nicht anlegbar: $dstDir");
        }
    }
    $count = 0;
    $entries = scandir($srcDir) ?: [];
    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }
        $srcPath = $srcDir . '/' . $entry;
        $dstPath = $dstDir . '/' . $entry;
        if (is_dir($srcPath)) {
            $count += copy_dir($srcPath, $dstPath, $force, $dryRun);
        } elseif (is_file($srcPath)) {
            if (copy_file($srcPath, $dstPath, $force, $dryRun)) {
                $count++;
            }
        }
    }
    return $count;
}

/**
 * Normalisiert ein File-Metadaten-Objekt aus dem alten Schema in das neue.
 * - entfernt `path` und `convertedPath`
 * - leitet `convertedFilename` aus `convertedPath` ab (basename)
 * - laesst alle anderen Felder unveraendert
 */
function normalize_file_entry(array $f): array
{
    $out = [
        'id'           => (string)($f['id'] ?? ''),
        'filename'     => (string)($f['filename'] ?? ''),
        'originalName' => (string)($f['originalName'] ?? ''),
        'type'         => (string)($f['type'] ?? ''),
        'mimetype'     => $f['mimetype'] ?? null,
        'uploadedAt'   => (string)($f['uploadedAt'] ?? ''),
        'size'         => isset($f['size']) ? (int)$f['size'] : 0,
        'hidden'       => !empty($f['hidden']),
    ];
    if (!empty($f['convertedPath'])) {
        $out['convertedFilename'] = basename((string)$f['convertedPath']);
    } else {
        $out['convertedFilename'] = null;
    }
    return $out;
}

// --- Migration ausfuehren ------------------------------------------------

echo "=== Migration Node -> PHP ===\n";
echo "Repo-Root:  $repoRoot\n";
echo "Quelle:     $sourceRoot\n";
echo "Modus:      " . ($opts['dry-run'] ? 'DRY-RUN' : 'LIVE')
    . ($opts['force'] ? ' (force)' : '') . "\n\n";

try {
    // 1) Config uebernehmen (Schema unveraendert)
    echo "[1/5] Config (<source>/config.json -> data/config.json)\n";
    $config = read_json($src['config'], null);
    if ($config === null) {
        echo "  keine alte config.json gefunden -> uebersprungen\n";
    } else {
        write_json($dst['config'], $config, $opts['dry-run']);
        echo "  uebernommen\n";
    }
    echo "\n";

    // 2) Dateien-Metadaten umstellen
    echo "[2/5] Files-Metadaten (<source>/files-metadata.json -> data/files.json)\n";
    $oldMeta = read_json($src['filesMeta'], null);
    if ($oldMeta === null) {
        echo "  keine alte files-metadata.json gefunden -> uebersprungen\n";
    } else {
        $oldFiles = is_array($oldMeta['files'] ?? null) ? $oldMeta['files'] : [];
        $newFiles = array_map('normalize_file_entry', $oldFiles);
        write_json($dst['files'], ['files' => $newFiles], $opts['dry-run']);
        echo "  " . count($newFiles) . " Eintraege migriert\n";
    }
    echo "\n";

    // 3) Schedules uebernehmen (Schema unveraendert)
    echo "[3/5] Schedules (<source>/schedules.json -> data/schedules.json)\n";
    $schedules = read_json($src['schedules'], null);
    if ($schedules === null) {
        echo "  keine alte schedules.json gefunden -> uebersprungen\n";
    } else {
        write_json($dst['schedules'], $schedules, $opts['dry-run']);
        echo "  uebernommen\n";
    }
    echo "\n";

    // 4) Uploads + Converted kopieren
    echo "[4/5] Mediendateien kopieren\n";
    echo " - uploads:\n";
    $u = copy_dir($src['uploadsDir'], $dst['uploadsDir'], $opts['force'], $opts['dry-run']);
    echo "   $u Datei(en) verarbeitet\n";
    echo " - converted:\n";
    $c = copy_dir($src['convertedDir'], $dst['convertedDir'], $opts['force'], $opts['dry-run']);
    echo "   $c Datei(en) verarbeitet\n";
    echo "\n";

    // 5) Static (Logo + Widget-Bilder) kopieren
    echo "[5/5] Static (Logo, Widget-Bilder)\n";
    $s = copy_dir($src['staticDir'], $dst['staticDir'], $opts['force'], $opts['dry-run']);
    echo "  $s Datei(en) verarbeitet\n";
    echo "\n";

    echo "Migration abgeschlossen";
    echo $opts['dry-run'] ? " (DRY-RUN, keine Aenderungen).\n" : ".\n";
} catch (Throwable $e) {
    fwrite(STDERR, "Migration FEHLGESCHLAGEN: " . $e->getMessage() . "\n");
    exit(2);
}
