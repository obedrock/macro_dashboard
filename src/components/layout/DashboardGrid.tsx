import React, { useState, useRef } from 'react';
import { WidgetConfig, WidgetId, WidgetStatuses, WidgetTimestamps, WidgetSources } from '../../types';
import { useDashboard } from '../../context/DashboardContext';
import { MarketData, EconomicEvent, NewsItem } from '../../types';
import WidgetErrorBoundary from '../shared/WidgetErrorBoundary';
import FreshnessLabel from '../shared/FreshnessLabel';
import DataSourceBadge from '../shared/DataSourceBadge';

import RatesPanel from '../widgets/RatesPanel';
import EquitiesPanel from '../widgets/EquitiesPanel';
import FXPanel from '../widgets/FXPanel';
import CommoditiesPanel from '../widgets/CommoditiesPanel';
import CreditPanel from '../widgets/CreditPanel';
import InflationPanel from '../widgets/InflationPanel';
import YieldCurveChart from '../widgets/YieldCurveChart';
import EconomicCalendar from '../widgets/EconomicCalendar';
import FedWatchWidget from '../widgets/FedWatchWidget';
import NewsWidget from '../widgets/NewsWidget';

interface Props {
  data: MarketData;
  events: EconomicEvent[];
  news: NewsItem[];
  statuses: WidgetStatuses;
  widgetTimestamps: WidgetTimestamps;
  widgetSources: WidgetSources;
  now: number;
  onExpandWidget: (id: WidgetId) => void;
  onRetry: (key: keyof WidgetStatuses) => void;
}

