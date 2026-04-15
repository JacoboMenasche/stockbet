import { NextRequest, NextResponse } from "next/server";
import { resolveAllOpenMarketsForToday } from "@/lib/resolve-markets";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[cron] Starting market resolution...");
    const stats = await resolveAllOpenMarketsForToday();
    console.log("[cron] Market resolution complete.", stats);
    return NextResponse.json({ ok: true, job: "resolve-markets", ts: new Date().toISOString(), ...stats });
  } catch (err) {
    console.error("[cron] Market resolution failed:", err);
    return NextResponse.json({ error: "Market resolution failed" }, { status: 500 });
  }
}
