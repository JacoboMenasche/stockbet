"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";

interface CompanyWatchlistButtonProps {
  companyId: string;
  initialBookmarked: boolean;
}

export function CompanyWatchlistButton({
  companyId,
  initialBookmarked,
}: CompanyWatchlistButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const method = bookmarked ? "DELETE" : "POST";
    setBookmarked(!bookmarked);
    try {
      const res = await fetch(`/api/company-watchlist/${companyId}`, { method });
      if (!res.ok) throw new Error("Request failed");
    } catch {
      setBookmarked(bookmarked);
    }
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      title={bookmarked ? "Remove from watchlist" : "Add to watchlist"}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
      style={{
        backgroundColor: bookmarked
          ? "rgba(255,255,255,0.08)"
          : "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: bookmarked ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)",
      }}
    >
      <Bookmark
        className="h-3.5 w-3.5"
        fill={bookmarked ? "currentColor" : "none"}
      />
      {bookmarked ? "Saved" : "Watch"}
    </button>
  );
}
