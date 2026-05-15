import { useEffect, useRef } from 'react';
import './SlideItem.css';

function SlideItem({ file, isActive, transitionDuration, onEnded, loop = false }) {
  const videoRef = useRef(null);
  const isVideo = file.type === 'video';
  const displayUrl = file.displayUrl || file.url;

  useEffect(() => {
    if (!isVideo) return;
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = () => {
      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch((err) => {
          console.warn('Video-Autoplay blockiert / verzögert:', err);
        });
      }
    };

    const onCanPlay = () => {
      if (video.paused) tryPlay();
    };

    if (isActive) {
      // Wenn das Video noch nicht abgespielt wurde, ist readyState < 2,
      // dann setzen wir currentTime nicht (würde InvalidStateError werfen)
      if (video.readyState >= 1) {
        try { video.currentTime = 0; } catch {}
      }
      tryPlay();
      video.addEventListener('canplay', onCanPlay);
      return () => video.removeEventListener('canplay', onCanPlay);
    } else {
      video.pause();
    }
  }, [isActive, isVideo, file.url]);

  return (
    <div
      className={`slide-item ${isActive ? 'active' : ''}`}
      style={{
        transition: `opacity ${transitionDuration}ms ease-in-out`
      }}
    >
      {isVideo ? (
        <video
          ref={videoRef}
          src={file.url}
          muted
          autoPlay
          playsInline
          preload="auto"
          disablePictureInPicture
          loop={loop}
          className="slide-video"
          onEnded={loop ? undefined : onEnded}
          onError={() => {
            console.error('Fehler beim Laden des Videos:', file.originalName);
          }}
        />
      ) : (
        <img
          src={displayUrl}
          alt={file.originalName}
          className="slide-image"
          onError={(e) => {
            console.error('Fehler beim Laden des Bildes:', file.originalName);
            e.target.style.display = 'none';
          }}
        />
      )}
    </div>
  );
}

export default SlideItem;
