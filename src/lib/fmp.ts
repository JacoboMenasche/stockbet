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
