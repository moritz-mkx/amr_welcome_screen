<?php
/**
 * Endpunkt:  POST /api/config-logo.php
 *
 * Akzeptiert einen Multipart-Upload (Feldname: "logo") und speichert das
 * Bild als `logo.<ext>` in public/media/static/. Bestehende Logos werden
 * ersetzt.
 *
 * Erlaubt: image/* (auch image/svg+xml).
 *
 * Aequivalent zu:  POST /api/config/logo
 */

declare(strict_types=1);

require_once __DIR__ . '/../../lib/api.php';
require_once __DIR__ . '/../../lib/upload.php';

ws_api_bootstrap();
ws_require_method(['POST']);

try {
    $validated = ws_upload_validate(
        $_FILES['logo'] ?? null,
        ['image/'],
        WS_MAX_LOGO_BYTES
    );
} catch (InvalidArgumentException $e) {
    ws_error($e->getMessage(), 400);
}

$ext = ws_upload_ext_from_mime($validated['mimetype']);
if ($ext === '') {
    ws_error('Logo-Dateityp nicht unterstuetzt: ' . $validated['mimetype'], 400);
}

// Bestehende Logos loeschen (alle Endungen).
foreach (glob(WS_STATIC_DIR . '/logo.*') ?: [] as $existing) {
    if (is_file($existing)) {
        @unlink($existing);
    }
}

// Direkt in WS_STATIC_DIR/logo.<ext> ablegen.
$target = WS_STATIC_DIR . '/logo.' . $ext;
if (!is_dir(WS_STATIC_DIR) && !@mkdir(WS_STATIC_DIR, 0775, true) && !is_dir(WS_STATIC_DIR)) {
    ws_error('Static-Verzeichnis nicht anlegbar', 500);
}
if (!@move_uploaded_file($validated['tmp_name'], $target)) {
    ws_error('Logo konnte nicht gespeichert werden', 500);
}
@chmod($target, 0664);

ws_json_response(['success' => true]);
