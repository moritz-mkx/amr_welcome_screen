<?php
/**
 * Schedules-Service.
 *
 * 1:1-Port von backend/src/services/scheduleService.js.
 * Schema und Berechnungslogik (lokale Zeitzone, once/daily/weekly,
 * Wochentag-Indexierung 0=So..6=Sa) muessen IDENTISCH bleiben, damit
 * migrierte Schedules vom alten Node-Backend unveraendert weiterlaufen.
 */

declare(strict_types=1);

require_once __DIR__ . '/paths.php';
require_once __DIR__ . '/json_store.php';

const WS_SCHEDULE_TYPES    = ['once', 'daily', 'weekly'];
const WS_SCHEDULE_PRIORITY = ['once' => 3, 'weekly' => 2, 'daily' => 1];

/** Laedt alle Schedules (Roh-Array). */
function ws_schedules_all(): array
{
    $data = ws_read_json(WS_SCHEDULES_FILE, ['schedules' => []]);
    if (!is_array($data) || !isset($data['schedules']) || !is_array($data['schedules'])) {
        return [];
    }
    return $data['schedules'];
}

/** Findet einen Schedule per ID. */
function ws_schedules_get(string $id): ?array
{
    foreach (ws_schedules_all() as $s) {
        if ((string)($s['id'] ?? '') === $id) {
            return $s;
        }
    }
    return null;
}

/** Generiert eine neue, zeitbasierte ID. */
function ws_schedules_new_id(): string
{
    return (string)((int)(microtime(true) * 1000)) . str_pad((string)random_int(0, 999), 3, '0', STR_PAD_LEFT);
}

/**
 * Normalisiert/validiert ein Schedule-Objekt. Erwartet das gemergte Objekt
 * (also $input bereits mit $existing zusammengefuehrt, falls Update).
 *
 * Wirft InvalidArgumentException bei fachlichen Fehlern - der Endpunkt
 * uebersetzt die in 400er HTTP-Antworten.
 */
function ws_schedules_normalize(array $input, ?array $existing = null): array
{
    $recurrenceIn = is_array($input['recurrence'] ?? null) ? $input['recurrence']
        : (is_array($existing['recurrence'] ?? null) ? $existing['recurrence'] : []);

    $type = (string)($recurrenceIn['type'] ?? 'once');
    if (!in_array($type, WS_SCHEDULE_TYPES, true)) {
        $type = 'once';
    }

    $startDate = (string)($recurrenceIn['startDate']
        ?? ($existing['recurrence']['startDate'] ?? ''));
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate)) {
        throw new InvalidArgumentException('recurrence.startDate (YYYY-MM-DD) ist erforderlich');
    }

    $endDate = $recurrenceIn['endDate'] ?? null;
    if ($endDate === null && isset($existing['recurrence']['endDate'])) {
        $endDate = $existing['recurrence']['endDate'];
    }
    if ($type === 'once') {
        $endDate = $startDate;
    } elseif ($endDate !== null && $endDate !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$endDate)) {
        throw new InvalidArgumentException('recurrence.endDate muss YYYY-MM-DD sein oder null');
    } elseif ($endDate === '') {
        $endDate = null;
    }

    $weekdays = $recurrenceIn['weekdays'] ?? ($existing['recurrence']['weekdays'] ?? null);
    if ($type === 'weekly') {
        if (!is_array($weekdays) || count($weekdays) === 0) {
            throw new InvalidArgumentException('Bei woechentlicher Wiederholung muss mindestens ein Wochentag gewaehlt sein');
        }
        $weekdays = array_values(array_filter(
            array_map('intval', $weekdays),
            static fn ($n) => $n >= 0 && $n <= 6
        ));
        if (count($weekdays) === 0) {
            throw new InvalidArgumentException('weekdays muss Zahlen 0-6 enthalten (0=So..6=Sa)');
        }
    } else {
        $weekdays = null;
    }

    $interval = (int)($recurrenceIn['interval']
        ?? ($existing['recurrence']['interval'] ?? 1));
    if ($interval < 1) {
        $interval = 1;
    }

    $startTime = (string)($input['startTime'] ?? ($existing['startTime'] ?? ''));
    if (!preg_match('/^(\d{2}):(\d{2})$/', $startTime, $m)) {
        throw new InvalidArgumentException('startTime (HH:MM) ist erforderlich');
    }
    [$hh, $mm] = [(int)$m[1], (int)$m[2]];
    if ($hh < 0 || $hh > 23 || $mm < 0 || $mm > 59) {
        throw new InvalidArgumentException('startTime muss eine gueltige Uhrzeit sein (HH:MM)');
    }

    $durationMinutes = $input['durationMinutes'] ?? ($existing['durationMinutes'] ?? null);
    if (!is_numeric($durationMinutes) || (int)$durationMinutes < 1) {
        throw new InvalidArgumentException('durationMinutes muss eine positive Zahl sein');
    }
    $durationMinutes = (int)$durationMinutes;

    $fileId = (string)($input['fileId'] ?? ($existing['fileId'] ?? ''));
    if ($fileId === '') {
        throw new InvalidArgumentException('fileId ist erforderlich');
    }

    $name = (string)($input['name'] ?? ($existing['name'] ?? ''));

    if (array_key_exists('enabled', $input)) {
        $enabled = (bool)$input['enabled'];
    } elseif ($existing !== null) {
        $enabled = (bool)($existing['enabled'] ?? false);
    } else {
        $enabled = true;
    }

    $normalized = [
        'id'              => $existing['id'] ?? ws_schedules_new_id(),
        'name'            => $name,
        'fileId'          => $fileId,
        'startTime'       => $startTime,
        'durationMinutes' => $durationMinutes,
        'recurrence'      => [
            'type'      => $type,
            'startDate' => $startDate,
            'endDate'   => $endDate,
            'interval'  => $interval,
        ],
        'enabled'         => $enabled,
        'createdAt'       => $existing['createdAt'] ?? gmdate('Y-m-d\TH:i:s\Z'),
    ];
    if ($type === 'weekly') {
        $normalized['recurrence']['weekdays'] = $weekdays;
    }
    return $normalized;
}

