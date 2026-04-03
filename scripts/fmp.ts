const BASE = "https://financialmodelingprep.com/stable";

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
  date: string;          // "2026-04-30"
  epsEstimated: number | null;
  revenueEstimated: number | null;
}

export interface FmpIncomeStatement {
  symbol: string;
  date: string;
  revenue: number;
  grossProfit: number;
  operatingIncome: number;
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
  return fmpGet<FmpEarningsCalendarItem[]>(`/earnings-calendar?from=${from}&to=${to}`);
}

export async function fetchIncomeStatements(
  ticker: string,
  limit = 4
): Promise<FmpIncomeStatement[]> {
  return fmpGet<FmpIncomeStatement[]>(`/income-statement?symbol=${ticker}&limit=${limit}`);
}

export async function fetchHistoricalPrices(
  ticker: string,
  limit = 90
): Promise<FmpHistoricalPrice[]> {
  return fmpGet<FmpHistoricalPrice[]>(
    `/historical-price-eod/full?symbol=${ticker}&limit=${limit}`
  );
}
