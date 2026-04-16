import { MetricType } from "@prisma/client";

export function metricLabel(type: MetricType): string {
  switch (type) {
    case MetricType.PRICE_DIRECTION:  return "Price direction";
    case MetricType.PRICE_TARGET:     return "Price target";
    case MetricType.PERCENTAGE_MOVE:  return "Percentage move";
    case MetricType.EPS_BEAT:         return "EPS beat";
    case MetricType.REVENUE_BEAT:     return "Revenue beat";
    case MetricType.NET_INCOME_BEAT:  return "Net income beat";
    case MetricType.EBITDA_BEAT:      return "EBITDA beat";
  }
}
