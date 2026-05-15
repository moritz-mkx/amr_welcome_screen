const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const os = require('os');
const fileService = require('../services/fileService');
const configService = require('../services/configService');
const pdfConverter = require('../services/pdfConverter');
const scheduleService = require('../services/scheduleService');

/**
 * GET /api/files
 * Gibt alle verfügbaren Dateien zurück
 */
router.get('/files', (req, res) => {
  try {
    const files = fileService.getAllFiles();
    res.json(files);
  } catch (error) {
    console.error('Fehler beim Abrufen der Dateien:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Dateien' });
  }
});

/**
 * GET /api/files/:id
 * Gibt eine spezifische Datei zurück
 */
router.get('/files/:id', (req, res) => {
  try {
    const file = fileService.getFileById(req.params.id);
    
    if (!file) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }
    
    // Bestimme den Pfad zur Datei (konvertiertes Bild für PDFs, sonst Original)
    const filePath = file.convertedPath || file.path;
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }
    
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Fehler beim Abrufen der Datei:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Datei' });
  }
});

/**
 * GET /api/files/:id/display
 * Gibt die Display-Version einer Datei zurück (konvertiertes Bild für PDFs)
 */
router.get('/files/:id/display', (req, res) => {
  try {
    const file = fileService.getFileById(req.params.id);
    
    if (!file) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }
    
    // Verwende konvertiertes Bild falls vorhanden, sonst Original
    const filePath = file.convertedPath || file.path;
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }
    
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Fehler beim Abrufen der Display-Datei:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Display-Datei' });
  }
});

/**
 * DELETE /api/files/:id
 * Löscht eine Datei
 */
router.delete('/files/:id', (req, res) => {
  try {
    fileService.deleteFile(req.params.id);
    // Aufräumen: Schedules, die auf diese Datei verweisen, mitlöschen
    try {
      scheduleService.deleteSchedulesByFileId(req.params.id);
    } catch (cleanupError) {
      console.warn('Schedule-Cleanup fehlgeschlagen:', cleanupError);
    }
    res.json({ success: true, message: 'Datei gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen der Datei:', error);
    res.status(500).json({ error: error.message || 'Fehler beim Löschen der Datei' });
  }
});

/**
 * PUT /api/files/:id/toggle-hidden
 * Schaltet die Sichtbarkeit einer Datei um (ein-/ausblenden)
 */
router.put('/files/:id/toggle-hidden', (req, res) => {
  try {
    const file = fileService.getFileById(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }
    const updated = fileService.updateFileMetadata(req.params.id, { hidden: !file.hidden });
    res.json(updated);
  } catch (error) {
    console.error('Fehler beim Umschalten der Sichtbarkeit:', error);
    res.status(500).json({ error: error.message || 'Fehler beim Umschalten der Sichtbarkeit' });
  }
});

/**
 * PUT /api/files/order
 * Aktualisiert die Reihenfolge der Dateien
 */
router.put('/files/order', (req, res) => {
  try {
    const { fileIds } = req.body;
    
    if (!Array.isArray(fileIds)) {
      return res.status(400).json({ error: 'fileIds muss ein Array sein' });
    }
    
    const files = fileService.updateFileOrder(fileIds);
    res.json(files);
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Reihenfolge:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Reihenfolge' });
  }
});

/**
 * GET /api/config
 * Gibt die aktuelle Konfiguration zurück
 */
router.get('/config', (req, res) => {
  try {
    const config = configService.loadConfig();
    res.json(config);
  } catch (error) {
    console.error('Fehler beim Abrufen der Konfiguration:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Konfiguration' });
  }
});

/**
 * PUT /api/config
 * Aktualisiert die Konfiguration
 */
