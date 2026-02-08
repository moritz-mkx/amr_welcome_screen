import './SlideItem.css';

function SlideItem({ file, isActive, transitionDuration }) {
  const displayUrl = file.displayUrl || file.url;

  return (
    <div
      className={`slide-item ${isActive ? 'active' : ''}`}
      style={{
        transition: `opacity ${transitionDuration}ms ease-in-out`
      }}
    >
      <img
        src={displayUrl}
        alt={file.originalName}
        className="slide-image"
        onError={(e) => {
          console.error('Fehler beim Laden des Bildes:', file.originalName);
          e.target.style.display = 'none';
        }}
      />
    </div>
  );
}

export default SlideItem;
