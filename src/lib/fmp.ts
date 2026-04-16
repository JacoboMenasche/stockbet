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
  const body: unknown = await res.json();
  if (!Array.isArray(body)) {
    // FMP returns {"Error Message": "..."} as 200 for invalid keys / rate limits
    const msg = (body as Record<string, unknown>)?.["Error Message"] ?? JSON.stringify(body);
    throw new Error(`FMP unexpected response: ${msg}`);
  }
  if (body.length === 0) return null;
  const r = body[0] as FmpQuoteRow;
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

// ─── Quarterly estimate proxy ─────────────────────────────────────────────────

/**
 * Derives a quarterly consensus estimate from an annual average.
 * Replace the body when FMP quarterly estimates become available on the plan.
 */
export function getQuarterlyEstimate(annualAvg: number): number {
  return annualAvg / 4;
}

/**
 * Formats a large dollar number for display.
 * >= 1B → "$94.3B", >= 1M → "$450.0M", else → "$1.85"
 */
export function formatLargeNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  return `$${(Math.round(value * 100) / 100).toFixed(2)}`;
}

// ─── Income statement ─────────────────────────────────────────────────────────

export interface IncomeStatementRow {
  date: string;         // period end date e.g. "2025-12-28"
  symbol: string;
  revenue: number;
  netIncome: number;
  ebitda: number;
  eps: number;
  epsDiluted: number;
}

/**
 * Fetches the most recent quarterly income statement row for a ticker.
 * Returns null if FMP has no data or the response is not an array.
 */
export async function fetchIncomeStatement(ticker: string): Promise<IncomeStatementRow | null> {
  const url = `${FMP_BASE}/income-statement?symbol=${ticker}&period=quarterly&limit=1&apikey=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP error: ${res.status}`);
  const body: unknown = await res.json();
  if (!Array.isArray(body)) {
    const msg = (body as Record<string, unknown>)?.["Error Message"] ?? JSON.stringify(body);
    throw new Error(`FMP unexpected response: ${msg}`);
  }
  if (body.length === 0) return null;
  return body[0] as IncomeStatementRow;
}

// ─── Analyst estimates ────────────────────────────────────────────────────────

export interface AnalystEstimatesRow {
  symbol: string;
  date: string;
  epsAvg: number;
  revenueAvg: number;
  netIncomeAvg: number;
  ebitdaAvg: number;
}

/**
 * Fetches the most recent annual analyst estimates row for a ticker.
 * Returns null if no data is available.
 */
export async function fetchAnalystEstimates(ticker: string): Promise<AnalystEstimatesRow | null> {
  const url = `${FMP_BASE}/analyst-estimates?symbol=${ticker}&period=annual&limit=1&apikey=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP error: ${res.status}`);
  const body: unknown = await res.json();
  if (!Array.isArray(body)) {
    const msg = (body as Record<string, unknown>)?.["Error Message"] ?? JSON.stringify(body);
    throw new Error(`FMP unexpected response: ${msg}`);
  }
  if (body.length === 0) return null;
  return body[0] as AnalystEstimatesRow;
}
