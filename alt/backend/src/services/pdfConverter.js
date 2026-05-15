const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const fileService = require('./fileService');

const execFileAsync = promisify(execFile);

/**
 * Konvertiert die erste Seite eines PDFs zu einem Bild mit pdftoppm (poppler-utils).
 * Funktioniert auf Linux (Raspberry Pi); das npm-Paket pdf-poppler unterstützt Linux nicht.
 * @param {string} pdfPath - Pfad zur PDF-Datei
 * @param {string} outputPath - Pfad für das Ausgabebild
 * @returns {Promise<string>} - Pfad zum konvertierten Bild
 */
async function convertPdfFirstPage(pdfPath, outputPath) {
  const outDir = path.dirname(outputPath);
  const prefix = path.basename(outputPath, path.extname(outputPath));

  try {
    await execFileAsync('pdftoppm', [
      '-png',
      '-f', '1',
      '-l', '1',
      pdfPath,
      path.join(outDir, prefix)
    ], { maxBuffer: 10 * 1024 * 1024 });

    // pdftoppm erzeugt <prefix>-1.png
    const generatedPath = path.join(outDir, `${prefix}-1.png`);

    if (!fs.existsSync(generatedPath)) {
      throw new Error('Konvertierte Datei nicht gefunden');
    }

    if (generatedPath !== outputPath) {
      fs.renameSync(generatedPath, outputPath);
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
