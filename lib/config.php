<?php
/**
 * Konfigurations-Service.
 *
 * 1:1-Port von backend/src/services/configService.js.
 * Schema und Default-Werte sind identisch, damit die Migration aus dem
 * Node-System verlustfrei funktioniert.
 */

declare(strict_types=1);

require_once __DIR__ . '/paths.php';
require_once __DIR__ . '/json_store.php';

/**
 * Standard-Konfiguration. Wird mit der geladenen config.json gemerged,
 * damit fehlende Felder immer einen sinnvollen Default haben.
 */
function ws_default_config(): array
{
    return [
        'slideInterval'      => 5000,
        'transitionDuration' => 1000,
        'transitionType'     => 'fade',
        'emptyScreenMode'    => 'setup',
        'timeFontSize'       => 160,
        'dateFontSize'       => 42,
        'logoMaxWidth'       => 320,
        'logoMaxHeight'      => 120,
        'screenOrientation'  => 'landscape',
        'clockBackground'    => '#0d0d12',
        'clockWidgets'       => [
            [
                'i'      => 'widget-logo',
                'type'   => 'image',
                'x'      => 4, 'y' => 1, 'w' => 4, 'h' => 2,
                'config' => ['src' => 'logo', 'objectFit' => 'contain'],
            ],
            [
                'i'      => 'widget-clock',
                'type'   => 'clock',
                'x'      => 3, 'y' => 4, 'w' => 6, 'h' => 2,
                'config' => ['fontSize' => 160, 'color' => '#f0f0f5', 'showSeconds' => true],
            ],
            [
                'i'      => 'widget-date',
                'type'   => 'date',
                'x'      => 3, 'y' => 7, 'w' => 6, 'h' => 1,
                'config' => ['fontSize' => 42, 'color' => '#a0a0b0', 'format' => 'long'],
            ],
        ],
    ];
}

/**
 * Laedt die Konfiguration. Existiert noch keine Datei, wird sie mit den
 * Defaults angelegt.
 */
function ws_load_config(): array
{
    $defaults = ws_default_config();
    $current  = ws_read_json(WS_CONFIG_FILE, null);
    if ($current === null) {
        // Initialer Anlauf: Defaults persistieren.
        ws_with_lock('config', function () use ($defaults) {
            // Doppelt pruefen, ob inzwischen jemand anders geschrieben hat.
            if (ws_read_json(WS_CONFIG_FILE, null) === null) {
                ws_write_json_atomic(WS_CONFIG_FILE, $defaults);
            }
        });
        return $defaults;
    }
    if (!is_array($current)) {
        return $defaults;
    }
    return array_replace($defaults, $current);
}

/**
 * Aktualisiert die Konfiguration. $updates wird ueber die bestehende Conf
 * gemerged (shallow), Defaults bleiben als Fallback.
 *
 * @param array $updates
 * @return array Die neue, gemergte Konfiguration.
 */
function ws_update_config(array $updates): array
{
    return ws_with_lock('config', function () use ($updates): array {
        $defaults = ws_default_config();
        $current  = ws_read_json(WS_CONFIG_FILE, []);
        if (!is_array($current)) {
            $current = [];
        }
        $merged = array_replace($defaults, $current, $updates);
        ws_write_json_atomic(WS_CONFIG_FILE, $merged);
        return $merged;
    });
}

/**
 * Liefert den absoluten Pfad zur aktuell hinterlegten Logo-Datei (oder null).
 * Logo wird als `logo.<ext>` in public/media/static/ abgelegt.
 */
function ws_get_logo_path(): ?string
{
    if (!is_dir(WS_STATIC_DIR)) {
        return null;
    }
    $matches = glob(WS_STATIC_DIR . '/logo.*');
    if (!is_array($matches) || count($matches) === 0) {
        return null;
    }
    // Bei mehreren Matches den ersten nehmen (sollte nicht vorkommen,
    // da der Upload-Endpunkt alte Logos loescht).
    return $matches[0];
}

/**
 * Liefert die oeffentliche URL des Logos (oder null).
 */
function ws_get_logo_url(): ?string
{
    $path = ws_get_logo_path();
    if ($path === null) {
        return null;
    }
    return WS_STATIC_URL . '/' . basename($path);
}
