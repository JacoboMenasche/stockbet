"use client";

import type { Route } from "next";
import { Search, SlidersHorizontal } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback } from "react";

export function FeedControls({ hideSort = false }: { hideSort?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const surfaceBg = isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.03)";
  const surfaceBorder = isLight ? "rgba(0,0,0,0.09)" : "rgba(255,255,255,0.09)";
  const iconColor = isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.34)";

  const q = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") ?? "time";

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.replace(`${pathname}?${params.toString()}` as Route, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="glass-card p-3 mb-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      {/* Search */}
      <div className="flex-1 relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
          style={{ color: iconColor }}
        />
        <input
          type="text"
          placeholder="Search by ticker, company, or metric…"
          defaultValue={q}
          onChange={(e) => update("q", e.target.value)}
          className="w-full rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none transition-colors"
          style={{
            backgroundColor: surfaceBg,
            border: `1px solid ${surfaceBorder}`,
            color: "var(--color-text-main)",
          }}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = "rgba(148,228,132,0.5)")
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = surfaceBorder)
          }
        />
      </div>

      {/* Sort */}
      {!hideSort && (
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg shrink-0"
          style={{ backgroundColor: surfaceBg, border: `1px solid ${surfaceBorder}` }}
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" style={{ color: iconColor }} />
          <select
            value={sort}
            onChange={(e) => update("sort", e.target.value)}
            className="bg-transparent text-sm border-none outline-none cursor-pointer"
            style={{ color: "var(--color-text-muted)" }}
          >
            <option value="time" style={{ backgroundColor: "var(--color-brand)" }}>
              Sort by time
            </option>
            <option value="volume" style={{ backgroundColor: "var(--color-brand)" }}>
              Sort by volume
            </option>
          </select>
        </div>
      )}
    </div>
  );
}
