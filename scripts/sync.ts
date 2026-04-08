import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { fetchHistoricalPrices } from "./fmp";

const db = new PrismaClient();

async function syncCompany(ticker: string) {
  const company = await db.company.findUnique({ where: { ticker } });
  if (!company) {
    console.warn(`[sync] Company ${ticker} not in DB — skipping`);
    return;
  }

  // Stock price cache (90 days)
  const prices = await fetchHistoricalPrices(ticker, 90);
  for (const p of prices) {
    await db.stockPriceCache.upsert({
      where: { companyId_date: { companyId: company.id, date: new Date(p.date) } },
      update: { open: p.open, high: p.high, low: p.low, close: p.close, volume: p.volume },
      create: {
        companyId: company.id,
        date: new Date(p.date),
        open: p.open,
        high: p.high,
        low: p.low,
        close: p.close,
        volume: p.volume,
      },
    });
  }
  console.log(`[sync] Cached ${prices.length} price points for ${ticker}`);
}

async function main() {
  const companies = await db.company.findMany({ select: { ticker: true } });
  console.log(`[sync] Syncing ${companies.length} companies...`);
  for (const c of companies) {
    try {
      await syncCompany(c.ticker);
    } catch (err) {
      console.error(`[sync] Error syncing ${c.ticker}:`, err);
    }
  }
  console.log("[sync] Done.");
}

main().finally(() => db.$disconnect());
