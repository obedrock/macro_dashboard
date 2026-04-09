import React, { createContext, useContext, useState, useEffect } from 'react';
import { DashboardSettings, WidgetConfig, WidgetId } from '../types';

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'yields', label: 'Yield Curve', visible: true, order: 0, size: 'large' },
  { id: 'rates', label: 'Interest Rates', visible: true, order: 1, size: 'medium' },
  { id: 'equities', label: 'Equities', visible: true, order: 2, size: 'medium' },
  { id: 'fx', label: 'FX Markets', visible: true, order: 3, size: 'medium' },
  { id: 'commodities', label: 'Commodities', visible: true, order: 4, size: 'medium' },
  { id: 'credit', label: 'Credit Spreads', visible: true, order: 5, size: 'medium' },
  { id: 'inflation', label: 'Inflation', visible: true, order: 6, size: 'medium' },
  { id: 'calendar', label: 'Economic Calendar', visible: true, order: 7, size: 'large' },
  { id: 'fedwatch', label: 'Fed Watch', visible: true, order: 8, size: 'medium' },
  { id: 'news', label: 'Macro News', visible: true, order: 9, size: 'large' },
];

const DEFAULT_SETTINGS: DashboardSettings = {
  widgets: DEFAULT_WIDGETS,
  defaultTimeRange: '1M',
};

interface DashboardContextType {
  settings: DashboardSettings;
  updateWidgetVisibility: (id: WidgetId, visible: boolean) => void;
  reorderWidgets: (from: number, to: number) => void;
  setDefaultTimeRange: (range: DashboardSettings['defaultTimeRange']) => void;
  resetSettings: () => void;
  visibleWidgets: WidgetConfig[];
}

const DashboardContext = createContext<DashboardContextType>({
  settings: DEFAULT_SETTINGS,
  updateWidgetVisibility: () => {},
  reorderWidgets: () => {},
  setDefaultTimeRange: () => {},
  resetSettings: () => {},
  visibleWidgets: DEFAULT_WIDGETS,
});

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<DashboardSettings>(() => {
    try {
      const saved = localStorage.getItem('macro-dashboard-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        const mergedWidgets = DEFAULT_WIDGETS.map(dw => {
          const saved = parsed.widgets?.find((w: WidgetConfig) => w.id === dw.id);
          return saved ? { ...dw, ...saved } : dw;
        });
        return { ...DEFAULT_SETTINGS, ...parsed, widgets: mergedWidgets };
      }
    } catch {}
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('macro-dashboard-settings', JSON.stringify(settings));
  }, [settings]);

  const updateWidgetVisibility = (id: WidgetId, visible: boolean) => {
    setSettings(prev => ({
      ...prev,
      widgets: prev.widgets.map(w => (w.id === id ? { ...w, visible } : w)),
    }));
  };

  const reorderWidgets = (from: number, to: number) => {
    setSettings(prev => {
      const sorted = [...prev.widgets].sort((a, b) => a.order - b.order);
      const item = sorted.splice(from, 1)[0];
      sorted.splice(to, 0, item);
      const updated = sorted.map((w, i) => ({ ...w, order: i }));
      return { ...prev, widgets: updated };
    });
  };

  const setDefaultTimeRange = (range: DashboardSettings['defaultTimeRange']) => {
    setSettings(prev => ({ ...prev, defaultTimeRange: range }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const visibleWidgets = [...settings.widgets]
    .sort((a, b) => a.order - b.order)
    .filter(w => w.visible);

  return (
    <DashboardContext.Provider
      value={{
        settings,
        updateWidgetVisibility,
        reorderWidgets,
        setDefaultTimeRange,
        resetSettings,
        visibleWidgets,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export const useDashboard = () => useContext(DashboardContext);
