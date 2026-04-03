import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, generateVerificationToken } from "@/lib/auth-utils";
import { sendVerificationEmail } from "@/lib/resend";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, displayName } = body as {
      email: string;
      password: string;
      displayName: string;
    };

    if (!email || !password || !displayName) {
      return NextResponse.json(
        { error: "Email, password, and display name are required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);
    const token = generateVerificationToken();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await db.user.create({
      data: {
        email,
        displayName,
        password: hashedPassword,
        emailVerified: null,
        cashBalanceCents: BigInt(100_000),
      },
    });

    await db.emailVerificationToken.create({
      data: { userId: user.id, token, expires },
    });

    await sendVerificationEmail(email, token);

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[signup]", err);
    return NextResponse.json(
      { error: "Failed to create account. Please try again." },
      { status: 500 }
    );
  }
}