export default function DashboardGrid({ data, events, news, statuses, widgetTimestamps, widgetSources, now, onExpandWidget, onRetry }: Props) {
  const { visibleWidgets, reorderWidgets } = useDashboard();
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const dragNode = useRef<number | null>(null);

  const handleDragStart = (idx: number) => {
    dragNode.current = idx;
    setDragIdx(idx);
  };

  const handleDragEnter = (idx: number) => {
    if (dragNode.current !== null && dragNode.current !== idx) {
      setDropIdx(idx);
    }
  };

  const handleDragEnd = () => {
    if (dragNode.current !== null && dropIdx !== null) {
      reorderWidgets(dragNode.current, dropIdx);
    }
    setDragIdx(null);
    setDropIdx(null);
    dragNode.current = null;
  };

  const dragHandleProps = (idx: number) => ({
    draggable: true,
    onDragStart: () => handleDragStart(idx),
    onDragEnter: () => handleDragEnter(idx),
    onDragEnd: handleDragEnd,
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
  });

  const renderWidget = (widget: WidgetConfig, idx: number) => {
    const baseProps = {
      onExpand: () => onExpandWidget(widget.id),
      dragHandleProps: dragHandleProps(idx),
    };

    const isBeingDragged = dragIdx === idx;
    const isDropTarget = dropIdx === idx;

    const wrapClass = `
      transition-all duration-200
      ${isBeingDragged ? 'opacity-40' : ''}
      ${isDropTarget ? 'ring-2 ring-sky-500/40 rounded-xl' : ''}
      ${widget.size === 'large' ? 'col-span-1 lg:col-span-2' : 'col-span-1'}
    `;

    const widgetKey = widget.id as keyof WidgetTimestamps;
    const freshnessLabel = <FreshnessLabel lastFetched={widgetTimestamps[widgetKey]} now={now} />;
    const sourceBadge = <DataSourceBadge source={widgetSources[widgetKey]} />;

    switch (widget.id) {
      case 'yields':
        return (
          <div key={widget.id} className={wrapClass}>
            <WidgetErrorBoundary widgetTitle={widget.label}>
              <YieldCurveChart
                data={data.yieldCurve}
                status={statuses.yields}
                onRetry={() => onRetry('yields')}
                badge={sourceBadge}
                freshnessNode={freshnessLabel}
                {...baseProps}
              />
            </WidgetErrorBoundary>
          </div>
        );
      case 'rates':
        return (
          <div key={widget.id} className={wrapClass}>
            <WidgetErrorBoundary widgetTitle={widget.label}>
              <RatesPanel
                data={data.rates}
                status={statuses.rates}
                onRetry={() => onRetry('rates')}
                badge={sourceBadge}
                headerRight={freshnessLabel}
                {...baseProps}
              />
            </WidgetErrorBoundary>
          </div>
        );
      case 'equities':
        return (
          <div key={widget.id} className={wrapClass}>
            <WidgetErrorBoundary widgetTitle={widget.label}>
              <EquitiesPanel
                data={data.equities}
                status={statuses.equities}
                onRetry={() => onRetry('equities')}
                badge={sourceBadge}
                freshnessNode={freshnessLabel}
                now={now}
                {...baseProps}
              />
            </WidgetErrorBoundary>
          </div>
        );
      case 'fx':
        return (
          <div key={widget.id} className={wrapClass}>
            <WidgetErrorBoundary widgetTitle={widget.label}>
              <FXPanel
                data={data.fx}
                status={statuses.fx}
                onRetry={() => onRetry('fx')}
                badge={sourceBadge}
                headerRight={freshnessLabel}
                {...baseProps}
              />
            </WidgetErrorBoundary>
          </div>
        );
      case 'commodities':
        return (
          <div key={widget.id} className={wrapClass}>
            <WidgetErrorBoundary widgetTitle={widget.label}>
              <CommoditiesPanel
                data={data.commodities}
                status={statuses.commodities}
                onRetry={() => onRetry('commodities')}
                badge={sourceBadge}
                headerRight={freshnessLabel}
                {...baseProps}
              />
            </WidgetErrorBoundary>
          </div>
        );
      case 'credit':
        return (
          <div key={widget.id} className={wrapClass}>
            <WidgetErrorBoundary widgetTitle={widget.label}>
              <CreditPanel
                data={data.credit}
                status={statuses.credit}
                onRetry={() => onRetry('credit')}
                badge={sourceBadge}
                headerRight={freshnessLabel}
                {...baseProps}
              />
            </WidgetErrorBoundary>
          </div>
        );
      case 'inflation':
        return (
          <div key={widget.id} className={wrapClass}>
            <WidgetErrorBoundary widgetTitle={widget.label}>
              <InflationPanel
                data={data.inflation}
                status={statuses.inflation}
                onRetry={() => onRetry('inflation')}
                badge={sourceBadge}
                headerRight={freshnessLabel}
                {...baseProps}
              />
            </WidgetErrorBoundary>
          </div>
        );
      case 'calendar':
        return (
          <div key={widget.id} className={wrapClass}>
            <WidgetErrorBoundary widgetTitle={widget.label}>
              <EconomicCalendar
                events={events}
                status={statuses.calendar}
                onRetry={() => onRetry('calendar')}
                badge={sourceBadge}
                headerRight={freshnessLabel}
                {...baseProps}
              />
            </WidgetErrorBoundary>
          </div>
        );
      case 'fedwatch':
        return (
          <div key={widget.id} className={wrapClass}>
            <WidgetErrorBoundary widgetTitle={widget.label}>
              <FedWatchWidget
                nextMeeting={data.fomc.nextMeeting}
                currentRate={data.fomc.currentRate}
                meetings={data.fomc.meetings}
                status={statuses.calendar}
                onRetry={() => onRetry('calendar')}
                badge={sourceBadge}
                headerRight={freshnessLabel}
                {...baseProps}
              />
            </WidgetErrorBoundary>
          </div>
        );
      case 'news':
        return (
          <div key={widget.id} className={wrapClass}>
            <WidgetErrorBoundary widgetTitle={widget.label}>
              <NewsWidget
                news={news}
                status={statuses.news}
                onRetry={() => onRetry('news')}
                badge={sourceBadge}
                headerRight={freshnessLabel}
                {...baseProps}
              />
            </WidgetErrorBoundary>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {visibleWidgets.map((widget, idx) => renderWidget(widget, idx))}
    </div>
  );
}
