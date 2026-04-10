"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { TrendingUp, Wallet, LogIn, LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCents } from "@/lib/format";

const NAV_LINKS = [
  { href: "/markets" as const, label: "Markets" },
  { href: "/challenges" as const, label: "Challenges" },
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
      className="sticky top-0 z-50 flex h-14 items-center border-b px-6"
      style={{
        backgroundColor: "var(--color-brand-nav)",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      <Link href="/markets" className="flex items-center gap-2 mr-8 shrink-0">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md"
          style={{ backgroundColor: "var(--color-yes)" }}
        >
          <TrendingUp className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-sm font-semibold tracking-tight text-white">
          Ratio Markets
        </span>
      </Link>

      <nav className="flex items-center gap-1 flex-1">
        {NAV_LINKS.map(({ href, label }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm transition-colors",
                isActive
                  ? "text-white font-medium"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
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
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm tabular"
            style={{ backgroundColor: "rgba(0,194,168,0.1)", color: "var(--color-yes)" }}
          >
            <Wallet className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium">{formatCents(session.user?.cashBalanceCents ?? 0)}</span>
          </div>
          <span
            className="text-sm hidden sm:block"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            {session.user?.name ?? session.user?.email}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-white/5"
            style={{ color: "rgba(255,255,255,0.4)" }}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <Link
          href="/auth/signin"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
          style={{ backgroundColor: "var(--color-yes)", color: "#fff" }}
        >
          <LogIn className="h-3.5 w-3.5" />
          Sign in
        </Link>
      )}
    </header>
  );
}
