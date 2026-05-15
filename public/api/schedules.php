<?php
/**
 * Endpunkt:  /api/schedules.php
 *
 * GET    /api/schedules.php             - Liste aller Schedules
 * POST   /api/schedules.php             - Schedule anlegen (Body = Schedule-Objekt)
 * PUT    /api/schedules.php?id=<id>     - Schedule aktualisieren (Body = Teil-Update)
 * DELETE /api/schedules.php?id=<id>     - Schedule loeschen
 *
 * Aequivalent zu:
 *   GET    /api/schedules
 *   POST   /api/schedules
 *   PUT    /api/schedules/:id
 *   DELETE /api/schedules/:id
 */

declare(strict_types=1);

require_once __DIR__ . '/../../lib/api.php';
require_once __DIR__ . '/../../lib/schedules.php';
require_once __DIR__ . '/../../lib/files.php';

ws_api_bootstrap();
$method = ws_require_method(['GET', 'POST', 'PUT', 'DELETE']);

// --- GET ------------------------------------------------------------------
if ($method === 'GET') {
    ws_json_response(ws_schedules_all());
}

// --- POST -----------------------------------------------------------------
if ($method === 'POST') {
    $body = ws_read_json_body();
    $fileId = (string)($body['fileId'] ?? '');
    if ($fileId === '' || ws_files_get_raw($fileId) === null) {
        ws_error('Datei nicht gefunden', 400);
    }
    try {
        $schedule = ws_schedules_add($body);
    } catch (InvalidArgumentException $e) {
        ws_error($e->getMessage(), 400);
    }
    ws_json_response($schedule, 201);
}

// --- PUT/DELETE benoetigen id --------------------------------------------
$id = ws_query('id');
if ($id === null || $id === '') {
    ws_error('id ist erforderlich', 400);
}
$id = ws_safe_id($id);

if ($method === 'PUT') {
    $body = ws_read_json_body();
    if (isset($body['fileId'])) {
        $fileId = (string)$body['fileId'];
        if ($fileId === '' || ws_files_get_raw($fileId) === null) {
            ws_error('Datei nicht gefunden', 400);
        }
    }
    try {
        $schedule = ws_schedules_update($id, $body);
    } catch (InvalidArgumentException $e) {
        ws_error($e->getMessage(), 400);
    } catch (RuntimeException $e) {
        if ($e->getMessage() === 'Schedule nicht gefunden') {
            ws_error($e->getMessage(), 404);
        }
        throw $e;
    }
    ws_json_response($schedule);
}

// DELETE
try {
    ws_schedules_delete($id);
} catch (RuntimeException $e) {
    if ($e->getMessage() === 'Schedule nicht gefunden') {
        ws_error($e->getMessage(), 404);
    }
    throw $e;
}
ws_json_response(['success' => true]);
