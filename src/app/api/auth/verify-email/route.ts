import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/auth/signin?error=invalid-token", req.url)
    );
  }

  const record = await db.emailVerificationToken.findUnique({
    where: { token },
  });

  if (!record) {
    return NextResponse.redirect(
      new URL("/auth/signin?error=invalid-token", req.url)
    );
  }

  if (record.expires < new Date()) {
    await db.emailVerificationToken.delete({ where: { token } });
    return NextResponse.redirect(
      new URL("/auth/signin?error=invalid-token", req.url)
    );
  }

  await db.user.update({
    where: { id: record.userId },
    data: { emailVerified: new Date() },
  });

  await db.emailVerificationToken.delete({ where: { token } });

  return NextResponse.redirect(
    new URL("/auth/signin?verified=1", req.url)
  );
}
