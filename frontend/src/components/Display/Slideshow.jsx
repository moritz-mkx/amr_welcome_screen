import { useState, useEffect } from 'react';
import { configAPI, fileAPI } from '../../services/api';
import SlideItem from './SlideItem';
import SetupGuide from './SetupGuide';
import ClockScreen from './ClockScreen';
import './Slideshow.css';

function Slideshow() {
  const [files, setFiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [config, setConfig] = useState({ slideInterval: 5000, transitionDuration: 1000, emptyScreenMode: 'setup', timeFontSize: 160, dateFontSize: 42 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    
    // Lade Daten regelmäßig neu, um Updates zu erhalten
    const interval = setInterval(loadData, 30000); // Alle 30 Sekunden
    
    return () => clearInterval(interval);
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

  useEffect(() => {
    if (files.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % files.length);
    }, config.slideInterval || 5000);

    return () => clearInterval(interval);
  }, [files.length, config.slideInterval]);

  if (loading) {
    return (
      <div className="slideshow-container loading">
        <div className="loading-spinner">Lade...</div>
      </div>
    );
  }

  if (files.length === 0) {
    const emptyMode = config.emptyScreenMode || 'setup';
    if (emptyMode === 'clock') {
      return <ClockScreen config={config} />;
    }
    return <SetupGuide />;
  }

  return (
    <div className="slideshow-container">
      {files.map((file, index) => (
        <SlideItem
          key={file.id}
          file={file}
          isActive={index === currentIndex}
          transitionDuration={config.transitionDuration || 1000}
        />
      ))}
    </div>
  );
}

export default Slideshow;
