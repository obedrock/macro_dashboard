import React from 'react';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { PriceItem, WidgetStatus, WsStatus } from '../../types';

interface Props {
  items: PriceItem[];
  lastUpdated: Date;
  loading: boolean;
  ribbonStatus: WidgetStatus;
  onRefresh: () => void;
  wsStatus: WsStatus;
  onWsReconnect?: () => void;
  wsAttempt?: number;
}

export default function SummaryRibbon({ items, lastUpdated, loading, ribbonStatus, onRefresh, wsStatus, onWsReconnect, wsAttempt = 0 }: Props) {
  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const isLive = ribbonStatus.state === 'loaded';

  return (
    <div className="w-full bg-slate-950 border-b border-slate-800 sticky top-0 z-40 flex items-stretch">
      <div className="flex-1 overflow-x-auto scrollbar-none min-w-0">
        <div className="flex items-center h-full">
          {ribbonStatus.state === 'loading' ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-r border-slate-800 flex-shrink-0">
                <div>
                  <div className="h-2.5 w-14 bg-slate-800 rounded animate-pulse mb-1.5" />
                  <div className="h-3.5 w-20 bg-slate-800 rounded animate-pulse" />
                </div>
                <div className="h-3 w-10 bg-slate-800 rounded animate-pulse" />
              </div>
            ))
          ) : (
            items.map((item, idx) => (
              <div
                key={item.label}
                className={`flex items-center gap-3 px-4 py-2.5 border-r border-slate-800 flex-shrink-0 hover:bg-slate-900 transition-colors cursor-default ${
                  idx === 0 ? 'border-l-0' : ''
                }`}
              >
                <div>
                  <div className="text-xs text-slate-500 font-medium leading-none mb-0.5">{item.label}</div>
                  <div className="text-sm font-mono font-semibold text-slate-100 tabular-nums leading-none">
                    {item.prefix}
                    {item.value.toLocaleString('en-US', {
                      minimumFractionDigits: item.unit === '%' ? 3 : item.value < 10 ? 3 : 2,
                      maximumFractionDigits: item.unit === '%' ? 3 : item.value < 10 ? 3 : 2,
                    })}
                    {item.unit && <span className="text-slate-500 text-xs ml-0.5">{item.unit}</span>}
                  </div>
                </div>
                <div
                  className={`text-xs font-mono tabular-nums ${
                    item.changePct > 0 ? 'text-emerald-400' : item.changePct < 0 ? 'text-red-400' : 'text-slate-500'
                  }`}
                >
                  <span>{item.changePct > 0 ? '+' : ''}{item.changePct.toFixed(2)}%</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center gap-2 px-4 border-l border-slate-800 bg-slate-950">
        <div className="hidden sm:flex items-center gap-1.5 mr-2 pr-2 border-r border-slate-800">
          {wsStatus === 'failed' && onWsReconnect ? (
            <button
              onClick={onWsReconnect}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              title="Click to reconnect"
            >
              <span className="inline-flex rounded-full h-2 w-2 bg-red-500" />
              <span className="text-xs text-red-400 hover:text-red-300">WS off</span>
            </button>
          ) : (
            <>
              <span className={`inline-flex rounded-full h-2 w-2 ${
                wsStatus === 'connected' ? 'bg-emerald-500' :
                wsStatus === 'connecting' ? 'bg-amber-400 animate-pulse' :
                wsStatus === 'reconnecting' ? 'bg-amber-400 animate-pulse' :
                'bg-red-500'
              }`} />
              <span className="text-xs text-slate-500">
                {wsStatus === 'connected' ? 'WS' :
                 wsStatus === 'connecting' ? 'WS...' :
                 wsStatus === 'reconnecting' ? `WS... ${wsAttempt}/10` :
                 'WS off'}
              </span>
            </>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          {isLive ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <Wifi size={11} className="text-emerald-500" />
            </>
          ) : (
            <WifiOff size={11} className="text-slate-600" />
          )}
          <span className="text-xs text-slate-400 font-mono">
            {formatTime(lastUpdated)}
          </span>
        </div>
        <button
          onClick={onRefresh}
          className={`p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all ${
            loading ? 'animate-spin text-sky-400' : ''
          }`}
          disabled={loading}
        >
          <RefreshCw size={13} />
        </button>
      </div>
    </div>
  );
}
