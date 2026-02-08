const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../../config.json');

// Standard-Konfiguration
const DEFAULT_CONFIG = {
  slideInterval: 5000,
  transitionDuration: 1000,
  transitionType: 'fade',
  // 'setup' = Anleitung mit IP anzeigen wenn keine Bilder; 'clock' = Uhr + Datum anzeigen
  emptyScreenMode: 'setup'
};

/**
 * Lädt die Konfiguration aus der JSON-Datei
 */
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
    // Wenn keine Config existiert, erstelle eine mit Standard-Werten
    saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  } catch (error) {
    console.error('Fehler beim Laden der Konfiguration:', error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Speichert die Konfiguration in die JSON-Datei
 */
function saveConfig(config) {
  try {
    // Stelle sicher, dass alle Standard-Werte vorhanden sind
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(mergedConfig, null, 2), 'utf8');
    return mergedConfig;
  } catch (error) {
    console.error('Fehler beim Speichern der Konfiguration:', error);
    throw error;
  }
}

/**
 * Aktualisiert die Konfiguration
 */
function updateConfig(updates) {
  const currentConfig = loadConfig();
  const updatedConfig = { ...currentConfig, ...updates };
  return saveConfig(updatedConfig);
}

module.exports = {
  loadConfig,
  saveConfig,
  updateConfig,
  DEFAULT_CONFIG
};
