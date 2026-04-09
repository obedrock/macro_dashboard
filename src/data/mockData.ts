import {
  MarketData,
  EconomicEvent,
  FomcMeeting,
  NewsItem,
  TimeSeriesPoint,
} from '../types';

function genSeries(base: number, days: number, volatility: number): TimeSeriesPoint[] {
  const series: TimeSeriesPoint[] = [];
  let val = base;
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    val = Math.max(0.01, val + (Math.random() - 0.5) * volatility);
    series.push({ date: d.toISOString().split('T')[0], value: parseFloat(val.toFixed(3)) });
  }
  return series;
}

function genInflationSeries(base: number, months: number): TimeSeriesPoint[] {
  const series: TimeSeriesPoint[] = [];
  let val = base + 0.8;
  const now = new Date();
  for (let i = months; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    val = Math.max(0.5, val - 0.04 + (Math.random() - 0.4) * 0.15);
    series.push({ date: d.toISOString().split('T')[0], value: parseFloat(val.toFixed(1)) });
  }
  return series;
}

export const mockMarketData: MarketData = {
  ribbon: [
    { label: 'S&P 500', value: 6760.0, change: -38.0, changePct: -0.56 },
    { label: '10Y Yield', value: 4.33, change: 0.01, changePct: 0.23, unit: '%' },
    { label: 'DXY', value: 103.50, change: -0.22, changePct: -0.21 },
    { label: 'WTI Crude', value: 96.93, change: 0.44, changePct: 0.45, prefix: '$' },
    { label: 'Gold', value: 4714.0, change: -5.6, changePct: -0.12, prefix: '$' },
    { label: 'VIX', value: 25.78, change: -1.2, changePct: -4.45 },
  ],
  rates: [
    { label: 'Fed Funds', value: 3.875, change: 0, changePct: 0, unit: '%' },
    { label: '2Y Treasury', value: 3.79, change: -0.041, changePct: -1.08, unit: '%' },
    { label: '5Y Treasury', value: 3.95, change: -0.02, changePct: -0.50, unit: '%' },
    { label: '10Y Treasury', value: 4.33, change: 0.01, changePct: 0.23, unit: '%' },
    { label: '20Y Treasury', value: 4.70, change: 0.02, changePct: 0.43, unit: '%' },
    { label: '30Y Treasury', value: 4.90, change: 0.02, changePct: 0.41, unit: '%' },
    { label: '10Y TIPS', value: 2.08, change: 0.01, changePct: 0.48, unit: '%' },
    { label: '2s10s Spread', value: 54.0, change: 1.5, changePct: 2.86, unit: 'bps' },
    { label: '2s30s Spread', value: 111.0, change: 2.0, changePct: 1.84, unit: 'bps' },
  ],
  equities: [
    { label: 'S&P 500', value: 6760.0, change: -38.0, changePct: -0.56 },
    { label: 'Nasdaq', value: 16960.0, change: -183.0, changePct: -1.07 },
    { label: 'Dow Jones', value: 47900.0, change: -248.0, changePct: -0.51 },
    { label: 'Russell 2000', value: 2600.0, change: -22.0, changePct: -0.84 },
    { label: 'VIX', value: 25.78, change: -1.2, changePct: -4.45 },
  ],
  fx: [
    { label: 'DXY', value: 103.50, change: -0.22, changePct: -0.21 },
    { label: 'EUR/USD', value: 1.1665, change: 0.0042, changePct: 0.36 },
    { label: 'USD/JPY', value: 158.73, change: 0.62, changePct: 0.39 },
    { label: 'GBP/USD', value: 1.2820, change: -0.0018, changePct: -0.14 },
    { label: 'USD/CNY', value: 7.2580, change: 0.012, changePct: 0.17 },
  ],
  commodities: [
    { label: 'WTI Crude', value: 96.93, change: 0.44, changePct: 0.45, prefix: '$' },
    { label: 'Brent Crude', value: 99.50, change: 0.38, changePct: 0.38, prefix: '$' },
    { label: 'Natural Gas', value: 3.04, change: 0.04, changePct: 1.33, prefix: '$' },
    { label: 'Gold', value: 4714.0, change: -5.6, changePct: -0.12, prefix: '$' },
    { label: 'Silver', value: 73.70, change: -0.35, changePct: -0.47, prefix: '$' },
    { label: 'Copper', value: 5.71, change: -0.025, changePct: -0.43, prefix: '$' },
  ],
  credit: [
    {
      label: 'HY OAS Spread',
      value: 342,
      change: 8,
      series: genSeries(342, 365, 6),
    },
    {
      label: 'IG OAS Spread',
      value: 104,
      change: 2,
      series: genSeries(104, 365, 2),
    },
    {
      label: 'HY-IG Differential',
      value: 238,
      change: 6,
      series: genSeries(238, 365, 5),
    },
  ],
  inflation: [
    { label: 'CPI', sublabel: 'YoY % chg · All Items', value: 3.2, mom: 0.3, series: genInflationSeries(3.2, 24), dataThrough: 'Feb 2025' },
    { label: 'Core CPI', sublabel: 'YoY % chg · Ex Food & Energy', value: 3.8, mom: 0.4, series: genInflationSeries(3.8, 24), dataThrough: 'Feb 2025' },
    { label: 'PCE', sublabel: 'YoY % chg · All Items', value: 2.8, mom: 0.3, series: genInflationSeries(2.8, 24), dataThrough: 'Jan 2025' },
    { label: 'Core PCE', sublabel: 'YoY % chg · Ex Food & Energy', value: 2.9, mom: 0.3, series: genInflationSeries(2.9, 24), dataThrough: 'Jan 2025' },
    { label: '5yr Breakeven', sublabel: '% · Market Inflation Expectation', value: 2.4, mom: null, series: genInflationSeries(2.4, 24), dataThrough: 'Apr 2025' },
    { label: '1yr Expectation', sublabel: '% · Cleveland Fed Model', value: 2.8, mom: null, series: genInflationSeries(2.8, 24), dataThrough: 'Mar 2025' },
  ],
  yieldCurve: [
    { maturity: '1M', current: 4.32, oneMonthAgo: 4.45, oneYearAgo: 5.28 },
    { maturity: '3M', current: 4.28, oneMonthAgo: 4.35, oneYearAgo: 5.19 },
    { maturity: '6M', current: 4.20, oneMonthAgo: 4.25, oneYearAgo: 5.12 },
    { maturity: '1Y', current: 4.05, oneMonthAgo: 4.10, oneYearAgo: 4.95 },
    { maturity: '2Y', current: 3.79, oneMonthAgo: 3.95, oneYearAgo: 4.72 },
    { maturity: '3Y', current: 3.85, oneMonthAgo: 3.98, oneYearAgo: 4.58 },
    { maturity: '5Y', current: 3.95, oneMonthAgo: 4.05, oneYearAgo: 4.51 },
    { maturity: '7Y', current: 4.12, oneMonthAgo: 4.20, oneYearAgo: 4.53 },
    { maturity: '10Y', current: 4.33, oneMonthAgo: 4.40, oneYearAgo: 4.68 },
    { maturity: '20Y', current: 4.70, oneMonthAgo: 4.75, oneYearAgo: 4.75 },
    { maturity: '30Y', current: 4.90, oneMonthAgo: 4.93, oneYearAgo: 4.82 },
  ],
  news: [],
  fomc: {
    nextMeeting: '',
    currentRate: '3.50–3.75%',
    meetings: [],
  },
  economicCalendar: [],
  lastUpdated: new Date(),
};

