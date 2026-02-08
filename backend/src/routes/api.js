const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const os = require('os');
const fileService = require('../services/fileService');
const configService = require('../services/configService');
const pdfConverter = require('../services/pdfConverter');

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
    res.json({ success: true, message: 'Datei gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen der Datei:', error);
    res.status(500).json({ error: error.message || 'Fehler beim Löschen der Datei' });
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
router.get('/system/ip', (req, res) => {
  try {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
    res.json({ ips: ips.length ? ips : null });
  } catch (error) {
    console.error('Fehler beim Abrufen der IP:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der IP', ips: null });
  }
});

module.exports = router;
