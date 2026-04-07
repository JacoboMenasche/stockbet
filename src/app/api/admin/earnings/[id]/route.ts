import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.reportDate) data.reportDate = new Date(body.reportDate);
  if (body.releaseTime) data.releaseTime = body.releaseTime;

  const event = await db.earningsEvent.update({
    where: { id },
    data,
    include: { company: true },
  });

  return NextResponse.json(event);
}
