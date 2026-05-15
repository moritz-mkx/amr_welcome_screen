import { useState, useEffect } from 'react';
import { configAPI, fileAPI, scheduleAPI } from '../../services/api';
import SlideItem from './SlideItem';
import SetupGuide from './SetupGuide';
import ClockScreen from './ClockScreen';
import './Slideshow.css';

function Slideshow() {
  const [files, setFiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [config, setConfig] = useState({ slideInterval: 5000, transitionDuration: 1000, emptyScreenMode: 'setup', timeFontSize: 160, dateFontSize: 42, logoMaxWidth: 320, logoMaxHeight: 120 });
  const [loading, setLoading] = useState(true);
  const [activeSchedule, setActiveSchedule] = useState(null);

  useEffect(() => {
    loadData();

    // Lade Daten regelmäßig neu, um Updates zu erhalten
    const interval = setInterval(loadData, 30000); // Alle 30 Sekunden

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadActiveSchedule();
    const interval = setInterval(loadActiveSchedule, 15000); // Alle 15 Sekunden
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [filesData, configData] = await Promise.all([
        fileAPI.getAllFiles(),
        configAPI.getConfig()
      ]);

      setFiles(filesData.filter(f => !f.hidden));
      setConfig(configData);
      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
      setLoading(false);
    }
  };

  const loadActiveSchedule = async () => {
    try {
      const data = await scheduleAPI.getActive();
      if (data && data.schedule && data.file) {
        setActiveSchedule(data);
      } else {
        setActiveSchedule(null);
      }
    } catch (error) {
      console.error('Fehler beim Abrufen des aktiven Plans:', error);
      setActiveSchedule(null);
    }
  };

  useEffect(() => {
    if (activeSchedule) return; // Takeover aktiv, kein Slideshow-Timer
    if (files.length === 0) return;

    const current = files[currentIndex];
    // Bei Videos wird der Wechsel durch onEnded ausgelöst, kein Timer.
    if (current?.type === 'video') return;

    const timeout = setTimeout(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % files.length);
    }, config.slideInterval || 5000);

    return () => clearTimeout(timeout);
  }, [currentIndex, files, config.slideInterval, activeSchedule]);

  const handleVideoEnded = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % files.length);
  };

  if (loading) {
    return (
      <div className="slideshow-container loading">
        <div className="loading-spinner">Lade...</div>
      </div>
    );
  }

  if (activeSchedule && activeSchedule.file) {
    return (
      <div className="slideshow-container">
        <SlideItem
          key={`schedule-${activeSchedule.schedule.id}`}
          file={activeSchedule.file}
          isActive
          transitionDuration={config.transitionDuration || 1000}
          loop
        />
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
          onEnded={index === currentIndex ? handleVideoEnded : undefined}
        />
      ))}
    </div>
  );
}

export default Slideshow;
