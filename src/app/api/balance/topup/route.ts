import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const TOP_UP_AMOUNT = BigInt(100_000); // $1,000 in cents
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { cashBalanceCents: true, lastTopUpAt: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const now = new Date();

  if (user.lastTopUpAt) {
    const elapsed = now.getTime() - user.lastTopUpAt.getTime();
    if (elapsed < COOLDOWN_MS) {
      const nextTopUpAt = new Date(user.lastTopUpAt.getTime() + COOLDOWN_MS);
      return NextResponse.json(
        { error: "Cooldown active", nextTopUpAt: nextTopUpAt.toISOString() },
        { status: 429 }
      );
    }
  }

  const updated = await db.user.update({
    where: { id: session.user.id },
    data: {
      cashBalanceCents: { increment: TOP_UP_AMOUNT },
      lastTopUpAt: now,
    },
    select: { cashBalanceCents: true },
  });

  const nextTopUpAt = new Date(now.getTime() + COOLDOWN_MS);

  return NextResponse.json({
    cashBalanceCents: Number(updated.cashBalanceCents),
    nextTopUpAt: nextTopUpAt.toISOString(),
  });
}
