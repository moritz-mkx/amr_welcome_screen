<?php
/**
 * Display-Seite (Slideshow / Uhr-Screen / Einrichtungs-Hilfe).
 *
 * Dieses PHP-File rendert nur das HTML-Geruest. Die gesamte Anzeige-Logik
 * (Polling, Fade-Uebergaenge, Schedule-Takeover) liegt in
 *   /assets/js/display.js   (ES-Module mit api.js + renderWidget.js)
 *
 * Wird vom Kiosk-Browser auf dem Pi unter http://localhost/ geoeffnet.
 */

// Cache-Kontrolle: das HTML selbst nicht aggressiv cachen, damit Updates
// (z. B. neue JS-/CSS-Dateien) ankommen. Die Asset-URLs tragen einen
// Build-Buster (filemtime).
header('Cache-Control: no-cache, max-age=0');

/**
 * Liefert eine asset-URL mit Cache-Buster basierend auf der letzten
 * Aenderungszeit der Datei. Faellt zurueck auf die nackte URL, wenn die
 * Datei nicht existiert (z. B. waehrend Entwicklung im falschen CWD).
 */
function asset(string $relativePath): string
{
    $abs = __DIR__ . '/' . ltrim($relativePath, '/');
    $mtime = @filemtime($abs);
    $base = '/' . ltrim($relativePath, '/');
    return $mtime ? ($base . '?v=' . $mtime) : $base;
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Welcome Screen</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex,nofollow">
    <link rel="stylesheet" href="<?= htmlspecialchars(asset('assets/css/display.css'), ENT_QUOTES) ?>">
</head>
<body>
    <div id="display-root">
        <div class="slideshow-container loading">
            <div class="loading-spinner">Lade&hellip;</div>
        </div>
    </div>
    <script type="module" src="<?= htmlspecialchars(asset('assets/js/display.js'), ENT_QUOTES) ?>"></script>
    <noscript>
        <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
                    background:#111;color:#fff;font-family:sans-serif;text-align:center;padding:24px;">
            <div>
                <h1>JavaScript ist deaktiviert</h1>
                <p>Die Slideshow ben&ouml;tigt JavaScript. Bitte im Browser aktivieren.</p>
            </div>
        </div>
    </noscript>
</body>
</html>
