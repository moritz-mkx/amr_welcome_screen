const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fileService = require('../services/fileService');
const configService = require('../services/configService');

// Erlaubte Dateitypen
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_PDF_TYPES = ['application/pdf'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];
const ALLOWED_MEDIA_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_PDF_TYPES, ...ALLOWED_VIDEO_TYPES];

// Maximale Dateigröße: 500MB (groß genug für Videos)
const MAX_FILE_SIZE = 500 * 1024 * 1024;
// Bilder/Logos bleiben klein
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
// Widget-Medien (Bild oder Video) bis 100MB
const MAX_WIDGET_MEDIA_SIZE = 100 * 1024 * 1024;

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
    cb(new Error(`Ungültiger Dateityp. Erlaubt sind: Bilder (JPG, PNG, GIF, WEBP), Videos (MP4, WebM, OGG) und PDFs.`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

// Logo-Upload: ein Bild, gespeichert als static/logo.<ext>
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = configService.LOGO_DIR;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.mimetype === 'image/png' ? '.png' : '.jpg');
    cb(null, 'logo' + ext);
  }
});

const uploadLogo = multer({
  storage: logoStorage,
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Nur Bilder (JPG, PNG, GIF, WEBP) erlaubt.'), false);
    }
  },
  limits: { fileSize: MAX_IMAGE_SIZE }
});

// Widget-Medien-Upload: static/widgets/<id>.<ext> (Bild oder Video)
const widgetMediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = configService.WIDGET_IMAGES_DIR;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.mimetype === 'image/png' ? '.png' : '.jpg');
    const id = 'widget-' + crypto.randomUUID();
    cb(null, id + ext);
  }
});

const uploadWidgetMedia = multer({
  storage: widgetMediaStorage,
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MEDIA_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Nur Bilder (JPG, PNG, GIF, WEBP) oder Videos (MP4, WebM, OGG) erlaubt.'), false);
    }
  },
  limits: { fileSize: MAX_WIDGET_MEDIA_SIZE }
});

module.exports = upload;
module.exports.uploadLogo = uploadLogo;
module.exports.uploadWidgetMedia = uploadWidgetMedia;
// Backwards-Kompatibilität: alter Name verweist auf neuen Media-Upload
module.exports.uploadWidgetImage = uploadWidgetMedia;