router.put('/config', (req, res) => {
  try {
    const updates = req.body;
    const config = configService.updateConfig(updates);
    res.json(config);
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Konfiguration:', error);
    const message = error.code === 'EACCES'
      ? 'Keine Schreibrechte für config.json. Auf dem Pi ausführen: chown pi:pi backend/config.json'
      : (error.message || 'Fehler beim Aktualisieren der Konfiguration');
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/system/ip
 * Gibt die IP-Adresse(n) des Rechners zurück (für Einrichtungs-Anzeige)
 */
/**
 * GET /api/logo
 * Liefert das hochgeladene Logo für die Uhr-Anzeige
 */
router.get('/logo', (req, res) => {
  try {
    const logoPath = configService.getLogoPath();
    if (!logoPath || !fs.existsSync(logoPath)) {
      return res.status(404).end();
    }
    res.sendFile(path.resolve(logoPath));
  } catch (error) {
    console.error('Fehler beim Abrufen des Logos:', error);
    res.status(404).end();
  }
});

/**
 * GET /api/widget-image/:id
 * Liefert ein Widget-Bild (Dateiname z. B. widget-<uuid>.png)
 */
router.get('/widget-image/:id', (req, res) => {
  try {
    const rawId = req.params.id;
    const safeId = path.basename(rawId).replace(/[^a-zA-Z0-9._-]/g, '');
    if (!safeId) {
      return res.status(400).json({ error: 'Ungültige ID' });
    }
    const filePath = path.join(configService.WIDGET_IMAGES_DIR, safeId);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return res.status(404).end();
    }
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Fehler beim Abrufen des Widget-Bildes:', error);
    res.status(404).end();
  }
});

/**
 * DELETE /api/widget-image/:id
 * Löscht ein Widget-Bild
 */
router.delete('/widget-image/:id', (req, res) => {
  try {
    const rawId = req.params.id;
    const safeId = path.basename(rawId).replace(/[^a-zA-Z0-9._-]/g, '');
    if (!safeId || !safeId.startsWith('widget-')) {
      return res.status(400).json({ error: 'Ungültige ID' });
    }
    const filePath = path.join(configService.WIDGET_IMAGES_DIR, safeId);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      fs.unlinkSync(filePath);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Fehler beim Löschen des Widget-Bildes:', error);
    res.status(500).json({ error: error.message || 'Fehler beim Löschen' });
  }
});

/**
 * GET /api/system/ip
 * Gibt die IP-Adresse(n) des Rechners zurück (für Einrichtungs-Anzeige)
 */
router.get('/system/ip', (req, res) => {
  try {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Node liefert family teils als 'IPv4' (String), teils als 4 (Zahl)
        const isIPv4 = iface.family === 'IPv4' || iface.family === 4;
        if (isIPv4 && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
    // Fallback: Wenn keine IP gefunden (z. B. nur lo), Adresse der Server-Socket nutzen
    if (ips.length === 0 && req.socket && req.socket.localAddress) {
      const addr = req.socket.localAddress;
      if (addr && addr !== '127.0.0.1' && addr !== '::' && addr !== '::1') {
        ips.push(addr);
      }
    }
    res.json({ ips: ips.length ? ips : null });
  } catch (error) {
    console.error('Fehler beim Abrufen der IP:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der IP', ips: null });
  }
});

/**
 * GET /api/schedules
 * Gibt alle Pläne zurück
 */
router.get('/schedules', (req, res) => {
  try {
    res.json(scheduleService.getAllSchedules());
  } catch (error) {
    console.error('Fehler beim Abrufen der Schedules:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Pläne' });
  }
});

/**
 * POST /api/schedules
 * Legt einen neuen Plan an
 */
router.post('/schedules', (req, res) => {
  try {
    const file = fileService.getFileById(req.body.fileId);
    if (!file) {
      return res.status(400).json({ error: 'Datei nicht gefunden' });
    }
    const schedule = scheduleService.addSchedule(req.body);
    res.status(201).json(schedule);
  } catch (error) {
    console.error('Fehler beim Erstellen des Schedules:', error);
    res.status(400).json({ error: error.message || 'Fehler beim Erstellen' });
  }
});

/**
 * PUT /api/schedules/:id
 * Aktualisiert einen Plan
 */
router.put('/schedules/:id', (req, res) => {
  try {
    if (req.body.fileId) {
      const file = fileService.getFileById(req.body.fileId);
      if (!file) {
        return res.status(400).json({ error: 'Datei nicht gefunden' });
      }
    }
    const schedule = scheduleService.updateSchedule(req.params.id, req.body);
    res.json(schedule);
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Schedules:', error);
    const status = error.message === 'Schedule nicht gefunden' ? 404 : 400;
    res.status(status).json({ error: error.message || 'Fehler beim Aktualisieren' });
  }
});

/**
 * DELETE /api/schedules/:id
 * Löscht einen Plan
 */
router.delete('/schedules/:id', (req, res) => {
  try {
    scheduleService.deleteSchedule(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Fehler beim Löschen des Schedules:', error);
    const status = error.message === 'Schedule nicht gefunden' ? 404 : 500;
    res.status(status).json({ error: error.message || 'Fehler beim Löschen' });
  }
});

/**
 * GET /api/active-schedule
 * Gibt den aktuell aktiven Plan und die zugehörige Datei zurück (falls vorhanden)
 */
router.get('/active-schedule', (req, res) => {
  try {
    const schedule = scheduleService.getActiveSchedule(new Date());
    if (!schedule) {
      return res.json({ schedule: null, file: null });
    }
    const rawFile = fileService.getFileById(schedule.fileId);
    if (!rawFile) {
      return res.json({ schedule, file: null });
    }
    const file = {
      ...rawFile,
      url: `/api/files/${rawFile.id}`,
      displayUrl: rawFile.convertedPath
        ? `/api/files/${rawFile.id}/display`
        : `/api/files/${rawFile.id}`
    };
    res.json({ schedule, file });
  } catch (error) {
    console.error('Fehler beim Abrufen des aktiven Schedules:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des aktiven Plans' });
  }
});

module.exports = router;
