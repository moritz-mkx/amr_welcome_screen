<?php
/**
 * Admin-Panel (Konfigurations-Oberflaeche).
 *
 * Tabs werden ueber `?tab=...` adressiert:
 *   files     - Datei-Upload und -Liste
 *   settings  - Slideshow- und Anzeige-Einstellungen
 *   schedule  - Geplante Anzeigen
 *   clock     - Uhr-Screen-Editor (kommt in Etappe 5)
 *
 * PHP rendert nur Layout und Navigation. Die Tab-Inhalte werden dynamisch
 * per JavaScript (assets/js/admin.js) geladen.
 */

declare(strict_types=1);

header('Cache-Control: no-cache, max-age=0');

$validTabs   = ['files', 'settings', 'schedule', 'clock'];
$activeTab   = $_GET['tab'] ?? 'files';
if (!in_array($activeTab, $validTabs, true)) {
    $activeTab = 'files';
}

/**
 * Liefert eine asset-URL mit Cache-Buster (basierend auf filemtime).
 */
function asset(string $relativePath): string
{
    $abs = __DIR__ . '/' . ltrim($relativePath, '/');
    $mtime = @filemtime($abs);
    $base = '/' . ltrim($relativePath, '/');
    return $mtime ? ($base . '?v=' . $mtime) : $base;
}

$tabLabels = [
    'files'    => 'Dateien',
    'settings' => 'Einstellungen',
    'clock'    => 'Uhr-Screen',
    'schedule' => 'Planung',
];
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Welcome Screen &ndash; Konfiguration</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex,nofollow">
    <link rel="stylesheet" href="<?= htmlspecialchars(asset('assets/css/admin.css'), ENT_QUOTES) ?>">
</head>
<body>
    <div class="admin-panel">
        <header class="admin-header">
            <h1>Welcome Screen Konfiguration</h1>
            <nav class="admin-nav">
                <?php foreach ($tabLabels as $key => $label): ?>
                    <a
                        href="?tab=<?= htmlspecialchars($key, ENT_QUOTES) ?>"
                        class="<?= $key === $activeTab ? 'active' : '' ?>"
                    ><?= htmlspecialchars($label) ?></a>
                <?php endforeach; ?>
                <a href="/" class="preview-link" target="_blank" rel="noopener">Vorschau</a>
            </nav>
        </header>

        <main class="admin-content">
            <div class="admin-tab" id="tab-root" data-active-tab="<?= htmlspecialchars($activeTab, ENT_QUOTES) ?>">
                <div class="loading">Lade&hellip;</div>
            </div>
        </main>
    </div>

    <script type="module" src="<?= htmlspecialchars(asset('assets/js/admin.js'), ENT_QUOTES) ?>"></script>
    <noscript>
        <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
                    background:#111;color:#fff;font-family:sans-serif;text-align:center;padding:24px;">
            <div>
                <h1>JavaScript ist deaktiviert</h1>
                <p>Das Admin-Panel ben&ouml;tigt JavaScript. Bitte im Browser aktivieren.</p>
            </div>
        </div>
    </noscript>
</body>
</html>
