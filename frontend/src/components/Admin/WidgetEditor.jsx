import { useState, useEffect, useCallback } from 'react';
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
const ROW_HEIGHT = 40;

const DEFAULT_CONFIG_BY_TYPE = {
  clock: { fontSize: 160, color: '#f0f0f5', showSeconds: true },
  date: { fontSize: 42, color: '#a0a0b0', format: 'long' },
  text: { text: 'Text', fontSize: 32, color: '#ffffff', fontWeight: '400', textAlign: 'center' },
  image: { src: 'logo', objectFit: 'contain' }
};

function generateWidgetId() {
  return 'widget-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function WidgetEditor({ config, onSave }) {
  const [widgets, setWidgets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);

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
    const config = DEFAULT_CONFIG_BY_TYPE[type] ?? {};
    const newWidget = {
      i,
      type,
      x: 0,
      y: widgets.length * 2,
      w: type === 'image' ? 4 : 6,
      h: type === 'clock' ? 4 : type === 'text' ? 2 : 2,
      config: { ...config }
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
          <div className="widget-editor-preview" style={{ aspectRatio: '16/9' }}>
            <GridLayout
              className="widget-editor-grid"
              layout={layout}
              onLayoutChange={handleLayoutChange}
              cols={COLS}
              rowHeight={ROW_HEIGHT}
              width={800}
              margin={[4, 4]}
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
                    <GridWidgetRenderer widget={widget} />
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
          <a href="/display" className="widget-editor-preview-link" target="_blank" rel="noreferrer">
            Vorschau öffnen
          </a>
        </div>
      </div>
    </div>
  );
}

export default WidgetEditor;
