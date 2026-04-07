import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { companyId, quarter, reportDate, releaseTime } = body;

  if (!companyId || !quarter || !reportDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const event = await db.earningsEvent.create({
    data: {
      companyId,
      quarter,
      reportDate: new Date(reportDate),
      releaseTime: releaseTime ?? "POST_MARKET",
      isConfirmed: true,
    },
    include: { company: true },
  });

  return NextResponse.json(event);
}
