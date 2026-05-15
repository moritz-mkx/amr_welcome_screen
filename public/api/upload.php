<?php
/**
 * Endpunkt:  POST /api/upload.php
 *
 * Empfaengt einen Multipart-Upload (Feldname: "file") und speichert die
 * Datei in public/media/uploads/. Bei PDF-Dateien wird die erste Seite
 * automatisch in ein PNG konvertiert (poppler-utils / pdftoppm).
 *
 * Erlaubt: image/*, video/*, application/pdf
 *
 * Response (200): { "success": true, "file": { id, filename, url, displayUrl, ... } }
 *
 * Aequivalent zu:  POST /api/upload  (Express/Multer-Variante)
 */

declare(strict_types=1);

require_once __DIR__ . '/../../lib/api.php';
require_once __DIR__ . '/../../lib/upload.php';
require_once __DIR__ . '/../../lib/files.php';
require_once __DIR__ . '/../../lib/pdf.php';

ws_api_bootstrap();
ws_require_method(['POST']);

// 1) Datei validieren
try {
    $validated = ws_upload_validate(
        $_FILES['file'] ?? null,
        ['image/', 'video/', 'application/pdf']
    );
} catch (InvalidArgumentException $e) {
    ws_error($e->getMessage(), 400);
}

// 2) Datei verschieben
$mime = $validated['mimetype'];
$ext  = ws_upload_ext_from_mime($mime); // falls Endung fehlt/falsch, MIME-basiert setzen
$moved = ws_upload_move($validated, WS_UPLOADS_DIR, $ext);

// 3) Typ bestimmen + ggf. PDF konvertieren
$type = str_starts_with($mime, 'video/') ? 'video'
      : (str_starts_with($mime, 'image/') ? 'image'
      : ($mime === 'application/pdf' ? 'pdf' : null));

if ($type === null) {
    // Sollte durch ws_upload_validate ausgeschlossen sein - Defense in depth.
    @unlink($moved['path']);
    ws_error('Ungueltiger Dateityp', 400);
}

$convertedFilename = null;
if ($type === 'pdf') {
    $targetPng = ws_pdf_target_path($moved['filename']);
    try {
        ws_pdf_convert_first_page($moved['path'], $targetPng);
        $convertedFilename = basename($targetPng);
    } catch (Throwable $e) {
        @unlink($moved['path']);
        error_log('[welcome-screen] PDF-Konvertierung fehlgeschlagen: ' . $e->getMessage());
        ws_error(
            'Fehler bei PDF-Konvertierung. Stellen Sie sicher, dass poppler-utils installiert ist.',
            500
        );
    }
}

// 4) Metadaten speichern
$saved = ws_files_add([
    'filename'          => $moved['filename'],
    'originalName'      => $moved['originalName'],
    'type'              => $type,
    'mimetype'          => $mime,
    'convertedFilename' => $convertedFilename,
    'size'              => $moved['size'],
]);

ws_json_response(['success' => true, 'file' => $saved]);
