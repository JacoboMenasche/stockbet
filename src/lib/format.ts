/**
 * Format integer cents → "$1,234.56"
 */
export function formatCents(cents: number | bigint): string {
  const n = typeof cents === "bigint" ? Number(cents) : cents;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n / 100);
}

/**
 * Format a price in cents (1–99) as a probability percentage "64¢"
 */
export function formatPrice(cents: number): string {
  return `${cents}¢`;
}

/**
 * Format volume in cents as a compact dollar amount "~$284K"
 */
export function formatVolume(cents: number | bigint): string {
  const n = typeof cents === "bigint" ? Number(cents) : cents;
  const dollars = n / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${Math.round(dollars / 1_000)}K`;
  return `$${dollars.toFixed(0)}`;
}

/**
 * Days until a future date
 */
export function daysUntil(date: Date | string): number {
  const target = typeof date === "string" ? new Date(date) : date;
  const diff = target.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Format a date as "Apr 11, 2026"
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Clamp a number between min and max
 */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