/** Persistiert die komplette Schedule-Liste. */
function ws_schedules_save(array $schedules): void
{
    ws_write_json_atomic(WS_SCHEDULES_FILE, ['schedules' => array_values($schedules)]);
}

/** Fuegt einen neuen Schedule hinzu. */
function ws_schedules_add(array $input): array
{
    return ws_with_lock('schedules', function () use ($input): array {
        $schedule = ws_schedules_normalize($input, null);
        $list = ws_schedules_all();
        $list[] = $schedule;
        ws_schedules_save($list);
        return $schedule;
    });
}

/** Aktualisiert einen Schedule. Wirft RuntimeException 'Schedule nicht gefunden'. */
function ws_schedules_update(string $id, array $updates): array
{
    return ws_with_lock('schedules', function () use ($id, $updates): array {
        $list = ws_schedules_all();
        $idx = null;
        foreach ($list as $i => $s) {
            if ((string)($s['id'] ?? '') === $id) {
                $idx = $i;
                break;
            }
        }
        if ($idx === null) {
            throw new RuntimeException('Schedule nicht gefunden');
        }
        $existing = $list[$idx];
        $merged = array_replace($existing, $updates);
        // recurrence-Sub-Objekt separat mergen, damit Teil-Updates funktionieren.
        $merged['recurrence'] = array_replace(
            is_array($existing['recurrence'] ?? null) ? $existing['recurrence'] : [],
            is_array($updates['recurrence'] ?? null) ? $updates['recurrence'] : []
        );
        $normalized = ws_schedules_normalize($merged, $existing);
        $list[$idx] = $normalized;
        ws_schedules_save($list);
        return $normalized;
    });
}

/** Loescht einen Schedule. Wirft RuntimeException 'Schedule nicht gefunden'. */
function ws_schedules_delete(string $id): bool
{
    return ws_with_lock('schedules', function () use ($id): bool {
        $list = ws_schedules_all();
        $before = count($list);
        $list = array_values(array_filter(
            $list,
            static fn (array $s): bool => (string)($s['id'] ?? '') !== $id
        ));
        if (count($list) === $before) {
            throw new RuntimeException('Schedule nicht gefunden');
        }
        ws_schedules_save($list);
        return true;
    });
}

/** Loescht alle Schedules, die auf eine bestimmte fileId verweisen. */
function ws_schedules_delete_by_file(string $fileId): int
{
    return ws_with_lock('schedules', function () use ($fileId): int {
        $list = ws_schedules_all();
        $before = count($list);
        $list = array_values(array_filter(
            $list,
            static fn (array $s): bool => (string)($s['fileId'] ?? '') !== $fileId
        ));
        $removed = $before - count($list);
        if ($removed > 0) {
            ws_schedules_save($list);
        }
        return $removed;
    });
}

