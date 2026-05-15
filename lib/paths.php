<?php
/**
 * Zentrale Pfad-Konstanten.
 *
 * Diese Datei wird von ALLEN PHP-Dateien (Helpern wie Endpunkten) als erstes
 * eingebunden. Sie definiert die wichtigsten Verzeichnisse als absolute Pfade.
 */

declare(strict_types=1);

if (defined('WS_BOOTSTRAPPED')) {
    return;
}
define('WS_BOOTSTRAPPED', true);

/** Repo-Root (eine Ebene ueber diesem Verzeichnis). */
define('WS_REPO_ROOT', dirname(__DIR__));

/** Verzeichnis fuer JSON-Persistenz (config, files, schedules). NICHT im DocumentRoot. */
define('WS_DATA_DIR', WS_REPO_ROOT . '/data');

/** Mediendateien (vom Webserver direkt ausgeliefert). */
define('WS_MEDIA_DIR',     WS_REPO_ROOT . '/public/media');
define('WS_UPLOADS_DIR',   WS_MEDIA_DIR . '/uploads');
define('WS_CONVERTED_DIR', WS_MEDIA_DIR . '/converted');
define('WS_STATIC_DIR',    WS_MEDIA_DIR . '/static');
define('WS_WIDGETS_DIR',   WS_STATIC_DIR . '/widgets');

/**
 * URL-Praefixe, die das Frontend zur Bildung von Medien-URLs verwendet.
 * (Aus Browser-Sicht erreichbar als http(s)://<host>/media/...)
 */
define('WS_MEDIA_URL',     '/media');
define('WS_UPLOADS_URL',   WS_MEDIA_URL . '/uploads');
define('WS_CONVERTED_URL', WS_MEDIA_URL . '/converted');
define('WS_STATIC_URL',    WS_MEDIA_URL . '/static');
define('WS_WIDGETS_URL',   WS_STATIC_URL . '/widgets');

/** JSON-Dateien. */
define('WS_CONFIG_FILE',    WS_DATA_DIR . '/config.json');
define('WS_FILES_FILE',     WS_DATA_DIR . '/files.json');
define('WS_SCHEDULES_FILE', WS_DATA_DIR . '/schedules.json');

/**
 * Maximale Upload-Groessen (identisch zu den frueheren Multer-Limits).
 *
 * WICHTIG: die globalen Apache-Limits (upload_max_filesize, post_max_size,
 * memory_limit) muessen mindestens so gross sein wie das groesste Limit
 * hier. Siehe deploy/apache-welcome-screen.conf.
 */
define('WS_MAX_UPLOAD_BYTES',       500 * 1024 * 1024); // Slideshow-Dateien (Bilder/Videos/PDFs)
define('WS_MAX_LOGO_BYTES',           5 * 1024 * 1024); // Logo-Bild
define('WS_MAX_WIDGET_MEDIA_BYTES', 100 * 1024 * 1024); // Widget-Bilder/Videos

/**
 * Stellt sicher, dass die wichtigsten Verzeichnisse existieren.
 * Wird beim Bootstrap aller Endpunkte aufgerufen.
 */
function ws_ensure_dirs(): void
{
    $dirs = [WS_DATA_DIR, WS_UPLOADS_DIR, WS_CONVERTED_DIR, WS_STATIC_DIR, WS_WIDGETS_DIR];
    foreach ($dirs as $dir) {
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new RuntimeException("Verzeichnis nicht anlegbar: $dir");
        }
    }
}
