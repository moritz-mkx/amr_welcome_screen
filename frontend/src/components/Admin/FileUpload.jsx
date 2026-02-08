import { useState, useRef } from 'react';
import { fileAPI } from '../../services/api';
import './FileUpload.css';

function FileUpload({ onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (files) => {
    const fileArray = Array.from(files);
    setError(null);
    setUploading(true);

    try {
      for (const file of fileArray) {
        await fileAPI.uploadFile(file);
      }
      
      if (onUploaded) {
        onUploaded();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Hochladen der Datei');
      console.error('Upload-Fehler:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files);
    }
  };

  return (
    <div className="file-upload">
      <h2>Dateien hochladen</h2>
      <p className="upload-info">
        Unterstützte Formate: Bilder (JPG, PNG, GIF, WEBP) und PDFs
      </p>

      <div
        className={`upload-area ${dragActive ? 'drag-active' : ''} ${uploading ? 'uploading' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
        
        {uploading ? (
          <div className="upload-status">
            <div className="spinner"></div>
            <p>Wird hochgeladen...</p>
          </div>
        ) : (
          <div className="upload-content">
            <div className="upload-icon">📁</div>
            <p className="upload-text">
              Dateien hier ablegen oder klicken zum Auswählen
            </p>
            <p className="upload-hint">
              Mehrere Dateien gleichzeitig möglich
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="upload-error">
          <strong>Fehler:</strong> {error}
        </div>
      )}
    </div>
  );
}

export default FileUpload;
