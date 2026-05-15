<?php
/**
 * Dateien-Service (Metadaten + Filesystem).
 *
 * Port von backend/src/services/fileService.js.
 *
 * Schema von files.json (Etappe 2, geaendert vom alten Node-Schema):
 *   {
 *     "files": [
 *       {
 *         "id":                "<numerischer-String>",
 *         "filename":          "<Datei im uploads-Verzeichnis>",
 *         "originalName":      "<Original-Dateiname beim Upload>",
 *         "type":              "image" | "video" | "pdf",
 *         "mimetype":          "image/png" | ...,
 *         "convertedFilename": "<Datei im converted-Verzeichnis> | null",
 *         "uploadedAt":        "<ISO-8601>",
 *         "size":              <Bytes>,
 *         "hidden":            <bool>
 *       }
 *     ]
 *   }
 *
 * Die alten Felder `path` und `convertedPath` (absolute Filesystem-Pfade)
 * werden NICHT mehr verwendet. URLs werden zur Laufzeit konstruiert.
 */

declare(strict_types=1);

require_once __DIR__ . '/paths.php';
require_once __DIR__ . '/json_store.php';

/**
 * Liest das gesamte Files-Metadaten-Objekt (intern).
 */
function ws_files_load(): array
{
    $data = ws_read_json(WS_FILES_FILE, ['files' => []]);
    if (!is_array($data) || !isset($data['files']) || !is_array($data['files'])) {
        return ['files' => []];
    }
    return $data;
}

/**
 * Reichert ein File-Objekt um url/displayUrl-Felder an (fuer das Frontend).
 *
 * - url:        Original-Datei (Bild/Video/PDF) unter /media/uploads/<filename>
 * - displayUrl: Anzeigeversion (bei PDFs das konvertierte PNG, sonst = url)
 */
function ws_files_enrich(array $f): array
{
    $filename          = (string)($f['filename'] ?? '');
    $convertedFilename = $f['convertedFilename'] ?? null;
    $f['url']        = WS_UPLOADS_URL . '/' . rawurlencode($filename);
    $f['displayUrl'] = $convertedFilename
        ? WS_CONVERTED_URL . '/' . rawurlencode((string)$convertedFilename)
        : $f['url'];
    return $f;
}

/**
 * Gibt alle Dateien (angereichert) zurueck.
 */
function ws_files_all(): array
{
    $data = ws_files_load();
    return array_map('ws_files_enrich', $data['files']);
}

/**
 * Findet eine Datei anhand der ID (angereichert).
 */
function ws_files_get(string $id): ?array
{
    foreach (ws_files_load()['files'] as $f) {
        if ((string)($f['id'] ?? '') === $id) {
            return ws_files_enrich($f);
        }
    }
    return null;
}

/**
 * Liefert das ROHE File-Objekt (ohne url/displayUrl) - z. B. fuer Loeschvorgaenge,
 * die mit `filename`/`convertedFilename` arbeiten muessen.
 */
function ws_files_get_raw(string $id): ?array
{
    foreach (ws_files_load()['files'] as $f) {
        if ((string)($f['id'] ?? '') === $id) {
            return $f;
        }
    }
    return null;
}

/**
 * Fuegt einen neuen Dateieintrag hinzu. $info muss `filename`, `originalName`,
 * `type`, `mimetype`, `size` enthalten; `convertedFilename` ist optional.
 *
 * @return array Das angereicherte neue File-Objekt.
 */
function ws_files_add(array $info): array
{
    return ws_with_lock('files', function () use ($info): array {
        $data = ws_files_load();
        $entry = [
            'id'                => (string)((int)(microtime(true) * 1000)),
            'filename'          => (string)($info['filename'] ?? ''),
            'originalName'      => (string)($info['originalName'] ?? ''),
            'type'              => (string)($info['type'] ?? ''),
            'mimetype'          => $info['mimetype'] ?? null,
            'convertedFilename' => $info['convertedFilename'] ?? null,
            'uploadedAt'        => gmdate('Y-m-d\TH:i:s\Z'),
            'size'              => (int)($info['size'] ?? 0),
            'hidden'            => false,
        ];
        $data['files'][] = $entry;
        ws_write_json_atomic(WS_FILES_FILE, $data);
        return ws_files_enrich($entry);
    });
}

