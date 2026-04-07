"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { key: "earnings", label: "Earnings" },
  { key: "markets", label: "Markets" },
  { key: "resolve", label: "Resolve" },
  { key: "sync", label: "Sync" },
  { key: "settings", label: "Settings" },
] as const;

export function AdminTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("tab") ?? "earnings";

  return (
    <div
      className="flex gap-1 rounded-lg p-1 mb-6"
      style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
    >
      {TABS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => router.push(`/admin?tab=${key}`)}
          className={cn(
            "flex-1 py-2 rounded-md text-sm font-medium transition-all",
            active === key
              ? "text-white"
              : "text-white/40 hover:text-white/70"
          )}
          style={
            active === key
              ? { backgroundColor: "rgba(255,255,255,0.08)" }
              : undefined
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}
