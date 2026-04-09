import React, { useState, useRef } from 'react';
import { WidgetConfig, WidgetId, WidgetStatuses } from '../../types';
import { useDashboard } from '../../context/DashboardContext';
import { MarketData, EconomicEvent, NewsItem } from '../../types';

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
  onExpandWidget: (id: WidgetId) => void;
  onRetry: (key: keyof WidgetStatuses) => void;
}

export default function DashboardGrid({ data, events, news, statuses, onExpandWidget, onRetry }: Props) {
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

    switch (widget.id) {
      case 'yields':
        return (
          <div key={widget.id} className={wrapClass}>
            <YieldCurveChart
              data={data.yieldCurve}
              status={statuses.yields}
              onRetry={() => onRetry('yields')}
              {...baseProps}
            />
          </div>
        );
      case 'rates':
        return (
          <div key={widget.id} className={wrapClass}>
            <RatesPanel
              data={data.rates}
              status={statuses.rates}
              onRetry={() => onRetry('rates')}
              {...baseProps}
            />
          </div>
        );
      case 'equities':
        return (
          <div key={widget.id} className={wrapClass}>
            <EquitiesPanel
              data={data.equities}
              status={statuses.equities}
              onRetry={() => onRetry('equities')}
              {...baseProps}
            />
          </div>
        );
      case 'fx':
        return (
          <div key={widget.id} className={wrapClass}>
            <FXPanel
              data={data.fx}
              status={statuses.fx}
              onRetry={() => onRetry('fx')}
              {...baseProps}
            />
          </div>
        );
      case 'commodities':
        return (
          <div key={widget.id} className={wrapClass}>
            <CommoditiesPanel
              data={data.commodities}
              status={statuses.commodities}
              onRetry={() => onRetry('commodities')}
              {...baseProps}
            />
          </div>
        );
      case 'credit':
        return (
          <div key={widget.id} className={wrapClass}>
            <CreditPanel
              data={data.credit}
              status={statuses.credit}
              onRetry={() => onRetry('credit')}
              {...baseProps}
            />
          </div>
        );
      case 'inflation':
        return (
          <div key={widget.id} className={wrapClass}>
            <InflationPanel
              data={data.inflation}
              status={statuses.inflation}
              onRetry={() => onRetry('inflation')}
              {...baseProps}
            />
          </div>
        );
      case 'calendar':
        return (
          <div key={widget.id} className={wrapClass}>
            <EconomicCalendar
              events={events}
              status={statuses.calendar}
              onRetry={() => onRetry('calendar')}
              {...baseProps}
            />
          </div>
        );
      case 'fedwatch':
        return (
          <div key={widget.id} className={wrapClass}>
            <FedWatchWidget
              nextMeeting={data.fomc.nextMeeting}
              currentRate={data.fomc.currentRate}
              meetings={data.fomc.meetings}
              status={statuses.calendar}
              onRetry={() => onRetry('calendar')}
              {...baseProps}
            />
          </div>
        );
      case 'news':
        return (
          <div key={widget.id} className={wrapClass}>
            <NewsWidget
              news={news}
              status={statuses.news}
              onRetry={() => onRetry('news')}
              {...baseProps}
            />
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