/**
 * Loescht einen Dateieintrag inklusive der zugehoerigen Filesystem-Dateien.
 *
 * @return bool true bei Erfolg, wirft RuntimeException wenn die ID nicht existiert.
 */
function ws_files_delete(string $id): bool
{
    return ws_with_lock('files', function () use ($id): bool {
        $data = ws_files_load();
        $index = null;
        foreach ($data['files'] as $i => $f) {
            if ((string)($f['id'] ?? '') === $id) {
                $index = $i;
                break;
            }
        }
        if ($index === null) {
            throw new RuntimeException('Datei nicht gefunden');
        }
        $entry = $data['files'][$index];

        $filename          = (string)($entry['filename'] ?? '');
        $convertedFilename = $entry['convertedFilename'] ?? null;

        if ($filename !== '') {
            $p = WS_UPLOADS_DIR . '/' . $filename;
            if (is_file($p)) {
                @unlink($p);
            }
        }
        if ($convertedFilename) {
            $p = WS_CONVERTED_DIR . '/' . $convertedFilename;
            if (is_file($p)) {
                @unlink($p);
            }
        }
        array_splice($data['files'], $index, 1);
        ws_write_json_atomic(WS_FILES_FILE, $data);
        return true;
    });
}

/**
 * Aktualisiert einzelne Metadatenfelder einer Datei (z. B. `hidden`).
 *
 * @return array Das angereicherte aktualisierte File-Objekt.
 */
function ws_files_update_meta(string $id, array $updates): array
{
    return ws_with_lock('files', function () use ($id, $updates): array {
        $data = ws_files_load();
        $foundIndex = null;
        foreach ($data['files'] as $i => $f) {
            if ((string)($f['id'] ?? '') === $id) {
                $foundIndex = $i;
                break;
            }
        }
        if ($foundIndex === null) {
            throw new RuntimeException('Datei nicht gefunden');
        }
        $data['files'][$foundIndex] = array_replace($data['files'][$foundIndex], $updates);
        ws_write_json_atomic(WS_FILES_FILE, $data);
        return ws_files_enrich($data['files'][$foundIndex]);
    });
}

/**
 * Setzt eine neue Reihenfolge. $fileIds ist eine Liste von IDs in der
 * gewuenschten Reihenfolge. Nicht aufgefuehrte IDs werden am Ende angehaengt.
 *
 * @param string[] $fileIds
 * @return array Alle Dateien (angereichert) in der neuen Reihenfolge.
 */
function ws_files_reorder(array $fileIds): array
{
    return ws_with_lock('files', function () use ($fileIds): array {
        $data = ws_files_load();
        $byId = [];
        foreach ($data['files'] as $f) {
            $byId[(string)($f['id'] ?? '')] = $f;
        }
        $ordered = [];
        $seen = [];
        foreach ($fileIds as $id) {
            $id = (string)$id;
            if (isset($byId[$id]) && !isset($seen[$id])) {
                $ordered[] = $byId[$id];
                $seen[$id] = true;
            }
        }
        // Nicht erwaehnte Eintraege ans Ende anhaengen (Original-Reihenfolge).
        foreach ($data['files'] as $f) {
            $id = (string)($f['id'] ?? '');
            if (!isset($seen[$id])) {
                $ordered[] = $f;
            }
        }
        $data['files'] = $ordered;
        ws_write_json_atomic(WS_FILES_FILE, $data);
        return array_map('ws_files_enrich', $data['files']);
    });
}
