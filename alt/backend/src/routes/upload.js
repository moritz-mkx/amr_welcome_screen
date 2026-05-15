const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const uploadMiddleware = require('../middleware/upload');
const upload = uploadMiddleware;
const uploadLogo = uploadMiddleware.uploadLogo;
const uploadWidgetMedia = uploadMiddleware.uploadWidgetMedia;
const fileService = require('../services/fileService');
const configService = require('../services/configService');
const pdfConverter = require('../services/pdfConverter');

/**
 * Wrapper, der Multer-Fehler (z. B. zu große Datei, ungültiger Dateityp)
 * als JSON ausliefert, statt sie an den Default-Error-Handler weiterzureichen.
 */
function multerHandler(uploader) {
  return (req, res, next) => {
    uploader(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE'
          ? 'Datei zu groß. Maximalgröße überschritten.'
          : (err.message || 'Fehler beim Hochladen');
        return res.status(400).json({ error: message });
      }
      return res.status(400).json({ error: err.message || 'Fehler beim Hochladen' });
    });
  };
}

/**
 * POST /api/upload
 * Lädt eine Datei hoch (Bild, Video oder PDF)
 */
router.post('/upload', multerHandler(upload.single('file')), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }
    
    const file = req.file;
    const isPdf = file.mimetype === 'application/pdf';
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    
    if (!isPdf && !isImage && !isVideo) {
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
        fs.unlinkSync(file.path);
        return res.status(500).json({ 
          error: 'Fehler bei PDF-Konvertierung. Stellen Sie sicher, dass poppler-utils installiert ist.' 
        });
      }
    }
    
    const fileType = isPdf ? 'pdf' : (isVideo ? 'video' : 'image');
    
    const fileInfo = {
      filename: file.filename,
      originalName: file.originalname,
      type: fileType,
      mimetype: file.mimetype,
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
router.post('/config/logo', multerHandler(uploadLogo.single('logo')), (req, res) => {
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

/**
 * POST /api/widget-media
 * Lädt ein Medium (Bild oder Video) für ein Widget hoch (static/widgets/)
 */
router.post('/widget-media', multerHandler(uploadWidgetMedia.single('media')), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }
    const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    res.json({ success: true, id: req.file.filename, mediaType });
  } catch (error) {
    console.error('Fehler beim Widget-Media-Upload:', error);
    res.status(500).json({ error: error.message || 'Fehler beim Hochladen' });
  }
});

/**
 * POST /api/widget-image (Alias für Backwards-Kompatibilität)
 * Akzeptiert auch Videos, das Feld kann 'image' oder 'media' heißen.
 */
router.post('/widget-image', multerHandler(uploadWidgetMedia.single('image')), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }
    const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    res.json({ success: true, id: req.file.filename, mediaType });
  } catch (error) {
    console.error('Fehler beim Widget-Bild-Upload:', error);
    res.status(500).json({ error: error.message || 'Fehler beim Hochladen' });
  }
});

module.exports = router;
