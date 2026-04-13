import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const todayCount = await prisma.market.count({ where: { betDate: today } });
  const tomorrowMarkets = await prisma.market.findMany({
    where: { betDate: tomorrow },
    select: { metricType: true, status: true, company: { select: { ticker: true } } },
  });

  console.log(`Today (${today.toDateString()}): ${todayCount} markets`);
  console.log(`Tomorrow (${tomorrow.toDateString()}): ${tomorrowMarkets.length} markets`);
  tomorrowMarkets.forEach(m => console.log(`  ${m.company.ticker} | ${m.metricType} | ${m.status}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
