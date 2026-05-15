<?php
/**
 * Endpunkt:  GET /api/active-schedule.php
 *
 * Liefert den aktuell aktiven Schedule (oder null) und die zugehoerige
 * Datei (angereichert mit url/displayUrl). Wird vom Display alle ~15 s
 * abgefragt, um zeitgesteuerte Takeover-Anzeigen zu triggern.
 *
 * Response:
 *   { "schedule": null, "file": null }
 *   { "schedule": { ... }, "file": null }                  (Schedule zeigt auf geloeschte Datei)
 *   { "schedule": { ... }, "file": { ..., url, displayUrl } }
 *
 * Aequivalent zu:  GET /api/active-schedule
 */

declare(strict_types=1);

require_once __DIR__ . '/../../lib/api.php';
require_once __DIR__ . '/../../lib/schedules.php';
require_once __DIR__ . '/../../lib/files.php';

ws_api_bootstrap();
ws_require_method(['GET']);

$schedule = ws_schedules_active(new DateTimeImmutable('now'));
if ($schedule === null) {
    ws_json_response(['schedule' => null, 'file' => null]);
}

$file = ws_files_get((string)$schedule['fileId']);
ws_json_response([
    'schedule' => $schedule,
    'file'     => $file ?: null,
]);
