import { useState } from 'react';
import { fileAPI } from '../../services/api';
import './FileList.css';

function FileList({ files, onDelete, onOrderChange }) {
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (fileId) => {
    if (!confirm('Möchten Sie diese Datei wirklich löschen?')) {
      return;
    }

    setDeletingId(fileId);
    try {
      await fileAPI.deleteFile(fileId);
      if (onDelete) {
        onDelete();
      }
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler beim Löschen der Datei');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDragStart = (e, index) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/html'), 10);
    
    if (dragIndex !== dropIndex) {
      const newOrder = [...files];
      const [removed] = newOrder.splice(dragIndex, 1);
      newOrder.splice(dropIndex, 0, removed);
      
      const fileIds = newOrder.map(f => f.id);
      if (onOrderChange) {
        onOrderChange(fileIds);
      }
    }
  };

  if (files.length === 0) {
    return (
      <div className="file-list">
        <h2>Hochgeladene Dateien</h2>
        <div className="empty-list">
          <p>Noch keine Dateien hochgeladen.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="file-list">
      <h2>Hochgeladene Dateien ({files.length})</h2>
      <p className="list-hint">Ziehen Sie Dateien, um die Reihenfolge zu ändern</p>
      
      <div className="file-grid">
        {files.map((file, index) => (
          <div
            key={file.id}
            className="file-item"
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
          >
            <div className="file-preview">
              <img
                src={file.displayUrl || file.url}
                alt={file.originalName}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="file-preview-error" style={{ display: 'none' }}>
                Vorschau nicht verfügbar
              </div>
            </div>
            
            <div className="file-info">
              <div className="file-name" title={file.originalName}>
                {file.originalName}
              </div>
              <div className="file-meta">
                <span className="file-type">{file.type.toUpperCase()}</span>
                <span className="file-size">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            </div>
            
            <button
              className="delete-button"
              onClick={() => handleDelete(file.id)}
              disabled={deletingId === file.id}
              title="Datei löschen"
            >
              {deletingId === file.id ? '...' : '🗑️'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FileList;
