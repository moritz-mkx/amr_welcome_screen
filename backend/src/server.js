const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');
const uploadRoutes = require('./routes/upload');
const fileService = require('./services/fileService');

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
if (require('fs').existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  
  // Alle anderen Routes zum Frontend weiterleiten (für React Router)
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Stelle sicher, dass Upload-Verzeichnisse existieren
[fileService.UPLOADS_DIR, fileService.CONVERTED_DIR].forEach(dir => {
  const fs = require('fs');
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
