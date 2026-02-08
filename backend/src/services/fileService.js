const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const CONVERTED_DIR = path.join(__dirname, '../../converted');
const METADATA_FILE = path.join(__dirname, '../../files-metadata.json');

// Stelle sicher, dass die Verzeichnisse existieren
[UPLOADS_DIR, CONVERTED_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Lädt die Metadaten aller Dateien
 */
function loadMetadata() {
  try {
    if (fs.existsSync(METADATA_FILE)) {
      const data = fs.readFileSync(METADATA_FILE, 'utf8');
      return JSON.parse(data);
    }
    return { files: [] };
  } catch (error) {
    console.error('Fehler beim Laden der Metadaten:', error);
    return { files: [] };
  }
}

/**
 * Speichert die Metadaten
 */
function saveMetadata(metadata) {
  try {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf8');
  } catch (error) {
    console.error('Fehler beim Speichern der Metadaten:', error);
    throw error;
  }
}

/**
 * Fügt eine neue Datei zu den Metadaten hinzu
 */
function addFileMetadata(fileInfo) {
  const metadata = loadMetadata();
  const newFile = {
    id: Date.now().toString(),
    filename: fileInfo.filename,
    originalName: fileInfo.originalName,
    type: fileInfo.type, // 'image' oder 'pdf'
    path: fileInfo.path,
    convertedPath: fileInfo.convertedPath || null,
    uploadedAt: new Date().toISOString(),
    size: fileInfo.size
  };
  metadata.files.push(newFile);
  saveMetadata(metadata);
  return newFile;
}

/**
 * Gibt alle Dateien zurück
 */
function getAllFiles() {
  const metadata = loadMetadata();
  return metadata.files.map(file => ({
    ...file,
    url: `/api/files/${file.id}`,
    displayUrl: file.convertedPath 
      ? `/api/files/${file.id}/display` 
      : `/api/files/${file.id}`
  }));
}

/**
 * Findet eine Datei anhand der ID
 */
function getFileById(id) {
  const metadata = loadMetadata();
  return metadata.files.find(file => file.id === id);
}

/**
 * Löscht eine Datei und ihre Metadaten
 */
function deleteFile(id) {
  const metadata = loadMetadata();
  const fileIndex = metadata.files.findIndex(file => file.id === id);
  
  if (fileIndex === -1) {
    throw new Error('Datei nicht gefunden');
  }
  
  const file = metadata.files[fileIndex];
  
  // Lösche die Originaldatei
  if (file.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
  
  // Lösche die konvertierte Datei (falls vorhanden)
  if (file.convertedPath && fs.existsSync(file.convertedPath)) {
    fs.unlinkSync(file.convertedPath);
  }
  
  // Entferne aus Metadaten
  metadata.files.splice(fileIndex, 1);
  saveMetadata(metadata);
  
  return true;
}

/**
 * Aktualisiert die Reihenfolge der Dateien
 */
function updateFileOrder(fileIds) {
  const metadata = loadMetadata();
  const fileMap = new Map(metadata.files.map(f => [f.id, f]));
  
  // Erstelle neue Reihenfolge basierend auf fileIds
  const orderedFiles = fileIds
    .map(id => fileMap.get(id))
    .filter(Boolean);
  
  // Füge alle Dateien hinzu, die nicht in der neuen Reihenfolge sind
  const existingIds = new Set(fileIds);
  metadata.files.forEach(file => {
    if (!existingIds.has(file.id)) {
      orderedFiles.push(file);
    }
  });
  
  metadata.files = orderedFiles;
  saveMetadata(metadata);
  
  return metadata.files;
}

/**
 * Aktualisiert die Metadaten einer Datei
 */
function updateFileMetadata(id, updates) {
  const metadata = loadMetadata();
  const fileIndex = metadata.files.findIndex(file => file.id === id);
  
  if (fileIndex === -1) {
    throw new Error('Datei nicht gefunden');
  }
  
  metadata.files[fileIndex] = { ...metadata.files[fileIndex], ...updates };
  saveMetadata(metadata);
  
  return metadata.files[fileIndex];
}

module.exports = {
  UPLOADS_DIR,
  CONVERTED_DIR,
  addFileMetadata,
  getAllFiles,
  getFileById,
  deleteFile,
  updateFileOrder,
  updateFileMetadata
};
