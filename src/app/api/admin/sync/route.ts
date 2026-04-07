import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { fetchHistoricalPrices } from "@/lib/fmp";

export async function POST() {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const companies = await db.company.findMany({ select: { id: true, ticker: true } });
  const updated: string[] = [];
  const errors: string[] = [];

  for (const company of companies) {
    try {
      const prices = await fetchHistoricalPrices(company.ticker, 90);
      for (const p of prices) {
        await db.stockPriceCache.upsert({
          where: { companyId_date: { companyId: company.id, date: new Date(p.date) } },
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
      updated.push(company.ticker);
    } catch {
      errors.push(company.ticker);
    }
  }

  return NextResponse.json({ updated, errors });
}
