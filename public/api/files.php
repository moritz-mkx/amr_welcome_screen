<?php
/**
 * Endpunkt:  /api/files.php
 *
 * GET    /api/files.php                              - Liste aller Dateien
 * GET    /api/files.php?id=<id>                      - 302-Redirect auf die Original-Datei
 * GET    /api/files.php?id=<id>&display=1            - 302-Redirect auf die Anzeigeversion
 *                                                      (konvertiertes PNG bei PDFs, sonst = Original)
 * DELETE /api/files.php?id=<id>                      - Loescht Eintrag + Filesystem-Datei(en)
 *                                                      und alle Schedules, die darauf verweisen
 * PUT    /api/files.php?id=<id>&action=toggle-hidden - Schaltet `hidden` um
 *
 * Aequivalent zu den Express-Routen in backend/src/routes/api.js:
 *   GET    /api/files
 *   GET    /api/files/:id
 *   GET    /api/files/:id/display
 *   DELETE /api/files/:id
 *   PUT    /api/files/:id/toggle-hidden
 */

declare(strict_types=1);

require_once __DIR__ . '/../../lib/api.php';
require_once __DIR__ . '/../../lib/files.php';
require_once __DIR__ . '/../../lib/schedules.php';

ws_api_bootstrap();
$method = ws_require_method(['GET', 'DELETE', 'PUT']);

$id = ws_query('id');

// --- GET ------------------------------------------------------------------
if ($method === 'GET') {
    if ($id === null) {
        ws_json_response(ws_files_all());
    }
    $id = ws_safe_id($id);
    $file = ws_files_get($id);
    if ($file === null) {
        ws_error('Datei nicht gefunden', 404);
    }
    // 302 auf die statische URL - Apache liefert direkt.
    $url = (ws_query('display') === '1') ? $file['displayUrl'] : $file['url'];
    header('Location: ' . $url, true, 302);
    exit;
}

// --- DELETE ---------------------------------------------------------------
if ($method === 'DELETE') {
    if ($id === null) {
        ws_error('id ist erforderlich', 400);
    }
    $id = ws_safe_id($id);
    try {
        ws_files_delete($id);
    } catch (RuntimeException $e) {
        if ($e->getMessage() === 'Datei nicht gefunden') {
            ws_error($e->getMessage(), 404);
        }
        throw $e;
    }
    // Schedules, die auf diese Datei verweisen, mitlöschen (best effort).
    try {
        ws_schedules_delete_by_file($id);
    } catch (Throwable $e) {
        error_log('[welcome-screen] Schedule-Cleanup fehlgeschlagen: ' . $e->getMessage());
    }
    ws_json_response(['success' => true, 'message' => 'Datei geloescht']);
}

// --- PUT (toggle-hidden) --------------------------------------------------
if ($method === 'PUT') {
    if ($id === null) {
        ws_error('id ist erforderlich', 400);
    }
    $id = ws_safe_id($id);
    $action = ws_query('action');
    if ($action !== 'toggle-hidden') {
        ws_error('Unbekannte action: ' . (string)$action, 400);
    }
    $current = ws_files_get_raw($id);
    if ($current === null) {
        ws_error('Datei nicht gefunden', 404);
    }
    $updated = ws_files_update_meta($id, ['hidden' => !($current['hidden'] ?? false)]);
    ws_json_response($updated);
}
