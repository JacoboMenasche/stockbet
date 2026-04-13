import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import { fetchNextEarnings } from "../src/lib/fmp";

dotenv.config();

const prisma = new PrismaClient();

function quarterLabel(reportDate: Date): string {
  const month = reportDate.getMonth() + 1; // 1-12
  const year = reportDate.getFullYear();
  // Companies report ~1 quarter after the period ends
  if (month <= 3) return `Q4-${year - 1}`;
  if (month <= 6) return `Q1-${year}`;
  if (month <= 9) return `Q2-${year}`;
  return `Q3-${year}`;
}

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, ticker: true } });

  for (const company of companies) {
    console.log(`Syncing earnings for ${company.ticker}...`);
    try {
      const earnings = await fetchNextEarnings(company.ticker);
      if (!earnings) {
        console.log(`  No upcoming earnings found for ${company.ticker}`);
        continue;
      }

      const reportDate = new Date(earnings.date + "T16:00:00Z"); // default 4pm UTC (after close)
      const quarter = quarterLabel(reportDate);

      await prisma.earningsEvent.upsert({
        where: { companyId_quarter: { companyId: company.id, quarter } },
        update: { reportDate, isConfirmed: true },
        create: {
          companyId: company.id,
          quarter,
          reportDate,
          isConfirmed: true,
        },
      });

      console.log(`  ${company.ticker}: ${earnings.date} (${quarter})`);
    } catch (err) {
      console.error(`  Error syncing ${company.ticker}:`, err);
    }
  }

  console.log("Earnings sync complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
