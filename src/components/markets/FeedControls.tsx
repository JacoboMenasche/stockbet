"use client";

import type { Route } from "next";
import { Search, SlidersHorizontal } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

export function FeedControls() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
          style={{ color: "rgba(255,255,255,0.34)" }}
        />
        <input
          type="text"
          placeholder="Search by ticker, company, or metric…"
          defaultValue={q}
          onChange={(e) => update("q", e.target.value)}
          className="w-full rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/35 focus:outline-none transition-colors"
          style={{
            backgroundColor: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.09)",
          }}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = "rgba(0,194,168,0.4)")
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")
          }
        />
      </div>

      {/* Sort */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-lg shrink-0"
        style={{
          backgroundColor: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.09)",
        }}
      >
        <SlidersHorizontal className="h-4 w-4 text-white/45 shrink-0" />
        <select
          value={sort}
          onChange={(e) => update("sort", e.target.value)}
          className="bg-transparent text-sm text-white/80 border-none outline-none cursor-pointer"
        >
          <option value="time" className="bg-[#0D1B2A]">
            Sort by time
          </option>
          <option value="volume" className="bg-[#0D1B2A]">
            Sort by volume
          </option>
        </select>
      </div>
    </div>
  );
}
