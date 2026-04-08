import { MetricType } from "@prisma/client";

export function metricLabel(type: MetricType): string {
  switch (type) {
    case MetricType.PRICE_DIRECTION:  return "Price direction";
    case MetricType.PRICE_TARGET:     return "Price target";
    case MetricType.PERCENTAGE_MOVE:  return "Percentage move";
  }
}
