// src/app/api/cron/sync-earnings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncEarningsForCompany } from "@/lib/sync-earnings";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[cron] Starting sync-earnings...");

    const companies = await db.company.findMany({
      select: { id: true, ticker: true },
    });

    let synced = 0;
    let failed = 0;

    for (const company of companies) {
      try {
        await syncEarningsForCompany(company.id, company.ticker);
        synced++;
      } catch (err) {
        console.error(`[cron] sync-earnings failed for ${company.ticker}:`, err);
        failed++;
      }
    }

    console.log(`[cron] sync-earnings complete. synced=${synced} failed=${failed}`);
    return NextResponse.json({
      ok: true,
      job: "sync-earnings",
      ts: new Date().toISOString(),
      synced,
      failed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[cron] sync-earnings failed:", message, stack);
    return NextResponse.json({ error: "sync-earnings failed", detail: message }, { status: 500 });
  }
}
