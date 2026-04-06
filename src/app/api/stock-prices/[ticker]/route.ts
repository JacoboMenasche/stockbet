import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchHistoricalPrices } from "@/lib/fmp";

const RANGE_DAYS: Record<string, number | "YTD"> = {
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "YTD": "YTD",
  "1Y": 365,
};

function rangeToDays(range: string): number {
  const val = RANGE_DAYS[range];
  if (val === "YTD") {
    const now = new Date();
    const jan1 = new Date(now.getFullYear(), 0, 1);
    return Math.ceil((now.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
  }
  return val as number;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await context.params;
  const range = req.nextUrl.searchParams.get("range") ?? "1M";

  if (!RANGE_DAYS[range]) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  const company = await db.company.findUnique({
    where: { ticker: ticker.toUpperCase() },
    select: { id: true },
  });

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const days = rangeToDays(range);

  // Check cache freshness: latest cached date for this company
  const latest = await db.stockPriceCache.findFirst({
    where: { companyId: company.id },
    orderBy: { date: "desc" },
    select: { date: true },
  });

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const isStale = !latest || latest.date < yesterday;

  if (isStale) {
    try {
      const fresh = await fetchHistoricalPrices(ticker.toUpperCase(), days);
      for (const p of fresh) {
        await db.stockPriceCache.upsert({
          where: {
            companyId_date: { companyId: company.id, date: new Date(p.date) },
          },
          update: { close: p.close },
          create: {
            companyId: company.id,
            date: new Date(p.date),
            open: 0,
            high: 0,
            low: 0,
            close: p.close,
            volume: 0,
          },
        });
      }
    } catch (err) {
      console.error(`[stock-prices] FMP fetch failed for ${ticker}:`, err);
      // Fall through to serve whatever cache we have
    }
  }

  // Serve from cache
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const prices = await db.stockPriceCache.findMany({
    where: {
      companyId: company.id,
      date: { gte: cutoff },
    },
    orderBy: { date: "asc" },
    select: { date: true, close: true },
  });

  return NextResponse.json({
    prices: prices.map((p) => ({
      date: p.date.toISOString().slice(0, 10),
      close: Number(p.close),
    })),
  });
}
