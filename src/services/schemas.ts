import { z } from 'zod';

// --- TwelveData Schemas ---

// Matches TdQuote type in twelveDataService.ts
export const TdQuoteSchema = z.object({
  symbol: z.string(),
  name: z.string().optional(),
  close: z.string(),
  change: z.string(),
  percent_change: z.string(),
  previous_close: z.string(),
  open: z.string().optional(),
  high: z.string().optional(),
  low: z.string().optional(),
}).passthrough();

// TwelveData error response within batch
export const TdErrorSchema = z.object({
  status: z.string(),
  message: z.string(),
}).passthrough();

// Batch result: record of symbol -> quote or error
export const TdBatchResultSchema = z.record(
  z.string(),
  z.union([TdQuoteSchema, TdErrorSchema])
);

// Time series response
export const TdTimeSeriesSchema = z.object({
  values: z.array(z.object({
    datetime: z.string(),
    close: z.string(),
  }).passthrough()),
}).passthrough();

// --- FRED Schemas ---

export const FredObservationSchema = z.object({
  date: z.string(),
  value: z.string(),
}).passthrough();

export const FredResponseSchema = z.object({
  observations: z.array(FredObservationSchema),
}).passthrough();

// --- Finnhub Schemas ---

export const FinnhubNewsItemSchema = z.object({
  id: z.number(),
  headline: z.string(),
  source: z.string(),
  datetime: z.number(),
  url: z.string(),
  summary: z.string().optional(),
}).passthrough();

export const FinnhubNewsResponseSchema = z.array(FinnhubNewsItemSchema);

export const FinnhubCalendarEventSchema = z.object({
  event: z.string(),
  time: z.string(),
  date: z.string(),
  country: z.string(),
  impact: z.string(),
  prev: z.string().nullable(),
  estimate: z.string().nullable(),
  actual: z.string().nullable(),
}).passthrough();

export const FinnhubCalendarResponseSchema = z.object({
  economicCalendar: z.array(FinnhubCalendarEventSchema).optional(),
}).passthrough();
