import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ companyId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId } = await context.params;

  await db.companyWatchlist.upsert({
    where: { userId_companyId: { userId: session.user.id, companyId } },
    create: { userId: session.user.id, companyId },
    update: {},
  });

  return NextResponse.json({ bookmarked: true });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ companyId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId } = await context.params;

  await db.companyWatchlist.deleteMany({
    where: { userId: session.user.id, companyId },
  });

  return NextResponse.json({ bookmarked: false });
}
