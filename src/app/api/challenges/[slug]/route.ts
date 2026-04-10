import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getChallengeDetail } from "@/lib/queries/challenges";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const session = await auth();
  const result = await getChallengeDetail(slug, session?.user?.id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result);
}
