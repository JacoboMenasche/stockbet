import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { placeOrder } from "@/lib/matching-engine";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { marketId } = await context.params;

  let body: { side: unknown; orderType: unknown; shares: unknown; price: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { side, orderType = "MARKET", shares, price } = body;

  if (side !== "YES" && side !== "NO") {
    return NextResponse.json({ error: "side must be YES or NO" }, { status: 400 });
  }
  if (orderType !== "MARKET" && orderType !== "LIMIT") {
    return NextResponse.json({ error: "orderType must be MARKET or LIMIT" }, { status: 400 });
  }
  if (!Number.isInteger(shares) || (shares as number) < 1) {
    return NextResponse.json({ error: "shares must be a positive integer" }, { status: 400 });
  }
  if (orderType === "LIMIT") {
    if (!Number.isInteger(price) || (price as number) < 1 || (price as number) > 99) {
      return NextResponse.json({ error: "limit price must be an integer 1–99" }, { status: 400 });
    }
  }

  try {
    const result = await placeOrder({
      userId: session.user.id,
      marketId,
      side: side as "YES" | "NO",
      action: "BUY",
      orderType: orderType as "MARKET" | "LIMIT",
      shares: shares as number,
      price: price as number | undefined,
    });

    const updatedUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { cashBalanceCents: true },
    });

    return NextResponse.json({
      ...result,
      newCashBalanceCents: Number(updatedUser?.cashBalanceCents ?? 0),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Order failed";
    const status =
      message === "Market not found" ? 404 :
      message === "Insufficient balance" ? 400 :
      message === "No liquidity available — try a limit order" ? 400 :
      message === "Market is not open for trading" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
