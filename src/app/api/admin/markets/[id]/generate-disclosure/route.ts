import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const market = await db.market.findUnique({
    where: { id },
    include: { company: true, earningsEvent: true },
  });

  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }

  const promptSetting = await db.setting.findUnique({
    where: { key: "resolutionPrompt" },
  });

  if (!promptSetting) {
    return NextResponse.json(
      { error: "Resolution prompt template not configured" },
      { status: 500 }
    );
  }

  if (!market.earningsEvent) {
    return NextResponse.json({ error: "Market has no earnings event" }, { status: 400 });
  }
  const reportDate = market.earningsEvent.reportDate.toISOString().split("T")[0];

  const prompt = promptSetting.value
    .replace(/\{question\}/g, market.question)
    .replace(/\{metricType\}/g, market.metricType)
    .replace(/\{thresholdLabel\}/g, market.thresholdLabel)
    .replace(/\{companyName\}/g, market.company.name)
    .replace(/\{reportDate\}/g, reportDate);

  const client = new Anthropic();

  const message = await client.messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const disclosure = textBlock ? textBlock.text : "";

  return NextResponse.json({ disclosure });
}
