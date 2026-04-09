import React from 'react';
import { Settings, Sun, Moon, Activity } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  onOpenSettings: () => void;
}

export default function Header({ onOpenSettings }: Props) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="bg-slate-950 border-b border-slate-800">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-sky-500/10 rounded-lg">
            <Activity size={18} className="text-sky-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 tracking-tight">MacroPulse</h1>
            <p className="text-xs text-slate-600 hidden sm:block">Global Macro Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <div className="hidden sm:flex items-center gap-1 mr-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-500">Live</span>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
            title="Dashboard settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
