import { NextRequest, NextResponse } from "next/server";
import { createDailyMarkets } from "@/lib/create-daily-markets";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[cron] Starting daily market creation...");
    await createDailyMarkets();
    console.log("[cron] Market creation complete.");
    return NextResponse.json({ ok: true, job: "create-markets", ts: new Date().toISOString() });
  } catch (err) {
    console.error("[cron] Market creation failed:", err);
    return NextResponse.json({ error: "Market creation failed" }, { status: 500 });
  }
}
