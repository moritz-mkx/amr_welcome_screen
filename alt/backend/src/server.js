const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const apiRoutes = require('./routes/api');
const uploadRoutes = require('./routes/upload');
const fileService = require('./services/fileService');
const configService = require('./services/configService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', apiRoutes);
app.use('/api', uploadRoutes);

// Serve static files from frontend build (wenn gebaut)
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.get('*', (req, res) => {
    res.status(503).send(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Welcome Screen</title></head><body>' +
      '<h1>Frontend nicht gebaut</h1><p>Bitte auf dem Gerät ausführen:</p>' +
      '<pre>cd frontend && npm run build && cd ..</pre>' +
      '<p>Anschließend Server neu starten (z. B. <code>pm2 restart welcome-screen</code>).</p></body></html>'
    );
  });
}

// Stelle sicher, dass Upload- und Logo-Verzeichnisse existieren
[fileService.UPLOADS_DIR, fileService.CONVERTED_DIR, configService.LOGO_DIR, configService.WIDGET_IMAGES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server läuft auf http://0.0.0.0:${PORT}`);
  console.log(`Display-Modus: http://0.0.0.0:${PORT}/display`);
  console.log(`Admin-Modus: http://0.0.0.0:${PORT}/admin`);
});

module.exports = app;
