import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { submitPicks } from "@/lib/challenges";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { picks } = body as { picks?: unknown };
  if (!Array.isArray(picks) || picks.length === 0) {
    return NextResponse.json({ error: "picks must be a non-empty array" }, { status: 400 });
  }
  for (const p of picks) {
    if (typeof p.marketId !== "string" || (p.side !== "YES" && p.side !== "NO")) {
      return NextResponse.json(
        { error: "Each pick needs marketId (string) and side (YES|NO)" },
        { status: 400 }
      );
    }
  }

  try {
    await submitPicks(slug, session.user.id, picks as { marketId: string; side: "YES" | "NO" }[]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
