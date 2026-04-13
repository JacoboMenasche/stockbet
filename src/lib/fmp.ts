const FMP_BASE = "https://financialmodelingprep.com/stable";

function apiKey(): string {
  const k = process.env.FMP_API_KEY;
  if (!k) throw new Error("FMP_API_KEY is not set");
  return k;
}

export interface HistoricalPrice {
  date: string;
  close: number;
}

interface FmpPriceRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface FmpEarningsRow {
  date: string;
  symbol: string;
}

export async function fetchNextEarnings(ticker: string): Promise<{ date: string } | null> {
  const url = `${FMP_BASE}/earning_calendar?symbol=${ticker}&apikey=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP error: ${res.status}`);
  const rows: FmpEarningsRow[] = await res.json();
  if (!rows || rows.length === 0) return null;
  const future = rows.filter((r) => new Date(r.date) >= new Date()).sort((a, b) => a.date.localeCompare(b.date));
  return future[0] ? { date: future[0].date } : null;
}

export interface Quote {
  price: number;
  open: number;
  previousClose: number;
}

interface FmpQuoteRow {
  price: number;
  open: number;
  previousClose: number;
}

export async function fetchQuote(ticker: string): Promise<Quote | null> {
  const url = `${FMP_BASE}/quote?symbol=${ticker}&apikey=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP error: ${res.status}`);
  const rows: FmpQuoteRow[] = await res.json();
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  return { price: r.price, open: r.open, previousClose: r.previousClose };
}

export async function fetchHistoricalPrices(
  ticker: string,
  days: number
): Promise<HistoricalPrice[]> {
  const url = `${FMP_BASE}/historical-price-eod/full?symbol=${ticker}&limit=${days}&apikey=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP error: ${res.status}`);
  const rows: FmpPriceRow[] = await res.json();
  return rows
    .map((r) => ({ date: r.date, close: r.close }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
