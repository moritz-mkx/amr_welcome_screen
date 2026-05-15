<?php
/**
 * Endpunkt:  /api/config.php
 *
 * GET  /api/config.php             - Liefert die aktuelle Konfiguration.
 * PUT  /api/config.php             - Aktualisiert die Konfiguration.
 *      Body: beliebige Teilmenge der Config-Felder (z. B. slideInterval).
 *
 * Aequivalent zu:  GET /api/config / PUT /api/config
 */

declare(strict_types=1);

require_once __DIR__ . '/../../lib/api.php';
require_once __DIR__ . '/../../lib/config.php';

ws_api_bootstrap();
$method = ws_require_method(['GET', 'PUT']);

if ($method === 'GET') {
    ws_json_response(ws_load_config());
}

// PUT
$updates = ws_read_json_body();
$config  = ws_update_config($updates);
ws_json_response($config);
