// src/app/api/cron/resolve-fundamental-markets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { resolveFundamentalMarkets } from "@/lib/resolve-fundamental-markets";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[cron] Starting resolve-fundamental-markets...");
    const stats = await resolveFundamentalMarkets();
    console.log("[cron] resolve-fundamental-markets complete.", stats);
    return NextResponse.json({
      ok: true,
      job: "resolve-fundamental-markets",
      ts: new Date().toISOString(),
      ...stats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[cron] resolve-fundamental-markets failed:", message, stack);
    return NextResponse.json({ error: "resolve-fundamental-markets failed", detail: message }, { status: 500 });
  }
}
