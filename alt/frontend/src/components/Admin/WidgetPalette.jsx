import './WidgetPalette.css';

const WIDGET_TYPES = [
  { type: 'text', label: 'Text', icon: 'T' },
  { type: 'clock', label: 'Uhrzeit', icon: '🕐' },
  { type: 'date', label: 'Datum', icon: '📅' },
  { type: 'image', label: 'Bild', icon: '🖼' }
];

function WidgetPalette({ onAdd }) {
  return (
    <div className="widget-palette">
      <h3 className="widget-palette-title">Widgets</h3>
      <p className="widget-palette-hint">Klicken zum Hinzufügen</p>
      <div className="widget-palette-list">
        {WIDGET_TYPES.map(({ type, label, icon }) => (
          <button
            key={type}
            type="button"
            className="widget-palette-item"
            onClick={() => onAdd(type)}
          >
            <span className="widget-palette-icon">{icon}</span>
            <span className="widget-palette-label">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default WidgetPalette;
export { WIDGET_TYPES };
