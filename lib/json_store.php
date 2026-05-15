<?php
/**
 * Atomares Lesen und Schreiben der JSON-Persistenzdateien.
 *
 * Mehrere parallele Admin-Tabs koennen gleichzeitig speichern. Ohne
 * Synchronisation gibt es klassische read-modify-write-Race-Conditions
 * (z. B. Tab A liest, Tab B liest, A schreibt, B schreibt -> A's Aenderung
 * geht verloren).
 *
 * Loesung: ws_with_lock() haelt einen exklusiven flock() auf einer eigenen
 * Lock-Datei, waehrend der gesamte read+modify+write-Zyklus laeuft.
 *
 * Geschrieben wird atomar via tempfile + rename, damit auch bei einem
 * Stromausfall mitten im Schreibvorgang nie eine halb-gueltige JSON-Datei
 * zurueckbleibt.
 */

declare(strict_types=1);

require_once __DIR__ . '/paths.php';

/**
 * Liest eine JSON-Datei. Gibt $default zurueck, wenn die Datei fehlt.
 *
 * @return mixed
 * @throws RuntimeException bei Lese- oder Parsefehlern.
 */
function ws_read_json(string $path, $default = null)
{
    if (!file_exists($path)) {
        return $default;
    }
    $raw = @file_get_contents($path);
    if ($raw === false) {
        throw new RuntimeException("Datei nicht lesbar: $path");
    }
    if ($raw === '') {
        return $default;
    }
    $data = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new RuntimeException("Ungueltiges JSON in $path: " . json_last_error_msg());
    }
    return $data;
}

/**
 * Schreibt $data atomar als pretty-printed JSON nach $path.
 *
 * @throws RuntimeException bei Schreib- oder Encoding-Fehlern.
 */
function ws_write_json_atomic(string $path, $data): void
{
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException("Verzeichnis nicht anlegbar: $dir");
    }
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        throw new RuntimeException("JSON-Encoding fehlgeschlagen: " . json_last_error_msg());
    }

    $tmp = @tempnam($dir, '.tmp_');
    if ($tmp === false) {
        throw new RuntimeException("Tempfile nicht anlegbar in $dir");
    }
    if (@file_put_contents($tmp, $json) === false) {
        @unlink($tmp);
        throw new RuntimeException("Schreiben fehlgeschlagen: $tmp");
    }
    // chmod auf 0664, damit Group (www-data) schreiben kann.
    @chmod($tmp, 0664);
    if (!@rename($tmp, $path)) {
        @unlink($tmp);
        throw new RuntimeException("Atomares Umbenennen fehlgeschlagen: $tmp -> $path");
    }
}

/**
 * Fuehrt den Callback unter exklusivem Filesystem-Lock aus.
 *
 * Lock-Dateien liegen in data/.locks/<name>.lock und werden bei Bedarf
 * angelegt. Sie werden niemals geloescht (Lock-File bleibt persistent,
 * der Lock selbst wird ueber fcntl-flock am Filedescriptor gehalten).
 *
 * @template T
 * @param string $name      Logischer Name der Ressource (z. B. "files", "config").
 * @param callable():T $fn  Der zu schuetzende Code-Block.
 * @return T
 * @throws RuntimeException wenn der Lock nicht erworben werden kann.
 */
function ws_with_lock(string $name, callable $fn)
{
    $lockDir = WS_DATA_DIR . '/.locks';
    if (!is_dir($lockDir) && !@mkdir($lockDir, 0775, true) && !is_dir($lockDir)) {
        throw new RuntimeException("Lock-Verzeichnis nicht anlegbar: $lockDir");
    }
    $safe = preg_replace('/[^a-zA-Z0-9._-]/', '_', $name);
    $lockFile = $lockDir . '/' . $safe . '.lock';
    $fp = @fopen($lockFile, 'c');
    if ($fp === false) {
        throw new RuntimeException("Lock-Datei nicht oeffenbar: $lockFile");
    }
    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        throw new RuntimeException("Lock konnte nicht erworben werden: $name");
    }
    try {
        return $fn();
    } finally {
        flock($fp, LOCK_UN);
        fclose($fp);
    }
}
