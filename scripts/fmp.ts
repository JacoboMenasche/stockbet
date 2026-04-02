const BASE = "https://financialmodelingprep.com/api/v3";

function key(): string {
  const k = process.env.FMP_API_KEY;
  if (!k) throw new Error("FMP_API_KEY is not set in environment");
  return k;
}

async function fmpGet<T>(path: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}apikey=${key()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP request failed: ${path} → HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export interface FmpEarningsCalendarItem {
  symbol: string;
  date: string;        // "2026-04-30"
  time: string;        // "amc" | "bmo" | "dmh"
  epsEstimated: number | null;
  revenueEstimated: number | null;
}

export interface FmpAnalystEstimate {
  symbol: string;
  date: string;
  estimatedEpsAvg: number;
  estimatedEpsHigh: number;
  estimatedEpsLow: number;
  estimatedRevenueAvg: number;
  estimatedRevenueLow: number;
  estimatedRevenueHigh: number;
}

export interface FmpIncomeStatement {
  symbol: string;
  date: string;
  revenue: number;
  grossProfit: number;
  grossProfitRatio: number;   // e.g. 0.468 = 46.8%
  operatingIncome: number;
  operatingIncomeRatio: number;
  eps: number;
}

export interface FmpHistoricalPrice {
  date: string;  // "2026-01-15"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchEarningsCalendar(
  from: string,
  to: string
): Promise<FmpEarningsCalendarItem[]> {
  return fmpGet<FmpEarningsCalendarItem[]>(`/earning_calendar?from=${from}&to=${to}`);
}

export async function fetchAnalystEstimates(
  ticker: string
): Promise<FmpAnalystEstimate[]> {
  return fmpGet<FmpAnalystEstimate[]>(`/analyst-estimates/${ticker}`);
}

export async function fetchIncomeStatements(
  ticker: string,
  limit = 4
): Promise<FmpIncomeStatement[]> {
  return fmpGet<FmpIncomeStatement[]>(`/income-statement/${ticker}?limit=${limit}`);
}

export async function fetchHistoricalPrices(
  ticker: string,
  timeseries = 90
): Promise<FmpHistoricalPrice[]> {
  const data = await fmpGet<{ historical: FmpHistoricalPrice[] }>(
    `/historical-price-full/${ticker}?timeseries=${timeseries}`
  );
  return data.historical ?? [];
}
