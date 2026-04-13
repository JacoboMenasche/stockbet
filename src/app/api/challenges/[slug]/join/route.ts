import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { joinChallenge } from "@/lib/challenges";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await context.params;

  try {
    await joinChallenge(slug, session.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message === "Challenge not found" ? 404
      : message === "Already joined this challenge" ? 409
      : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
