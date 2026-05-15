<?php
/**
 * PDF-Konvertierung via poppler-utils (`pdftoppm`).
 *
 * Port von backend/src/services/pdfConverter.js.
 *
 * Sicherheit: wir nutzen proc_open() mit Array-Argumenten, sodass PHP
 * `execvp` direkt aufruft und KEINE Shell zwischengeschaltet ist. Damit
 * sind Shell-Injection-Angriffe ueber Dateinamen ausgeschlossen, auch
 * ohne escapeshellarg().
 *
 * Voraussetzung: `pdftoppm` muss im PATH liegen (Paket `poppler-utils`).
 */

declare(strict_types=1);

require_once __DIR__ . '/paths.php';

/**
 * Konvertiert die erste Seite einer PDF in ein PNG.
 *
 * @param string $pdfPath        Absoluter Pfad zur PDF-Datei.
 * @param string $outputPngPath  Absoluter Zielpfad inkl. `.png`-Endung.
 * @return string Der tatsaechlich erzeugte Pfad ($outputPngPath).
 * @throws RuntimeException bei Fehlern.
 */
function ws_pdf_convert_first_page(string $pdfPath, string $outputPngPath): string
{
    if (!is_file($pdfPath)) {
        throw new RuntimeException("PDF nicht gefunden: $pdfPath");
    }
    $outDir = dirname($outputPngPath);
    if (!is_dir($outDir) && !@mkdir($outDir, 0775, true) && !is_dir($outDir)) {
        throw new RuntimeException("Verzeichnis nicht anlegbar: $outDir");
    }

    // pdftoppm haengt automatisch '-<seite>.png' an den Prefix an.
    $prefix    = preg_replace('/\.png$/i', '', $outputPngPath) ?? $outputPngPath;
    $generated = $prefix . '-1.png';

    // Falls aus einem frueheren Versuch noch existiert: aufraeumen.
    if (is_file($generated)) {
        @unlink($generated);
    }

    $cmd = ['pdftoppm', '-png', '-f', '1', '-l', '1', $pdfPath, $prefix];
    $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];

    $proc = @proc_open($cmd, $descriptors, $pipes);
    if (!is_resource($proc)) {
        throw new RuntimeException('pdftoppm konnte nicht gestartet werden (Paket poppler-utils installiert?)');
    }
    fclose($pipes[0]);
    $stdout = stream_get_contents($pipes[1]) ?: '';
    $stderr = stream_get_contents($pipes[2]) ?: '';
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exit = proc_close($proc);

    if ($exit !== 0) {
        $msg = trim($stderr) !== '' ? trim($stderr) : trim($stdout);
        throw new RuntimeException("pdftoppm fehlgeschlagen (exit $exit): $msg");
    }
    if (!is_file($generated)) {
        throw new RuntimeException("pdftoppm erzeugte keine Datei: $generated");
    }
    if ($generated !== $outputPngPath && !@rename($generated, $outputPngPath)) {
        throw new RuntimeException("Umbenennen fehlgeschlagen: $generated -> $outputPngPath");
    }
    return $outputPngPath;
}

/**
 * Berechnet einen Zielpfad fuer das konvertierte PNG basierend auf dem
 * Original-Dateinamen.
 *
 * Beispiel:  "1234-foo.pdf"  ->  WS_CONVERTED_DIR . "/1234-foo_page1.png"
 */
function ws_pdf_target_path(string $originalFilename): string
{
    $base = pathinfo($originalFilename, PATHINFO_FILENAME);
    return WS_CONVERTED_DIR . '/' . $base . '_page1.png';
}
