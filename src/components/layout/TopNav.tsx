"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { TrendingUp, Wallet, LogIn, LogOut, ChevronRight } from "lucide-react";
import { formatCents } from "@/lib/format";
import { ThemeToggle } from "./ThemeToggle";

export function TopNav() {
  const router = useRouter();
  const { data: session } = useSession();
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    function onScroll() {
      const currentY = window.scrollY;
      // Always show at the very top
      if (currentY < 60) {
        setVisible(true);
      } else if (currentY > lastScrollY.current) {
        // Scrolling down — hide
        setVisible(false);
      } else {
        // Scrolling up — show
        setVisible(true);
      }
      lastScrollY.current = currentY;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.push("/markets");
    router.refresh();
  }

  return (
    <header
      className="topnav-fixed fixed top-0 right-0 left-0 z-50 border-b backdrop-blur-xl transition-transform duration-300"
      style={{
        background: "var(--color-brand-nav)",
        borderColor: "var(--color-border-soft)",
        transform: visible ? "translateY(0)" : "translateY(-100%)",
      }}
    >
      <div className="app-container flex h-14 items-center gap-4">
        {/* Logo — only visible on mobile (desktop shows it in sidebar) */}
        <Link href="/markets" className="flex md:hidden items-center gap-2.5 shrink-0">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md"
            style={{
              background: "linear-gradient(180deg, rgba(148,228,132,0.95) 0%, rgba(110,200,95,0.95) 100%)",
            }}
          >
            <TrendingUp className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--color-text-main)" }}>
            Ratio Markets
          </span>
        </Link>

        <div className="flex-1" />

        <ThemeToggle />

        {session ? (
          <div className="flex items-center gap-2.5">
            {/* Balance pill — shown in sm–md range only; sidebar shows it on desktop */}
            <div
              className="hidden sm:flex md:hidden items-center gap-2 px-3 py-1.5 rounded-md text-sm tabular border"
              style={{
                backgroundColor: "rgba(148,228,132,0.11)",
                color: "var(--color-yes)",
                borderColor: "rgba(148,228,132,0.26)",
              }}
            >
              <Wallet className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium">{formatCents(session.user?.cashBalanceCents ?? 0)}</span>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: "var(--color-text-soft)" }}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Link
            href="/auth/signin"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--color-yes)", color: "#fff" }}
          >
            <LogIn className="h-3.5 w-3.5" />
            Sign in
            <ChevronRight className="h-3.5 w-3.5 opacity-80" />
          </Link>
        )}
      </div>
    </header>
  );
}
