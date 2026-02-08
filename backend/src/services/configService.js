const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../../config.json');
const LOGO_DIR = path.join(__dirname, '../../static');
const WIDGET_IMAGES_DIR = path.join(__dirname, '../../static/widgets');

// Standard-Konfiguration (timeFontSize/dateFontSize/logo* für Abwärtskompatibilität)
const DEFAULT_CONFIG = {
  slideInterval: 5000,
  transitionDuration: 1000,
  transitionType: 'fade',
  emptyScreenMode: 'setup',
  timeFontSize: 160,
  dateFontSize: 42,
  logoMaxWidth: 320,
  logoMaxHeight: 120,
  clockWidgets: [
    { i: 'widget-logo', type: 'image', x: 4, y: 0, w: 4, h: 2, config: { src: 'logo', objectFit: 'contain' } },
    { i: 'widget-clock', type: 'clock', x: 3, y: 3, w: 6, h: 4, config: { fontSize: 160, color: '#f0f0f5', showSeconds: true } },
    { i: 'widget-date', type: 'date', x: 3, y: 7, w: 6, h: 2, config: { fontSize: 42, color: '#a0a0b0', format: 'long' } }
  ]
};

/**
 * Lädt die Konfiguration aus der JSON-Datei
 */
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      const parsed = JSON.parse(data);
      return { ...DEFAULT_CONFIG, ...parsed };
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
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
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

/**
 * Gibt den Pfad zur Logo-Datei zurück, falls vorhanden
 */
function getLogoPath() {
  try {
    if (!fs.existsSync(LOGO_DIR)) return null;
    const files = fs.readdirSync(LOGO_DIR);
    const logo = files.find(f => f.startsWith('logo.'));
    return logo ? path.join(LOGO_DIR, logo) : null;
  } catch {
    return null;
  }
}

module.exports = {
  loadConfig,
  saveConfig,
  updateConfig,
  DEFAULT_CONFIG,
  LOGO_DIR,
  WIDGET_IMAGES_DIR,
  getLogoPath
};
