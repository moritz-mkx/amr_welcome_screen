<?php
/**
 * Endpunkt:  /api/widget-image.php
 *
 * GET    /api/widget-image.php?id=widget-<uuid>.<ext>  - 302-Redirect auf das Widget-Bild
 * DELETE /api/widget-image.php?id=widget-<uuid>.<ext>  - Loescht das Widget-Bild
 *
 * Aequivalent zu:  GET /api/widget-image/:id  und  DELETE /api/widget-image/:id
 */

declare(strict_types=1);

require_once __DIR__ . '/../../lib/api.php';

ws_api_bootstrap();
$method = ws_require_method(['GET', 'DELETE']);

$rawId = ws_query('id');
if ($rawId === null || $rawId === '') {
    ws_error('id ist erforderlich', 400);
}

// Strikte Validierung: nur Dateinamen-Format `widget-<...>.<ext>`,
// keine Pfadbestandteile. ws_safe_id deckt das ab.
$id = ws_safe_id(basename($rawId));
if (!str_starts_with($id, 'widget-')) {
    ws_error('Ungueltige id', 400);
}

$filePath = WS_WIDGETS_DIR . '/' . $id;

if ($method === 'GET') {
    if (!is_file($filePath)) {
        http_response_code(404);
        exit;
    }
    header('Location: ' . WS_WIDGETS_URL . '/' . rawurlencode($id), true, 302);
    exit;
}

// DELETE
if (is_file($filePath)) {
    if (!@unlink($filePath)) {
        ws_error('Datei konnte nicht geloescht werden', 500);
    }
}
ws_json_response(['success' => true]);
