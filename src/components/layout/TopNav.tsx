"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { TrendingUp, Wallet, LogIn, LogOut, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCents } from "@/lib/format";

const NAV_LINKS = [
  { href: "/markets" as const, label: "Markets" },
  { href: "/challenges" as const, label: "Challenges" },
  { href: "/leaderboard" as const, label: "Leaderboard" },
  { href: "/portfolio" as const, label: "Portfolio" },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.push("/markets");
    router.refresh();
  }

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur"
      style={{
        background:
          "linear-gradient(180deg, rgba(11,22,34,0.95) 0%, rgba(11,22,34,0.9) 100%)",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      <div className="app-container flex h-14 items-center gap-5">
        <Link href="/markets" className="flex items-center gap-2.5 shrink-0">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,194,168,0.95) 0%, rgba(0,157,136,0.95) 100%)",
            }}
          >
            <TrendingUp className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">Ratio Markets</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1.5 flex-1">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm transition-all",
                  isActive
                    ? "text-white font-medium shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]"
                    : "text-white/55 hover:text-white/90 hover:bg-white/5"
                )}
                style={
                  isActive
                    ? { backgroundColor: "rgba(255,255,255,0.07)" }
                    : undefined
                }
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {session ? (
          <div className="flex items-center gap-2.5 ml-auto">
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md text-sm tabular border"
              style={{
                backgroundColor: "rgba(0,194,168,0.11)",
                color: "var(--color-yes)",
                borderColor: "rgba(0,194,168,0.26)",
              }}
            >
              <Wallet className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium">{formatCents(session.user?.cashBalanceCents ?? 0)}</span>
            </div>
            <span className="text-sm hidden lg:block text-white/50 max-w-32 truncate">
              {session.user?.name ?? session.user?.email}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors hover:bg-white/5 text-white/45"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Link
            href="/auth/signin"
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--color-yes)", color: "#fff" }}
          >
            <LogIn className="h-3.5 w-3.5" />
            Sign in
            <ChevronRight className="h-3.5 w-3.5 opacity-80" />
          </Link>
        )}
      </div>
      <div className="md:hidden px-4 pb-2 flex gap-1.5 overflow-x-auto">
        {NAV_LINKS.map(({ href, label }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs whitespace-nowrap",
                isActive ? "text-white bg-white/10" : "text-white/55"
              )}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
