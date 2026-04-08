import { ReleaseTime, MetricType, Side } from "@prisma/client";

export function mapReleaseTime(fmpTime: string): ReleaseTime {
  return fmpTime === "bmo" ? ReleaseTime.PRE_MARKET : ReleaseTime.POST_MARKET;
}

export function determineWinningSide(actual: number, threshold: number): Side {
  return actual > threshold ? Side.YES : Side.NO;
}

export function buildMarketQuestion(
  companyName: string,
  metric: MetricType,
  thresholdLabel: string
): string {
  switch (metric) {
    case MetricType.PRICE_DIRECTION:
      return `Will ${companyName} close higher than it opened today?`;
    case MetricType.PRICE_TARGET:
      return `Will ${companyName} close at or above ${thresholdLabel} today?`;
    case MetricType.PERCENTAGE_MOVE: {
      const pct = thresholdLabel.replace(/^>/, "").trim();
      return `Will ${companyName} move more than ${pct} today?`;
    }
  }
}
