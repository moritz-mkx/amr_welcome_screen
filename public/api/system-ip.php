<?php
/**
 * Endpunkt:  GET /api/system-ip.php
 *
 * Liefert die IPv4-Adresse(n) aller nicht-loopback Netzwerkinterfaces.
 * Wird vom SetupGuide auf der Display-Seite angezeigt, damit der Admin
 * weiss, unter welcher IP der Pi im LAN erreichbar ist.
 *
 * Response:  { "ips": ["192.168.1.42"] }  oder  { "ips": null }
 *
 * Aequivalent zu:  GET /api/system/ip
 */

declare(strict_types=1);

require_once __DIR__ . '/../../lib/api.php';

ws_api_bootstrap();
ws_require_method(['GET']);

$ips = [];

// PHP 7.3+ liefert die Interface-Liste sauber inkl. IPv4/IPv6.
// `@` unterdrueckt Warnings, falls die Plattform den Syscall verweigert
// (kommt z. B. in restriktiv konfigurierten Containern vor). Wir loggen
// stattdessen leise und liefern { ips: null } zurueck.
if (function_exists('net_get_interfaces')) {
    $interfaces = @net_get_interfaces();
    if (is_array($interfaces)) {
        foreach ($interfaces as $name => $info) {
            $unicast = $info['unicast'] ?? [];
            if (!is_array($unicast)) {
                continue;
            }
            foreach ($unicast as $entry) {
                $address = (string)($entry['address'] ?? '');
                $family  = (int)($entry['family'] ?? 0); // AF_INET=2, AF_INET6=10
                if ($family !== AF_INET || $address === '') {
                    continue;
                }
                // Loopback und Link-Local ausschliessen.
                if (str_starts_with($address, '127.') || str_starts_with($address, '169.254.')) {
                    continue;
                }
                $ips[] = $address;
            }
        }
    }
}

// Fallback: REMOTE_ADDR der Anfrage (nur sinnvoll, wenn ueber LAN aufgerufen).
if (count($ips) === 0) {
    $local = $_SERVER['SERVER_ADDR'] ?? '';
    if (is_string($local) && $local !== '' && $local !== '127.0.0.1' && $local !== '::1') {
        $ips[] = $local;
    }
}

ws_json_response(['ips' => count($ips) > 0 ? array_values(array_unique($ips)) : null]);
