import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({
    select: { id: true, ticker: true, name: true },
  });

  for (const company of companies) {
    // Check cached prices
    const priceCount = await prisma.stockPriceCache.count({
      where: { companyId: company.id },
    });
    const latest = await prisma.stockPriceCache.findFirst({
      where: { companyId: company.id },
      orderBy: { date: "desc" },
      select: { close: true, date: true },
    });

    // Calc avg move
    const prices = await prisma.stockPriceCache.findMany({
      where: { companyId: company.id },
      orderBy: { date: "desc" },
      take: 31,
      select: { close: true },
    });
    let avgMove = 2;
    if (prices.length >= 2) {
      const moves: number[] = [];
      for (let i = 0; i < prices.length - 1; i++) {
        const curr = Number(prices[i].close);
        const prev = Number(prices[i + 1].close);
        if (prev > 0) moves.push(Math.abs(((curr - prev) / prev) * 100));
      }
      avgMove = moves.reduce((a, b) => a + b, 0) / moves.length;
    }

    const moveThreshold = Math.max(Math.round(avgMove * 1.5 * 2) / 2, 0.5);
    const basePrice = Number(latest?.close ?? 100);
    const targetPrice = Math.round(basePrice * (1 + (avgMove * 0.75) / 100) * 100) / 100;

    console.log(`\n${company.ticker}:`);
    console.log(`  Cached prices: ${priceCount} rows, latest: ${latest?.date.toDateString()} @ $${latest?.close}`);
    console.log(`  Avg daily move (30d): ${avgMove.toFixed(2)}%`);
    console.log(`  Move threshold (1.5x): ${moveThreshold}%`);
    console.log(`  Price target: $${targetPrice}`);
  }

  // Check today's markets
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const markets = await prisma.market.findMany({
    where: { betDate: today },
    select: { company: { select: { ticker: true } }, metricType: true, thresholdLabel: true, question: true },
  });

  console.log(`\n--- Today's markets (${markets.length}) ---`);
  for (const m of markets) {
    console.log(`${m.company.ticker} | ${m.metricType} | ${m.thresholdLabel}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
