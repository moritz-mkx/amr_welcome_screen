<?php
/**
 * Endpunkt:  /api/files-order.php
 *
 * PUT  /api/files-order.php
 *      Body: { "fileIds": ["<id1>", "<id2>", ...] }
 *
 * Aktualisiert die Reihenfolge der Dateien. Nicht aufgefuehrte IDs
 * werden in ihrer urspruenglichen Reihenfolge am Ende angehaengt.
 *
 * Aequivalent zu:  PUT /api/files/order
 */

declare(strict_types=1);

require_once __DIR__ . '/../../lib/api.php';
require_once __DIR__ . '/../../lib/files.php';

ws_api_bootstrap();
ws_require_method(['PUT']);

$body = ws_read_json_body();
$fileIds = $body['fileIds'] ?? null;
if (!is_array($fileIds)) {
    ws_error('fileIds muss ein Array sein', 400);
}
// Stringifizieren (das Frontend schickt evtl. Zahlen).
$fileIds = array_map('strval', $fileIds);

$files = ws_files_reorder($fileIds);
ws_json_response($files);
