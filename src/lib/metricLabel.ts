import { MetricType } from "@prisma/client";

export function metricLabel(type: MetricType): string {
  switch (type) {
    case MetricType.EPS:              return "Earnings per share";
    case MetricType.GROSS_MARGIN:     return "Gross margin";
    case MetricType.REVENUE_GROWTH:   return "Revenue growth";
    case MetricType.OPERATING_MARGIN: return "Operating margin";
    case MetricType.FREE_CASH_FLOW:   return "Free cash flow";
    case MetricType.ARPU:             return "ARPU";
    case MetricType.SUBSCRIBERS:      return "Subscribers";
  }
}
