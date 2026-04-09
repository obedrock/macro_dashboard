import React from 'react';
import { X, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';
import { useTheme } from '../../context/ThemeContext';
import { WidgetId } from '../../types';

interface Props {
  onClose: () => void;
}

const TIME_RANGES = ['1D', '1W', '1M', '3M', '1Y', '5Y'] as const;

export default function SettingsPanel({ onClose }: Props) {
  const { settings, updateWidgetVisibility, setDefaultTimeRange, resetSettings } = useDashboard();
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-80 h-full bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-slate-100">Dashboard Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Appearance
            </h3>
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
              <span className="text-sm text-slate-300">Theme</span>
              <button
                onClick={toggleTheme}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  isDark ? 'bg-sky-600' : 'bg-slate-600'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    isDark ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-1 px-1">
              {isDark ? 'Dark mode active' : 'Light mode active'}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Default Time Range
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {TIME_RANGES.map(range => (
                <button
                  key={range}
                  onClick={() => setDefaultTimeRange(range)}
                  className={`py-2 text-sm font-mono rounded-lg transition-all ${
                    settings.defaultTimeRange === range
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Widgets
            </h3>
            <div className="space-y-2">
              {settings.widgets.map(widget => (
                <div
                  key={widget.id}
                  className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                >
                  <span className="text-sm text-slate-300">{widget.label}</span>
                  <button
                    onClick={() => updateWidgetVisibility(widget.id as WidgetId, !widget.visible)}
                    className={`transition-colors ${
                      widget.visible ? 'text-sky-400' : 'text-slate-600'
                    } hover:text-sky-300`}
                  >
                    {widget.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-800">
          <button
            onClick={resetSettings}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-all"
          >
            <RotateCcw size={13} />
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}
