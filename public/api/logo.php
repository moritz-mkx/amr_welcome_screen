<?php
/**
 * Endpunkt:  GET /api/logo.php
 *
 * 302-Redirect auf das aktuell hinterlegte Logo (public/media/static/logo.<ext>).
 * 404, wenn kein Logo gesetzt ist.
 *
 * Aequivalent zu:  GET /api/logo
 */

declare(strict_types=1);

require_once __DIR__ . '/../../lib/api.php';
require_once __DIR__ . '/../../lib/config.php';

ws_api_bootstrap();
ws_require_method(['GET']);

$url = ws_get_logo_url();
if ($url === null) {
    http_response_code(404);
    exit;
}
header('Location: ' . $url, true, 302);
exit;
