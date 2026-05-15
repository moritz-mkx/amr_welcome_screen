<?php
/**
 * Endpunkt:  POST /api/widget-media.php
 *
 * Empfaengt einen Multipart-Upload (Feldname: "media" oder "image") und
 * speichert die Datei als `widget-<uuid>.<ext>` in public/media/static/widgets/.
 *
 * Erlaubt: image/*, video/*
 *
 * Response: { "success": true, "id": "widget-<uuid>.<ext>", "mediaType": "image|video" }
 *
 * Aequivalent zu:  POST /api/widget-media UND POST /api/widget-image
 */

declare(strict_types=1);

require_once __DIR__ . '/../../lib/api.php';
require_once __DIR__ . '/../../lib/upload.php';

ws_api_bootstrap();
ws_require_method(['POST']);

// Frontend nutzt teilweise das Feld "image" (Legacy), teilweise "media".
$file = $_FILES['media'] ?? ($_FILES['image'] ?? null);

try {
    $validated = ws_upload_validate(
        $file,
        ['image/', 'video/'],
        WS_MAX_WIDGET_MEDIA_BYTES
    );
} catch (InvalidArgumentException $e) {
    ws_error($e->getMessage(), 400);
}

$mime      = $validated['mimetype'];
$ext       = ws_upload_ext_from_mime($mime);
$mediaType = str_starts_with($mime, 'video/') ? 'video' : 'image';

if ($ext === '') {
    ws_error('Widget-Dateityp nicht unterstuetzt: ' . $mime, 400);
}

// Eindeutiger Dateiname: widget-<uuid>.<ext>
$id     = 'widget-' . ws_random_uuid();
$target = WS_WIDGETS_DIR . '/' . $id . '.' . $ext;

if (!is_dir(WS_WIDGETS_DIR) && !@mkdir(WS_WIDGETS_DIR, 0775, true) && !is_dir(WS_WIDGETS_DIR)) {
    ws_error('Widget-Verzeichnis nicht anlegbar', 500);
}
if (!@move_uploaded_file($validated['tmp_name'], $target)) {
    ws_error('Datei konnte nicht gespeichert werden', 500);
}
@chmod($target, 0664);

ws_json_response([
    'success'   => true,
    'id'        => basename($target),
    'mediaType' => $mediaType,
]);

/**
 * Erzeugt eine UUID v4 (kryptographisch sicher).
 * Nicht in lib/, weil nur hier gebraucht.
 */
function ws_random_uuid(): string
{
    $bytes = random_bytes(16);
    // Version 4
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    // Variant 10xx
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return sprintf(
        '%s-%s-%s-%s-%s',
        substr($hex, 0, 8),
        substr($hex, 8, 4),
        substr($hex, 12, 4),
        substr($hex, 16, 4),
        substr($hex, 20, 12)
    );
}
