import React, { useState } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { DashboardProvider } from './context/DashboardContext';
import { MarketDataProvider } from './context/MarketDataContext';
import { useMarketData } from './hooks/useMarketData';
import { WidgetId, WidgetStatuses } from './types';
import { wsManager } from './services/wsManager';

import Header from './components/layout/Header';
import SummaryRibbon from './components/layout/SummaryRibbon';
import DashboardGrid from './components/layout/DashboardGrid';
import SettingsPanel from './components/layout/SettingsPanel';
import BottomNav from './components/layout/BottomNav';
import ExpandedModal from './components/layout/ExpandedModal';

function DashboardApp() {
  const { data, statuses, loading, lastUpdated, refresh, retryWidget, wsStatus, widgetTimestamps, widgetSources, now } = useMarketData();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expandedWidget, setExpandedWidget] = useState<WidgetId | null>(null);
  const { isDark } = useTheme();

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'} transition-colors duration-200`}>
      <Header onOpenSettings={() => setSettingsOpen(true)} />
      <SummaryRibbon
        items={data.ribbon}
        lastUpdated={lastUpdated}
        loading={loading}
        ribbonStatus={statuses.ribbon}
        onRefresh={refresh}
        wsStatus={wsStatus}
        onWsReconnect={() => wsManager.reconnect()}
        wsAttempt={wsManager.getAttempt()}
      />

      <main className="max-w-screen-2xl mx-auto px-3 sm:px-4 xl:px-6 py-5 pb-20 md:pb-6">
        <DashboardGrid
          data={data}
          events={data.economicCalendar}
          news={data.news}
          statuses={statuses}
          widgetTimestamps={widgetTimestamps}
          widgetSources={widgetSources}
          now={now}
          onExpandWidget={(id) => setExpandedWidget(id)}
          onRetry={(key) => retryWidget(key as keyof WidgetStatuses)}
        />
      </main>

      <BottomNav />

      {settingsOpen && (
        <SettingsPanel onClose={() => setSettingsOpen(false)} />
      )}

      {expandedWidget && (
        <ExpandedModal
          widgetId={expandedWidget}
          data={data}
          onClose={() => setExpandedWidget(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <DashboardProvider>
        <MarketDataProvider>
          <DashboardApp />
        </MarketDataProvider>
      </DashboardProvider>
    </ThemeProvider>
  );
}
