<?php
/**
 * HTTP-/JSON-Helpers fuer alle API-Endpunkte.
 *
 * Konvention: Endpunkte rufen am Anfang ws_api_bootstrap() auf und schicken
 * ihre Antworten ausschliesslich ueber ws_json_response() / ws_error().
 * Unerwartete Exceptions werden zentral abgefangen und als 500er JSON
 * ausgeliefert (statt eines PHP-HTML-Errors).
 */

declare(strict_types=1);

require_once __DIR__ . '/paths.php';
require_once __DIR__ . '/json_store.php';

/**
 * Initialisiert den API-Kontext:
 *   - Verzeichnisse anlegen
 *   - JSON-Content-Type setzen
 *   - Globaler Exception-Handler -> 500 JSON
 *
 * Muss als allererstes in jedem Endpunkt aufgerufen werden.
 */
function ws_api_bootstrap(): void
{
    ws_ensure_dirs();
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');

    set_exception_handler(function (Throwable $e): void {
        // Logging: an Error-Log, sichtbar im Apache-Log.
        error_log('[welcome-screen] Unhandled exception: ' . $e->getMessage()
            . ' in ' . $e->getFile() . ':' . $e->getLine());
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode(['error' => 'Interner Serverfehler']);
        exit;
    });
}

/**
 * Liefert eine JSON-Antwort aus und beendet die Ausfuehrung.
 *
 * @param mixed $data
 */
function ws_json_response($data, int $status = 200): void
{
    if (!headers_sent()) {
        http_response_code($status);
    }
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Liefert eine Fehler-JSON-Antwort aus und beendet die Ausfuehrung.
 */
function ws_error(string $message, int $status = 400, array $extra = []): void
{
    ws_json_response(array_merge(['error' => $message], $extra), $status);
}

/**
 * Liest den Request-Body als JSON-Objekt ein.
 * Bei leerem Body wird ein leeres Array zurueckgegeben.
 *
 * @return array
 */
function ws_read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        ws_error('Ungueltiger JSON-Body', 400);
    }
    return $data;
}

/**
 * Methoden-Whitelist. Bei ungueltiger Methode wird sofort 405 ausgeliefert.
 *
 * @param string[] $allowed
 */
function ws_require_method(array $allowed): string
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, $allowed, true)) {
        header('Allow: ' . implode(', ', $allowed));
        ws_error('Methode nicht erlaubt: ' . $method, 405);
    }
    return $method;
}

/**
 * Liefert einen Query-Parameter (oder $default).
 */
function ws_query(string $name, ?string $default = null): ?string
{
    if (!isset($_GET[$name])) {
        return $default;
    }
    $v = $_GET[$name];
    return is_string($v) ? $v : $default;
}

/**
 * Validiert eine ID gegen ein Pattern (nur alphanumerisch + Bindestrich/Punkt
 * /Unterstrich). Wirft 400-Error, wenn ungueltig.
 */
function ws_safe_id(string $value, string $fieldName = 'id'): string
{
    if ($value === '' || !preg_match('/^[A-Za-z0-9._-]+$/', $value)) {
        ws_error("Ungueltige $fieldName", 400);
    }
    return $value;
}
