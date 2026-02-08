const multer = require('multer');
const path = require('path');
const fileService = require('../services/fileService');

// Erlaubte Dateitypen
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_PDF_TYPES = ['application/pdf'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_PDF_TYPES];

// Maximale Dateigröße: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Konfiguration für Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, fileService.UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Sanitize Dateiname
    const sanitizedName = file.originalname
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/\s+/g, '_');
    const timestamp = Date.now();
    const ext = path.extname(sanitizedName);
    const name = path.basename(sanitizedName, ext);
    cb(null, `${name}_${timestamp}${ext}`);
  }
});

// Dateityp-Validierung
const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Ungültiger Dateityp. Erlaubt sind: Bilder (JPG, PNG, GIF, WEBP) und PDFs.`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

module.exports = upload;