const today = new Date();
function dateOffset(days: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const mockEconomicCalendar: EconomicEvent[] = [
  {
    id: '1',
    date: dateOffset(0),
    time: '8:30 AM ET',
    name: 'Initial Jobless Claims',
    previous: '212K',
    consensus: '215K',
    importance: 'medium',
  },
  {
    id: '2',
    date: dateOffset(1),
    time: '8:30 AM ET',
    name: 'Nonfarm Payrolls (NFP)',
    previous: '228K',
    consensus: '200K',
    importance: 'high',
  },
  {
    id: '3',
    date: dateOffset(1),
    time: '8:30 AM ET',
    name: 'Unemployment Rate',
    previous: '4.1%',
    consensus: '4.1%',
    importance: 'high',
  },
  {
    id: '4',
    date: dateOffset(3),
    time: '3:00 PM ET',
    name: 'Consumer Credit',
    previous: '$19.5B',
    consensus: '$15.0B',
    importance: 'low',
  },
  {
    id: '5',
    date: dateOffset(7),
    time: '8:30 AM ET',
    name: 'CPI (YoY)',
    previous: '3.1%',
    consensus: '3.0%',
    importance: 'high',
  },
  {
    id: '6',
    date: dateOffset(7),
    time: '8:30 AM ET',
    name: 'Core CPI (YoY)',
    previous: '3.5%',
    consensus: '3.4%',
    importance: 'high',
  },
  {
    id: '7',
    date: dateOffset(8),
    time: '8:30 AM ET',
    name: 'PPI (YoY)',
    previous: '2.7%',
    consensus: '2.8%',
    importance: 'medium',
  },
  {
    id: '8',
    date: dateOffset(10),
    time: '8:30 AM ET',
    name: 'Retail Sales (MoM)',
    previous: '0.4%',
    consensus: '0.3%',
    importance: 'high',
  },
  {
    id: '9',
    date: dateOffset(14),
    time: '8:30 AM ET',
    name: 'Housing Starts',
    previous: '1.501M',
    consensus: '1.480M',
    importance: 'medium',
  },
  {
    id: '10',
    date: dateOffset(21),
    time: '8:30 AM ET',
    name: 'GDP QoQ (Advance)',
    previous: '2.3%',
    consensus: '1.5%',
    importance: 'high',
  },
  {
    id: '11',
    date: dateOffset(22),
    time: '8:30 AM ET',
    name: 'PCE Price Index (YoY)',
    previous: '2.5%',
    consensus: '2.4%',
    importance: 'high',
  },
  {
    id: '12',
    date: dateOffset(28),
    time: '10:00 AM ET',
    name: 'ISM Manufacturing PMI',
    previous: '49.8',
    consensus: '50.0',
    importance: 'medium',
  },
  {
    id: '13',
    date: dateOffset(35),
    time: '10:00 AM ET',
    name: 'JOLTS Job Openings',
    previous: '7.568M',
    consensus: '7.500M',
    importance: 'medium',
  },
  {
    id: '14',
    date: dateOffset(40),
    time: '10:00 AM ET',
    name: 'Consumer Confidence',
    previous: '98.3',
    consensus: '97.0',
    importance: 'medium',
  },
];

export const mockFomcData: {
  nextMeeting: string;
  currentRate: string;
  meetings: FomcMeeting[];
} = {
  nextMeeting: 'May 6-7, 2026',
  currentRate: '3.50–3.75%',
  meetings: [
    {
      date: 'May 6-7, 2026',
      probabilities: [
        { rate: '3.25–3.50%', probability: 12 },
        { rate: '3.50–3.75%', probability: 73 },
        { rate: '3.75–4.00%', probability: 15 },
      ],
    },
    {
      date: 'Jun 17-18, 2026',
      probabilities: [
        { rate: '3.00–3.25%', probability: 8 },
        { rate: '3.25–3.50%', probability: 35 },
        { rate: '3.50–3.75%', probability: 45 },
        { rate: '3.75–4.00%', probability: 12 },
      ],
    },
    {
      date: 'Jul 29-30, 2026',
      probabilities: [
        { rate: '3.00–3.25%', probability: 18 },
        { rate: '3.25–3.50%', probability: 40 },
        { rate: '3.50–3.75%', probability: 35 },
        { rate: '3.75–4.00%', probability: 7 },
      ],
    },
  ],
};

export const mockNews: NewsItem[] = [
  {
    id: '1',
    headline: 'Fed officials signal patience on rate cuts as inflation remains sticky above 3%',
    source: 'Reuters',
    time: '12 min ago',
    url: 'https://www.reuters.com/markets/us/federal-reserve/',
    sentiment: 'negative',
  },
  {
    id: '2',
    headline: 'Treasury yields climb to 3-week high on strong ISM services data',
    source: 'Bloomberg',
    time: '28 min ago',
    url: 'https://www.bloomberg.com/markets/rates-bonds',
    sentiment: 'negative',
  },
  {
    id: '3',
    headline: 'Oil surges past $97 on OPEC+ supply cuts and geopolitical tensions',
    source: 'CNBC',
    time: '1 hr ago',
    url: 'https://www.cnbc.com/oil/',
    sentiment: 'negative',
  },
  {
    id: '4',
    headline: 'Gold rallies to fresh all-time high above $4,700 amid global uncertainty',
    source: 'MarketWatch',
    time: '1 hr ago',
    url: 'https://www.marketwatch.com/investing/future/gold',
    sentiment: 'positive',
  },
  {
    id: '5',
    headline: 'JPMorgan Q1 earnings beat estimates; loan growth moderating, NII outlook raised',
    source: 'WSJ',
    time: '2 hrs ago',
    url: 'https://www.wsj.com/finance/banking',
    sentiment: 'positive',
  },
  {
    id: '6',
    headline: 'Dollar hits 5-month high vs yen as BOJ reiterates gradual normalization path',
    source: 'FT',
    time: '2 hrs ago',
    url: 'https://www.ft.com/currencies',
    sentiment: 'neutral',
  },
  {
    id: '7',
    headline: 'Credit spreads widen as investors reassess recession probability for H2 2026',
    source: 'Bloomberg',
    time: '3 hrs ago',
    url: 'https://www.bloomberg.com/markets/credit',
    sentiment: 'negative',
  },
  {
    id: '8',
    headline: 'NFP preview: Consensus expects 200K jobs added in March, ADP beats at 184K',
    source: 'Reuters',
    time: '4 hrs ago',
    url: 'https://www.reuters.com/markets/us/jobs/',
    sentiment: 'neutral',
  },
  {
    id: '9',
    headline: 'European Central Bank holds rates steady, opens door to June cut if data allows',
    source: 'Bloomberg',
    time: '5 hrs ago',
    url: 'https://www.bloomberg.com/news/articles/ecb-policy',
    sentiment: 'positive',
  },
  {
    id: '10',
    headline: 'China PMI composite rises to 52.7, strongest reading in 14 months on stimulus',
    source: 'Reuters',
    time: '6 hrs ago',
    url: 'https://www.reuters.com/markets/asia/',
    sentiment: 'positive',
  },
];

mockMarketData.news = mockNews;
mockMarketData.fomc = mockFomcData;
mockMarketData.economicCalendar = mockEconomicCalendar;

export const rateHistorySeries: TimeSeriesPoint[] = genSeries(4.33, 365, 0.04);
export const sp500Series: TimeSeriesPoint[] = genSeries(6760, 365, 45);
export const dxySeries: TimeSeriesPoint[] = genSeries(103.5, 365, 0.5);
export const wtiSeries: TimeSeriesPoint[] = genSeries(96.93, 365, 1.2);
export const goldSeries: TimeSeriesPoint[] = genSeries(4714, 365, 18);
export const vixSeries: TimeSeriesPoint[] = genSeries(25.78, 365, 0.8);
