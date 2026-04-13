import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import { fetchHistoricalPrices } from "../src/lib/fmp";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({
    select: { id: true, ticker: true },
  });

  for (const company of companies) {
    console.log(`Syncing prices for ${company.ticker}...`);
    try {
      const all = await fetchHistoricalPrices(company.ticker, 30);
      const fresh = all.slice(-30);

      for (const p of fresh) {
        await prisma.stockPriceCache.upsert({
          where: { companyId_date: { companyId: company.id, date: new Date(p.date) } },
          update: { close: p.close },
          create: {
            companyId: company.id,
            date: new Date(p.date),
            open: 0, high: 0, low: 0,
            close: p.close,
            volume: 0,
          },
        });
      }

      await prisma.company.update({
        where: { id: company.id },
        data: { lastPriceSyncAt: new Date() },
      });

      console.log(`  ${company.ticker}: ${fresh.length} rows synced, latest $${fresh[fresh.length - 1]?.close}`);
    } catch (err) {
      console.error(`  ${company.ticker}: failed —`, err);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