// --- Aktivitaets-Berechnung (Pendant zu scheduleService.js) ---

/** Tagesdifferenz zweier DateTimeImmutable (lokale Mitternacht). */
function ws_schedules_diff_days(DateTimeImmutable $a, DateTimeImmutable $b): int
{
    $aMid = $a->setTime(0, 0, 0);
    $bMid = $b->setTime(0, 0, 0);
    $diff = $bMid->diff($aMid);
    $days = $diff->days;
    return $diff->invert ? -$days : $days;
}

/** Montag der Woche, in der $date liegt (lokale Zeit). */
function ws_schedules_monday_of_week(DateTimeImmutable $date): DateTimeImmutable
{
    $d = $date->setTime(0, 0, 0);
    // PHP: 0=Sonntag..6=Samstag (format 'w'); identisch zu JS getDay().
    $day = (int)$d->format('w');
    $diffToMonday = ($day + 6) % 7;
    return $d->modify("-{$diffToMonday} days");
}

/** Prueft, ob ein Schedule zum Zeitpunkt $now (DateTimeImmutable, lokal) aktiv ist. */
function ws_schedules_is_active_at(array $schedule, DateTimeImmutable $now): bool
{
    if (empty($schedule['enabled'])) {
        return false;
    }
    $rec = is_array($schedule['recurrence'] ?? null) ? $schedule['recurrence'] : [];
    $startDateStr = (string)($rec['startDate'] ?? '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDateStr)) {
        return false;
    }
    $startDate = DateTimeImmutable::createFromFormat('!Y-m-d', $startDateStr);
    if ($startDate === false) {
        return false;
    }
    $today = $now->setTime(0, 0, 0);
    if ($today < $startDate) {
        return false;
    }
    if (!empty($rec['endDate'])) {
        $endDate = DateTimeImmutable::createFromFormat('!Y-m-d', (string)$rec['endDate']);
        if ($endDate === false || $today > $endDate) {
            return false;
        }
    }

    [$hh, $mm] = array_map('intval', explode(':', (string)$schedule['startTime']));
    $startMinutes = $hh * 60 + $mm;
    $endMinutes   = min($startMinutes + (int)$schedule['durationMinutes'], 24 * 60);
    $nowMinutes   = ((int)$now->format('H')) * 60 + (int)$now->format('i');
    if ($nowMinutes < $startMinutes || $nowMinutes >= $endMinutes) {
        return false;
    }

    $interval = (int)($rec['interval'] ?? 1);
    if ($interval < 1) {
        $interval = 1;
    }
    $type = (string)($rec['type'] ?? 'once');

    if ($type === 'once') {
        return $today->format('Y-m-d') === $startDateStr;
    }
    if ($type === 'daily') {
        $days = ws_schedules_diff_days($today, $startDate);
        return $days >= 0 && ($days % $interval) === 0;
    }
    if ($type === 'weekly') {
        $weekdays = is_array($rec['weekdays'] ?? null) ? $rec['weekdays'] : [];
        if (!in_array((int)$now->format('w'), $weekdays, true)) {
            return false;
        }
        $weeks = (int)floor(
            ws_schedules_diff_days(
                ws_schedules_monday_of_week($today),
                ws_schedules_monday_of_week($startDate)
            ) / 7
        );
        return $weeks >= 0 && ($weeks % $interval) === 0;
    }
    return false;
}

/**
 * Liefert den aktuell aktiven Schedule (oder null).
 * Sortierung: once > weekly > daily; bei Gleichstand: neuere createdAt zuerst.
 */
function ws_schedules_active(?DateTimeImmutable $now = null): ?array
{
    $now ??= new DateTimeImmutable('now');
    $active = array_values(array_filter(
        ws_schedules_all(),
        static fn (array $s): bool => ws_schedules_is_active_at($s, $now)
    ));
    if (count($active) === 0) {
        return null;
    }
    usort($active, static function (array $a, array $b): int {
        $pa = WS_SCHEDULE_PRIORITY[$a['recurrence']['type'] ?? ''] ?? 0;
        $pb = WS_SCHEDULE_PRIORITY[$b['recurrence']['type'] ?? ''] ?? 0;
        if ($pa !== $pb) {
            return $pb - $pa;
        }
        return strcmp((string)($b['createdAt'] ?? ''), (string)($a['createdAt'] ?? ''));
    });
    return $active[0];
}
