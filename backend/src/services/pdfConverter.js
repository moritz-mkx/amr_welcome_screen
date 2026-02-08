const pdf = require('pdf-poppler');
const path = require('path');
const fs = require('fs');
const fileService = require('./fileService');

/**
 * Konvertiert die erste Seite eines PDFs zu einem Bild
 * @param {string} pdfPath - Pfad zur PDF-Datei
 * @param {string} outputPath - Pfad für das Ausgabebild
 * @returns {Promise<string>} - Pfad zum konvertierten Bild
 */
async function convertPdfFirstPage(pdfPath, outputPath) {
  try {
    const options = {
      format: 'png',
      out_dir: path.dirname(outputPath),
      out_prefix: path.basename(outputPath, path.extname(outputPath)),
      page: 1 // Nur erste Seite
    };

    await pdf.convert(pdfPath, options);
    
    // pdf-poppler erstellt Dateien mit Suffix, finde die erstellte Datei
    const dir = path.dirname(outputPath);
    const prefix = path.basename(outputPath, path.extname(outputPath));
    const files = fs.readdirSync(dir);
    const convertedFile = files.find(f => f.startsWith(prefix) && f.endsWith('.png'));
    
    if (!convertedFile) {
      throw new Error('Konvertierte Datei nicht gefunden');
    }
    
    const fullPath = path.join(dir, convertedFile);
    
    // Wenn der Ausgabepfad anders ist, benenne die Datei um
    if (fullPath !== outputPath) {
      fs.renameSync(fullPath, outputPath);
    }
    
    return outputPath;
  } catch (error) {
    console.error('Fehler bei PDF-Konvertierung:', error);
    throw error;
  }
}

/**
 * Konvertiert ein PDF und speichert es im converted-Verzeichnis
 * @param {string} pdfPath - Pfad zur PDF-Datei
 * @param {string} originalFilename - Original-Dateiname
 * @returns {Promise<string>} - Pfad zum konvertierten Bild
 */
async function convertPdfToImage(pdfPath, originalFilename) {
  const filename = path.basename(originalFilename, path.extname(originalFilename));
  const outputPath = path.join(fileService.CONVERTED_DIR, `${filename}_page1.png`);
  
  return await convertPdfFirstPage(pdfPath, outputPath);
}

module.exports = {
  convertPdfToImage,
  convertPdfFirstPage
};
