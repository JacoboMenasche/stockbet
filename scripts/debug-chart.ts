import { db } from "../src/lib/db";
import { fetchHistoricalPrices } from "../src/lib/fmp";

async function main() {
  const company = await db.company.findUnique({
    where: { ticker: "AAPL" },
    select: { id: true },
  });
  console.log("Company:", company);

  const count = await db.stockPriceCache.count({
    where: { companyId: company?.id },
  });
  console.log("Cached price rows:", count);

  const fresh = await fetchHistoricalPrices("AAPL", 30);
  console.log("FMP returned rows:", fresh.length, "| first:", fresh[0], "| last:", fresh[fresh.length - 1]);

  await db.$disconnect();
}

main().catch(console.error);
