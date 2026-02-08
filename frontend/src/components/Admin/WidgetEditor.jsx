import { useState, useEffect, useCallback, useRef } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { configAPI } from '../../services/api';
import WidgetPalette from './WidgetPalette';
import WidgetConfigPanel from './WidgetConfigPanel';
import GridWidgetRenderer from './GridWidgetRenderer';
import './WidgetEditor.css';

const COLS = 12;
const ROWS = 12;
const MARGIN = [4, 4];

const DEFAULT_CONFIG_BY_TYPE = {
  clock: { fontSize: 160, color: '#f0f0f5', showSeconds: true },
  date: { fontSize: 42, color: '#a0a0b0', format: 'long' },
  text: { text: 'Text', fontSize: 32, color: '#ffffff', fontWeight: '400', textAlign: 'center' },
  image: { src: 'logo', objectFit: 'contain' }
};

const DEFAULT_SIZE_BY_TYPE = {
  clock: { w: 6, h: 2 },
  date: { w: 6, h: 1 },
  text: { w: 6, h: 1 },
  image: { w: 4, h: 2 }
};

function generateWidgetId() {
  return 'widget-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function WidgetEditor({ config, onSave }) {
  const [widgets, setWidgets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 450 });
  const previewRef = useRef(null);

  // Container messen und bei Resize aktualisieren
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // rowHeight dynamisch berechnen damit ROWS Zeilen exakt in den Container passen
  const rowHeight = Math.max(10, (containerSize.height - (ROWS - 1) * MARGIN[1]) / ROWS);

  const clockWidgets = config.clockWidgets ?? [];

  useEffect(() => {
    if (Array.isArray(clockWidgets) && clockWidgets.length > 0) {
      setWidgets(clockWidgets.map(w => ({ ...w })));
    } else {
      setWidgets([]);
    }
    setSelectedId(null);
  }, [config.clockWidgets]);

  const layout = widgets.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));

  const handleLayoutChange = useCallback((newLayout) => {
    setWidgets(prev => prev.map(w => {
      const item = newLayout.find(l => l.i === w.i);
      if (!item) return w;
      return { ...w, x: item.x, y: item.y, w: item.w, h: item.h };
    }));
  }, []);

  const handleAddWidget = useCallback((type) => {
    const i = generateWidgetId();
    const widgetConfig = DEFAULT_CONFIG_BY_TYPE[type] ?? {};
    const size = DEFAULT_SIZE_BY_TYPE[type] ?? { w: 6, h: 1 };
    const newWidget = {
      i,
      type,
      x: 0,
      y: widgets.length * 2,
      w: size.w,
      h: size.h,
      config: { ...widgetConfig }
    };
    setWidgets(prev => [...prev, newWidget]);
    setSelectedId(i);
  }, [widgets.length]);

  const handleConfigChange = useCallback((widgetId, newConfig) => {
    setWidgets(prev => prev.map(w => w.i === widgetId ? { ...w, config: newConfig } : w));
  }, []);

  const handleDeleteWidget = useCallback((widgetId) => {
    setWidgets(prev => prev.filter(w => w.i !== widgetId));
    if (selectedId === widgetId) setSelectedId(null);
  }, [selectedId]);

  const handleClearAll = useCallback(() => {
    if (widgets.length === 0) return;
    if (!window.confirm('Alle Widgets entfernen?')) return;
    setWidgets([]);
    setSelectedId(null);
  }, [widgets.length]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await configAPI.updateConfig({ clockWidgets: widgets });
      onSave?.();
      alert('Uhr-Screen gespeichert!');
    } catch (err) {
      alert(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const selectedWidget = widgets.find(w => w.i === selectedId);

  return (
    <div className="widget-editor">
      <aside className="widget-editor-sidebar">
        <WidgetPalette onAdd={handleAddWidget} />
        <WidgetConfigPanel
          widget={selectedWidget}
          onConfigChange={(newConfig) => selectedId && handleConfigChange(selectedId, newConfig)}
          onDelete={selectedId ? () => handleDeleteWidget(selectedId) : undefined}
        />
      </aside>

      <div className="widget-editor-main">
        <div className="widget-editor-preview-wrap">
          <div
            className="widget-editor-preview"
            ref={previewRef}
            style={{ aspectRatio: '16/9' }}
          >
            <GridLayout
              className="widget-editor-grid"
              layout={layout}
              onLayoutChange={handleLayoutChange}
              cols={COLS}
              rowHeight={rowHeight}
              width={containerSize.width}
              margin={MARGIN}
              containerPadding={[0, 0]}
              isDraggable
              isResizable
              compactType={null}
              preventCollision={false}
            >
              {widgets.map((widget) => (
                <div
                  key={widget.i}
                  className={`widget-editor-cell ${selectedId === widget.i ? 'selected' : ''}`}
                  onClick={() => setSelectedId(widget.i)}
                >
                  <div className="widget-editor-cell-inner">
                    <GridWidgetRenderer widget={widget} preview />
                  </div>
                </div>
              ))}
            </GridLayout>
          </div>
        </div>
        <div className="widget-editor-actions">
          <button
            type="button"
            className="widget-editor-save"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Speichere…' : 'Uhr-Screen speichern'}
          </button>
          {widgets.length > 0 && (
            <button
              type="button"
              className="widget-editor-clear"
              onClick={handleClearAll}
            >
              Alle Widgets entfernen
            </button>
          )}
          <a href="/display" className="widget-editor-preview-link" target="_blank" rel="noreferrer">
            Vorschau öffnen
          </a>
        </div>
      </div>
    </div>
  );
}

export default WidgetEditor;
