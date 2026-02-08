const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { upload, uploadLogo } = require('../middleware/upload');
const fileService = require('../services/fileService');
const configService = require('../services/configService');
const pdfConverter = require('../services/pdfConverter');

/**
 * POST /api/upload
 * Lädt eine Datei hoch (Bild oder PDF)
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }
    
    const file = req.file;
    const isPdf = file.mimetype === 'application/pdf';
    const isImage = file.mimetype.startsWith('image/');
    
    if (!isPdf && !isImage) {
      // Lösche die hochgeladene Datei
      const fs = require('fs');
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'Ungültiger Dateityp' });
    }
    
    let convertedPath = null;
    
    // Wenn PDF, konvertiere erste Seite zu Bild
    if (isPdf) {
      try {
        convertedPath = await pdfConverter.convertPdfToImage(file.path, file.originalname);
      } catch (error) {
        console.error('Fehler bei PDF-Konvertierung:', error);
        // Lösche die hochgeladene Datei
        const fs = require('fs');
        fs.unlinkSync(file.path);
        return res.status(500).json({ 
          error: 'Fehler bei PDF-Konvertierung. Stellen Sie sicher, dass poppler-utils installiert ist.' 
        });
      }
    }
    
    // Speichere Metadaten
    const fileInfo = {
      filename: file.filename,
      originalName: file.originalname,
      type: isPdf ? 'pdf' : 'image',
      path: file.path,
      convertedPath: convertedPath,
      size: file.size
    };
    
    const savedFile = fileService.addFileMetadata(fileInfo);
    
    res.json({
      success: true,
      file: {
        ...savedFile,
        url: `/api/files/${savedFile.id}`,
        displayUrl: savedFile.convertedPath 
          ? `/api/files/${savedFile.id}/display` 
          : `/api/files/${savedFile.id}`
      }
    });
  } catch (error) {
    console.error('Fehler beim Hochladen:', error);
    res.status(500).json({ error: error.message || 'Fehler beim Hochladen der Datei' });
  }
});

/**
 * POST /api/config/logo
 * Lädt das Logo für die Uhr-Anzeige hoch (ein Bild, ersetzt das bisherige)
 */
router.post('/config/logo', uploadLogo.single('logo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }
    const dir = configService.LOGO_DIR;
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      const currentName = path.basename(req.file.path);
      files.forEach(f => {
        if (f.startsWith('logo.') && f !== currentName) {
          try { fs.unlinkSync(path.join(dir, f)); } catch {}
        }
      });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Fehler beim Logo-Upload:', error);
    res.status(500).json({ error: error.message || 'Fehler beim Logo-Upload' });
  }
});

module.exports = router;
