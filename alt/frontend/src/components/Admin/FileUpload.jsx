import { useState, useRef } from 'react';
import { fileAPI } from '../../services/api';
import './FileUpload.css';

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function FileUpload({ onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [queue, setQueue] = useState([]); // [{ name, size, percent, status }]
  const [currentIndex, setCurrentIndex] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (files) => {
    const fileArray = Array.from(files);
    setError(null);
    setUploading(true);
    setQueue(fileArray.map(f => ({
      name: f.name,
      size: f.size,
      percent: 0,
      status: 'pending'
    })));
    setCurrentIndex(0);

    try {
      for (let i = 0; i < fileArray.length; i++) {
        setCurrentIndex(i);
        setQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'uploading' } : item));

        try {
          await fileAPI.uploadFile(fileArray[i], ({ percent }) => {
            setQueue(prev => prev.map((item, idx) => idx === i ? { ...item, percent } : item));
          });
          setQueue(prev => prev.map((item, idx) => idx === i ? { ...item, percent: 100, status: 'done' } : item));
        } catch (err) {
          setQueue(prev => prev.map((item, idx) => idx === i
            ? { ...item, status: 'error', errorMessage: err.response?.data?.error || 'Fehler' }
            : item
          ));
          throw err;
        }
      }

      if (onUploaded) {
        onUploaded();
      }

      // Erfolgsanzeige kurz stehen lassen, dann ausblenden
      setTimeout(() => {
        setQueue([]);
        setCurrentIndex(0);
      }, 1500);
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

  const totalCount = queue.length;
  const currentItem = queue[currentIndex];

  return (
    <div className="file-upload">
      <h2>Dateien hochladen</h2>
      <p className="upload-info">
        Unterstützte Formate: Bilder (JPG, PNG, GIF, WEBP), Videos (MP4, WebM) und PDFs
      </p>

      <div
        className={`upload-area ${dragActive ? 'drag-active' : ''} ${uploading ? 'uploading' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/mp4,video/webm,video/ogg,.pdf"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
        
        {uploading ? (
          <div className="upload-status">
            <p className="upload-status-headline">
              {totalCount > 1
                ? `Datei ${currentIndex + 1} von ${totalCount} wird hochgeladen…`
                : 'Wird hochgeladen…'}
            </p>
            {currentItem && (
              <p className="upload-status-current" title={currentItem.name}>
                {currentItem.name} ({formatBytes(currentItem.size)})
              </p>
            )}
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

      {queue.length > 0 && (
        <ul className="upload-progress-list">
          {queue.map((item, idx) => (
            <li key={idx} className={`upload-progress-item is-${item.status}`}>
              <div className="upload-progress-meta">
                <span className="upload-progress-name" title={item.name}>{item.name}</span>
                <span className="upload-progress-percent">
                  {item.status === 'done' && '✓ Fertig'}
                  {item.status === 'error' && (item.errorMessage || 'Fehler')}
                  {item.status === 'uploading' && `${item.percent}%`}
                  {item.status === 'pending' && 'Warten…'}
                </span>
              </div>
              <div className="upload-progress-bar">
                <div
                  className="upload-progress-bar-fill"
                  style={{ width: `${item.status === 'done' ? 100 : item.percent}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="upload-error">
          <strong>Fehler:</strong> {error}
        </div>
      )}
    </div>
  );
}

export default FileUpload;
