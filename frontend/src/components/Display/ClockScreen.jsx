import GridWidgetRenderer from '../Admin/GridWidgetRenderer';
import './ClockScreen.css';

const FALLBACK_WIDGETS = [
  { i: 'widget-logo', type: 'image', x: 4, y: 1, w: 4, h: 2, config: { src: 'logo', objectFit: 'contain' } },
  { i: 'widget-clock', type: 'clock', x: 3, y: 4, w: 6, h: 1, config: { fontSize: 160, color: '#f0f0f5', showSeconds: true } },
  { i: 'widget-date', type: 'date', x: 3, y: 7, w: 6, h: 1, config: { fontSize: 42, color: '#a0a0b0', format: 'long' } }
];

function ClockScreen({ config = {} }) {
  const widgets = Array.isArray(config.clockWidgets) && config.clockWidgets.length > 0
    ? config.clockWidgets
    : FALLBACK_WIDGETS;

  return (
    <div className="clock-screen clock-screen-grid">
      {widgets.map((widget) => (
        <div
          key={widget.i}
          className="clock-screen-cell"
          style={{
            gridColumn: `${widget.x + 1} / span ${widget.w}`,
            gridRow: `${widget.y + 1} / span ${widget.h}`
          }}
        >
          <div className="clock-screen-cell-inner">
            <GridWidgetRenderer widget={widget} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default ClockScreen;
