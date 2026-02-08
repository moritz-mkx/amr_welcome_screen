import { useState, useEffect } from 'react';
import FileUpload from './FileUpload';
import FileList from './FileList';
import Settings from './Settings';
import { fileAPI, configAPI } from '../../services/api';
import './AdminPanel.css';

function AdminPanel() {
  const [files, setFiles] = useState([]);
  const [config, setConfig] = useState({ slideInterval: 5000, transitionDuration: 1000 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('files');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [filesData, configData] = await Promise.all([
        fileAPI.getAllFiles(),
        configAPI.getConfig()
      ]);
      
      setFiles(filesData);
      setConfig(configData);
      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
      setLoading(false);
    }
  };

  const handleFileUploaded = () => {
    loadData();
  };

  const handleFileDeleted = () => {
    loadData();
  };

  const handleFileOrderChanged = async (newOrder) => {
    try {
      await fileAPI.updateFileOrder(newOrder);
      loadData();
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Reihenfolge:', error);
      alert('Fehler beim Aktualisieren der Reihenfolge');
    }
  };

  const handleConfigUpdate = async (updates) => {
    try {
      const updatedConfig = await configAPI.updateConfig(updates);
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Konfiguration:', error);
      let msg = error.response?.data?.error || error.message || 'Fehler beim Aktualisieren der Konfiguration';
      if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
        msg = 'Verbindung zum Server fehlgeschlagen. Bitte prüfen: gleiches WLAN wie der Pi? Seite mit aktuellem Build (ggf. Cache leeren / Hard-Reload)?';
      }
      alert(msg);
    }
  };

  if (loading) {
    return (
      <div className="admin-panel loading">
        <div className="loading-spinner">Lade...</div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <header className="admin-header">
        <h1>Welcome Screen Konfiguration</h1>
        <nav className="admin-nav">
          <button
            className={activeTab === 'files' ? 'active' : ''}
            onClick={() => setActiveTab('files')}
          >
            Dateien
          </button>
          <button
            className={activeTab === 'settings' ? 'active' : ''}
            onClick={() => setActiveTab('settings')}
          >
            Einstellungen
          </button>
          <a href="/display" className="preview-link" target="_blank">
            Vorschau
          </a>
        </nav>
      </header>

      <main className="admin-content">
        {activeTab === 'files' && (
          <div className="files-tab">
            <FileUpload onUploaded={handleFileUploaded} />
            <FileList
              files={files}
              onDelete={handleFileDeleted}
              onOrderChange={handleFileOrderChanged}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-tab">
            <Settings config={config} onUpdate={handleConfigUpdate} />
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminPanel;
