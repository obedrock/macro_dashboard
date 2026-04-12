export interface PriceItem {
  label: string;
  value: number;
  change: number;
  changePct: number;
  unit?: string;
  prefix?: string;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface YieldCurveData {
  maturity: string;
  current: number;
  oneMonthAgo: number;
  oneYearAgo: number;
}

export interface EconomicEvent {
  id: string;
  date: string;
  time: string;
  name: string;
  previous: string;
  consensus: string;
  actual?: string;
  importance: 'high' | 'medium' | 'low';
}

export interface FomcMeeting {
  date: string;
  probabilities: { rate: string; probability: number }[];
}

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  time: string;
  url: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export type WidgetId =
  | 'yields'
  | 'rates'
  | 'equities'
  | 'fx'
  | 'commodities'
  | 'credit'
  | 'inflation'
  | 'calendar'
  | 'fedwatch'
  | 'news';

export interface WidgetConfig {
  id: WidgetId;
  label: string;
  visible: boolean;
  order: number;
  size: 'small' | 'medium' | 'large';
}

export interface DashboardSettings {
  widgets: WidgetConfig[];
  defaultTimeRange: '1D' | '1W' | '1M' | '3M' | '1Y' | '5Y';
}

export interface FomcData {
  nextMeeting: string;
  currentRate: string;
  meetings: FomcMeeting[];
}

export interface MarketData {
  ribbon: PriceItem[];
  rates: PriceItem[];
  equities: PriceItem[];
  fx: PriceItem[];
  commodities: PriceItem[];
  credit: { label: string; value: number; change: number; series: TimeSeriesPoint[] }[];
  inflation: { label: string; sublabel: string; value: number; mom: number | null; series: TimeSeriesPoint[]; dataThrough: string }[];
  yieldCurve: YieldCurveData[];
  news: NewsItem[];
  fomc: FomcData;
  economicCalendar: EconomicEvent[];
  lastUpdated: Date;
}

export interface ResultWarning {
  field: string;
  message: string;
}

export type WidgetLoadState = 'loading' | 'loaded' | 'error';

export interface WidgetStatus {
  state: WidgetLoadState;
  error?: string;
}

export interface WidgetStatuses {
  ribbon: WidgetStatus;
  equities: WidgetStatus;
  fx: WidgetStatus;
  commodities: WidgetStatus;
  rates: WidgetStatus;
  yields: WidgetStatus;
  credit: WidgetStatus;
  inflation: WidgetStatus;
  news: WidgetStatus;
  calendar: WidgetStatus;
}
