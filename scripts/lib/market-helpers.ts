import { ReleaseTime, MetricType, Side } from "@prisma/client";

export function mapReleaseTime(fmpTime: string): ReleaseTime {
  return fmpTime === "bmo" ? ReleaseTime.PRE_MARKET : ReleaseTime.POST_MARKET;
}

export function determineWinningSide(actual: number, threshold: number): Side {
  return actual > threshold ? Side.YES : Side.NO;
}

const METRIC_LABELS: Record<MetricType, string> = {
  EPS: "EPS",
  GROSS_MARGIN: "gross margin",
  REVENUE_GROWTH: "revenue growth",
  OPERATING_MARGIN: "operating margin",
  FREE_CASH_FLOW: "free cash flow",
  ARPU: "ARPU",
  SUBSCRIBERS: "subscribers",
};

const METRIC_VERBS: Record<MetricType, string> = {
  EPS: "beat",
  GROSS_MARGIN: "exceed",
  REVENUE_GROWTH: "exceed",
  OPERATING_MARGIN: "exceed",
  FREE_CASH_FLOW: "exceed",
  ARPU: "exceed",
  SUBSCRIBERS: "exceed",
};

export function buildMarketQuestion(
  companyName: string,
  metric: MetricType,
  thresholdLabel: string
): string {
  const label = METRIC_LABELS[metric];
  const verb = METRIC_VERBS[metric];
  const value = thresholdLabel.replace(/^[>< ]+/, "").trim();
  return `Will ${companyName} ${label} ${verb} ${value}?`;
}
