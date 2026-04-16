// src/app/api/cron/close-markets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MarketStatus } from "@prisma/client";
import { cancelMarketOrders } from "@/lib/matching-engine";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[cron] Starting close-markets...");

    const now = new Date();

    const marketsToClose = await db.market.findMany({
      where: {
        status: MarketStatus.OPEN,
        earningsCloseAt: { lte: now },
      },
      select: { id: true },
    });

    console.log(`[cron] Found ${marketsToClose.length} markets to close`);

    let closed = 0;
    for (const { id } of marketsToClose) {
      try {
        // Cancel open orders first, then flip status
        await cancelMarketOrders(id);
        await db.market.update({
          where: { id },
          data: { status: MarketStatus.CLOSED },
        });
        closed++;
      } catch (err) {
        console.error(`[cron] Failed to close market ${id}:`, err);
      }
    }

    console.log(`[cron] close-markets complete. closed=${closed}`);
    return NextResponse.json({
      ok: true,
      job: "close-markets",
      ts: new Date().toISOString(),
      closed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[cron] close-markets failed:", message, stack);
    return NextResponse.json({ error: "close-markets failed", detail: message }, { status: 500 });
  }
}
