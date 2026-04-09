import React from 'react';
import { TrendingUp, BarChart2, DollarSign, Droplet, Calendar, Newspaper } from 'lucide-react';

type Section = 'rates' | 'equities' | 'fx' | 'commodities' | 'calendar' | 'news';

interface NavItem {
  id: Section;
  label: string;
  icon: React.ReactNode;
  targetId: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'rates', label: 'Rates', icon: <TrendingUp size={18} />, targetId: 'widget-rates' },
  { id: 'equities', label: 'Equities', icon: <BarChart2 size={18} />, targetId: 'widget-equities' },
  { id: 'fx', label: 'FX', icon: <DollarSign size={18} />, targetId: 'widget-fx' },
  { id: 'commodities', label: 'Cmdty', icon: <Droplet size={18} />, targetId: 'widget-commodities' },
  { id: 'calendar', label: 'Calendar', icon: <Calendar size={18} />, targetId: 'widget-calendar' },
  { id: 'news', label: 'News', icon: <Newspaper size={18} />, targetId: 'widget-news' },
];

export default function BottomNav() {
  const scrollTo = (targetId: string) => {
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-sm border-t border-slate-800 md:hidden">
      <div className="flex">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => scrollTo(item.targetId)}
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-slate-500 hover:text-slate-300 transition-colors active:text-sky-400"
          >
            {item.icon}
            <span className="text-xs">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
