import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { marketId } = await context.params;

  await db.watchlist.upsert({
    where: { userId_marketId: { userId: session.user.id, marketId } },
    create: { userId: session.user.id, marketId },
    update: {},
  });

  return NextResponse.json({ bookmarked: true });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { marketId } = await context.params;

  await db.watchlist.deleteMany({
    where: { userId: session.user.id, marketId },
  });

  return NextResponse.json({ bookmarked: false });
}
