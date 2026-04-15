# Markets Sidebar & Trending Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the TopNav navigation links with a persistent left sidebar (desktop) and bottom tab bar (mobile), and add a Trending section to the markets page showing markets sorted by total volume.

**Architecture:** A new `Sidebar` component (220px fixed, desktop only) and `BottomNav` component (fixed bottom, mobile only) are added to `layout.tsx`. The `TopNav` loses its nav links. The markets page gains a `?section=` param that switches between a new `TrendingView` (hero card + 2-col grid) and the existing list view.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS, CSS custom properties, next-auth/react (useSession), lucide-react icons, Prisma/db for queries.

---

## File Map

| File | Change |
|------|--------|
| `src/lib/queries/markets.ts` | Add `sort: "totalVolume"` option to `getMarketFeed` |
| `src/components/layout/Sidebar.tsx` | **Create** — desktop sidebar nav |
| `src/components/layout/BottomNav.tsx` | **Create** — mobile bottom tab bar |
| `src/components/markets/TrendingView.tsx` | **Create** — hero card + 2-col grid |
| `src/app/layout.tsx` | Add Sidebar + BottomNav, adjust main wrapper margin |
| `src/components/layout/TopNav.tsx` | Remove NAV_LINKS and nav element |
| `src/app/markets/page.tsx` | Add `section` param, render TrendingView or list |
| `src/app/globals.css` | Add `.sidebar-shell` and `.bottom-nav-spacer` utilities |

---

## Task 1: Add totalVolume sort to getMarketFeed

**Files:**
- Modify: `src/lib/queries/markets.ts`

- [ ] **Step 1: Update the `getMarketFeed` opts type and sort the grouped result**

Open `src/lib/queries/markets.ts`. The function currently accepts `sort: "time" | "volume"` (which sorts individual markets by `volume24h` before grouping). Add `"totalVolume"` which sorts the final grouped company array by their summed `totalVolume` descending.

Replace the entire file with:

```typescript
import { db } from "@/lib/db";
import { MarketStatus } from "@prisma/client";
import { isAfterMarketClose } from "@/lib/create-daily-markets";

export type MarketFeedCompany = Awaited<ReturnType<typeof getMarketFeed>>[number];

function nextTradingDay(from: Date): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2);
  if (day === 0) d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getMarketFeed(opts?: {
  q?: string;
  sort?: "time" | "volume" | "totalVolume";
}) {
  const { q = "", sort = "time" } = opts ?? {};

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = nextTradingDay(today);
  const displayDate = isAfterMarketClose() ? tomorrow : today;

  const markets = await db.market.findMany({
    where: {
      status: MarketStatus.OPEN,
      betDate: displayDate,
      ...(q
        ? {
            OR: [
              { company: { ticker: { contains: q, mode: "insensitive" } } },
              { company: { name: { contains: q, mode: "insensitive" } } },
              { question: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      company: true,
      probabilitySnaps: {
        orderBy: { recordedAt: "asc" },
        select: { probability: true },
      },
    },
    orderBy: sort === "volume" ? { volume24h: "desc" } : { createdAt: "asc" },
  });

  const grouped = new Map<
    string,
    {
      company: (typeof markets)[0]["company"];
      markets: typeof markets;
      totalVolume: bigint;
    }
  >();

  for (const m of markets) {
    const entry = grouped.get(m.companyId) ?? {
      company: m.company,
      markets: [],
      totalVolume: BigInt(0),
    };
    entry.markets.push(m);
    entry.totalVolume += BigInt(m.totalVolume);
    grouped.set(m.companyId, entry);
  }

  const result = Array.from(grouped.values()).map((g) => ({
    id: g.company.id,
    company: g.company,
    betDate: displayDate,
    totalVolume: g.totalVolume,
    markets: g.markets,
  }));

  if (sort === "totalVolume") {
    result.sort((a, b) =>
      a.totalVolume > b.totalVolume ? -1 : a.totalVolume < b.totalVolume ? 1 : 0
    );
  }

  return result;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/jacobomenasche/Desktop/stockbets
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `markets.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/queries/markets.ts
git commit -m "feat: add totalVolume sort option to getMarketFeed"
```

---

## Task 2: Create the Sidebar component

**Files:**
- Create: `src/components/layout/Sidebar.tsx`

The sidebar is a **client component** (needs `usePathname`, `useSearchParams`, `useSession`). It's 220px wide, fixed to the left side of the viewport, full height.

- [ ] **Step 1: Create `src/components/layout/Sidebar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  BarChart2,
  Trophy,
  Medal,
  Wallet,
  LogOut,
} from "lucide-react";
import { formatCents } from "@/lib/format";
import { ThemeToggle } from "./ThemeToggle";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: (pathname: string, section: string | null) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/markets?section=trending",
    label: "Trending",
    icon: <TrendingUp className="h-4 w-4" />,
    isActive: (p, s) => p === "/markets" && (s === "trending" || s === null),
  },
  {
    href: "/markets?section=all",
    label: "All Markets",
    icon: <BarChart2 className="h-4 w-4" />,
    isActive: (p, s) => p === "/markets" && s === "all",
  },
  {
    href: "/challenges",
    label: "Challenges",
    icon: <Trophy className="h-4 w-4" />,
    isActive: (p) => p.startsWith("/challenges"),
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    icon: <Medal className="h-4 w-4" />,
    isActive: (p) => p.startsWith("/leaderboard"),
  },
  {
    href: "/portfolio",
    label: "Portfolio",
    icon: <Wallet className="h-4 w-4" />,
    isActive: (p) => p.startsWith("/portfolio"),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const section = searchParams.get("section");
  const { data: session } = useSession();
  const router = useRouter();

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.push("/markets");
    router.refresh();
  }

  return (
    <aside
      className="hidden md:flex fixed left-0 top-0 h-screen w-[220px] flex-col z-40 border-r"
      style={{
        backgroundColor: "var(--color-brand-nav)",
        borderColor: "var(--color-border-soft)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b shrink-0" style={{ borderColor: "var(--color-border-soft)" }}>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md shrink-0"
          style={{
            background: "linear-gradient(180deg, rgba(148,228,132,0.95) 0%, rgba(110,200,95,0.95) 100%)",
          }}
        >
          <TrendingUp className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--color-text-main)" }}>
          Ratio Markets
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-y-auto">
        <p className="text-[10px] font-medium uppercase tracking-widest px-2 pt-1 pb-2" style={{ color: "var(--color-text-soft)" }}>
          Navigation
        </p>
        {NAV_ITEMS.map((item) => {
          const active = item.isActive(pathname, section);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={
                active
                  ? {
                      backgroundColor: "rgba(148,228,132,0.12)",
                      color: "var(--color-yes)",
                    }
                  : {
                      color: "var(--color-text-muted)",
                    }
              }
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-3 border-t space-y-2 shrink-0" style={{ borderColor: "var(--color-border-soft)" }}>
        {/* Balance */}
        {session && (
          <div
            className="rounded-lg px-3 py-2.5"
            style={{
              backgroundColor: "rgba(148,228,132,0.08)",
              border: "1px solid rgba(148,228,132,0.18)",
            }}
          >
            <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--color-text-soft)" }}>
              Balance
            </p>
            <p className="text-sm font-semibold tabular" style={{ color: "var(--color-yes)" }}>
              {formatCents(session.user?.cashBalanceCents ?? 0)}
            </p>
          </div>
        )}

        {/* Theme toggle + sign out */}
        <div className="flex items-center justify-between px-1">
          <ThemeToggle />
          {session && (
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: "var(--color-text-soft)" }}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: add Sidebar component for desktop navigation"
```

---

## Task 3: Create the BottomNav component

**Files:**
- Create: `src/components/layout/BottomNav.tsx`

The bottom nav is visible only on mobile (`md:hidden`). It shows 5 items with icons and short labels.

- [ ] **Step 1: Create `src/components/layout/BottomNav.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { TrendingUp, BarChart2, Trophy, Medal, Wallet } from "lucide-react";

interface BottomNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: (pathname: string, section: string | null) => boolean;
}

const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  {
    href: "/markets?section=trending",
    label: "Trending",
    icon: <TrendingUp className="h-5 w-5" />,
    isActive: (p, s) => p === "/markets" && (s === "trending" || s === null),
  },
  {
    href: "/markets?section=all",
    label: "Markets",
    icon: <BarChart2 className="h-5 w-5" />,
    isActive: (p, s) => p === "/markets" && s === "all",
  },
  {
    href: "/challenges",
    label: "Challenges",
    icon: <Trophy className="h-5 w-5" />,
    isActive: (p) => p.startsWith("/challenges"),
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    icon: <Medal className="h-5 w-5" />,
    isActive: (p) => p.startsWith("/leaderboard"),
  },
  {
    href: "/portfolio",
    label: "Portfolio",
    icon: <Wallet className="h-5 w-5" />,
    isActive: (p) => p.startsWith("/portfolio"),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const section = searchParams.get("section");

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center border-t"
      style={{
        backgroundColor: "var(--color-brand-nav)",
        borderColor: "var(--color-border-soft)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {BOTTOM_NAV_ITEMS.map((item) => {
        const active = item.isActive(pathname, section);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors"
            style={{
              color: active ? "var(--color-yes)" : "var(--color-text-soft)",
            }}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/BottomNav.tsx
git commit -m "feat: add BottomNav component for mobile navigation"
```

---

## Task 4: Update layout.tsx and globals.css

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

Wire up Sidebar and BottomNav in the root layout. The main content area needs left margin on desktop (to clear the sidebar) and bottom padding on mobile (to clear the bottom nav).

- [ ] **Step 1: Add sidebar layout CSS to `src/app/globals.css`**

Add these two rules at the end of `src/app/globals.css`:

```css
/* Sidebar layout: main content offset */
.sidebar-main {
  margin-left: 0;
  padding-bottom: 5rem; /* bottom nav clearance on mobile */
}

@media (min-width: 768px) {
  .sidebar-main {
    margin-left: 220px;
    padding-bottom: 0;
  }
}
```

- [ ] **Step 2: Update `src/app/layout.tsx`**

Replace the entire file with:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { TopNav } from "@/components/layout/TopNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { SessionProviderWrapper } from "@/components/auth/SessionProviderWrapper";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Ratio Markets — Prediction markets on financial statements",
  description:
    "Trade Yes/No contracts on earnings metrics — EPS beats, gross margin thresholds, revenue growth — that resolve when official filings publish.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="min-h-screen relative overflow-x-hidden"
        style={{ backgroundColor: "var(--color-brand)", color: "var(--color-text-main)" }}
      >
        <ThemeProvider attribute="data-theme" defaultTheme="dark" disableTransitionOnChange>
          {/* Ambient background blooms */}
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full" style={{ background: "var(--bloom-mint)", filter: "blur(140px)", opacity: 0.07 }} />
            <div className="absolute top-1/3 -right-48 w-[500px] h-[500px] rounded-full" style={{ background: "var(--bloom-coral)", filter: "blur(140px)", opacity: 0.06 }} />
            <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full" style={{ background: "var(--bloom-yellow)", filter: "blur(140px)", opacity: 0.04 }} />
          </div>

          <SessionProviderWrapper>
            {/* Desktop sidebar */}
            <Suspense>
              <Sidebar />
            </Suspense>

            {/* Main content shifted right on desktop */}
            <div className="sidebar-main">
              <TopNav />
              <main className="app-shell relative">{children}</main>
            </div>

            {/* Mobile bottom nav */}
            <Suspense>
              <BottomNav />
            </Suspense>
          </SessionProviderWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Start dev server and visually verify**

```bash
npm run dev
```

Open `http://localhost:3000/markets`. You should see:
- Desktop (>768px): sidebar on the left with 5 nav items, main content shifted right
- Mobile (<768px): no sidebar, bottom tab bar with 5 icons

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: wire Sidebar and BottomNav into root layout"
```

---

## Task 5: Simplify TopNav

**Files:**
- Modify: `src/components/layout/TopNav.tsx`

Remove the `NAV_LINKS` array and the `<nav>` element. The TopNav keeps only logo (mobile only — hidden on desktop since sidebar shows it), balance pill, theme toggle, sign-out.

- [ ] **Step 1: Replace `src/components/layout/TopNav.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { TrendingUp, Wallet, LogIn, LogOut, ChevronRight } from "lucide-react";
import { formatCents } from "@/lib/format";
import { ThemeToggle } from "./ThemeToggle";

export function TopNav() {
  const router = useRouter();
  const { data: session } = useSession();

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.push("/markets");
    router.refresh();
  }

  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-xl"
      style={{
        background: "var(--color-brand-nav)",
        borderColor: "var(--color-border-soft)",
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
            {/* Balance pill — hidden on mobile (sidebar shows it on desktop; tight on mobile) */}
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md text-sm tabular border"
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
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
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
```

- [ ] **Step 2: Verify dev server — nav links gone from top bar**

The header should now show only logo (mobile), theme toggle, balance, sign out. No Markets/Challenges/Leaderboard/Portfolio links in the top bar.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/TopNav.tsx
git commit -m "feat: simplify TopNav — remove nav links (sidebar handles navigation)"
```

---

## Task 6: Create TrendingView component

**Files:**
- Create: `src/components/markets/TrendingView.tsx`

`TrendingView` receives the already-sorted companies array (from `getMarketFeed` with `sort: "totalVolume"`). The first company becomes the hero card; the rest render as a 2-column grid.

- [ ] **Step 1: Create `src/components/markets/TrendingView.tsx`**

```tsx
import Link from "next/link";
import { Sparkline } from "./Sparkline";
import { YesNoPrice } from "./YesNoPrice";
import { formatVolume } from "@/lib/format";
import { metricLabel } from "@/lib/metricLabel";
import type { MarketFeedCompany } from "@/lib/queries/markets";

interface TrendingViewProps {
  companies: MarketFeedCompany[];
}

export function TrendingView({ companies }: TrendingViewProps) {
  if (companies.length === 0) {
    return (
      <div className="glass-card py-16 text-center">
        <p className="text-sm" style={{ color: "var(--color-text-soft)" }}>
          No open markets yet.
        </p>
      </div>
    );
  }

  const [hero, ...rest] = companies;
  // Use the highest-volume contract from the hero company as the featured market
  const heroMarket = hero.markets.reduce((best, m) =>
    BigInt(m.totalVolume) > BigInt(best.totalVolume) ? m : best
  );

  return (
    <div className="space-y-4">
      {/* Hero card */}
      <Link
        href={`/markets/${heroMarket.id}`}
        className="block glass-card p-5 hover:border-white/20 transition-colors group"
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="inline-flex items-center justify-center h-6 px-2 rounded text-xs font-semibold tracking-wider"
                style={{ backgroundColor: "var(--color-brand-surface-strong)", color: "var(--color-text-muted)" }}
              >
                {hero.company.ticker}
              </span>
              <span className="text-xs font-medium" style={{ color: "var(--color-yes)" }}>
                Trending #1
              </span>
            </div>
            <p className="text-base font-semibold leading-snug group-hover:opacity-80 transition-opacity" style={{ color: "var(--color-text-main)" }}>
              {heroMarket.question}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-soft)" }}>
              {metricLabel(heroMarket.metricType)} · {heroMarket.thresholdLabel} · Vol {formatVolume(hero.totalVolume)}
            </p>
          </div>
          <YesNoPrice
            yesPrice={heroMarket.yesPriceLatest}
            noPrice={heroMarket.noPriceLatest}
            className="shrink-0 w-32"
          />
        </div>
        <Sparkline data={heroMarket.probabilitySnaps} width={600} height={48} />
      </Link>

      {/* 2-col grid */}
      {rest.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rest.map((entry) => {
            const topMarket = entry.markets.reduce((best, m) =>
              BigInt(m.totalVolume) > BigInt(best.totalVolume) ? m : best
            );
            return (
              <Link
                key={entry.id}
                href={`/markets/${topMarket.id}`}
                className="glass-card p-4 hover:border-white/20 transition-colors group block"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="inline-flex items-center justify-center h-6 px-2 rounded text-xs font-semibold tracking-wider shrink-0"
                    style={{ backgroundColor: "var(--color-brand-surface-strong)", color: "var(--color-text-muted)" }}
                  >
                    {entry.company.ticker}
                  </span>
                  <span className="text-xs truncate" style={{ color: "var(--color-text-soft)" }}>
                    {entry.company.name}
                  </span>
                </div>
                <p className="text-sm font-medium leading-snug mb-3 line-clamp-2 group-hover:opacity-80 transition-opacity" style={{ color: "var(--color-text-main)" }}>
                  {topMarket.question}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <YesNoPrice
                    yesPrice={topMarket.yesPriceLatest}
                    noPrice={topMarket.noPriceLatest}
                    className="shrink-0"
                  />
                  <span className="text-xs tabular" style={{ color: "var(--color-text-soft)" }}>
                    {formatVolume(entry.totalVolume)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Check `Sparkline` component accepts `width` and `height` props**

Open `src/components/markets/Sparkline.tsx`. If it doesn't accept `width`/`height` props, the hero card sparkline will use default dimensions which is fine — remove `width={600} height={48}` from the `TrendingView` hero card `<Sparkline>` call if those props don't exist.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/markets/TrendingView.tsx
git commit -m "feat: add TrendingView component with hero card and 2-col grid"
```

---

## Task 7: Update markets/page.tsx to handle section param

**Files:**
- Modify: `src/app/markets/page.tsx`

Add the `section` search param. When `section=trending` (or no section), use `sort: "totalVolume"` and render `TrendingView`. When `section=all`, render the existing list.

- [ ] **Step 1: Replace `src/app/markets/page.tsx`**

```tsx
import { Suspense } from "react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getMarketFeed } from "@/lib/queries/markets";
import { MarketRow } from "@/components/markets/MarketRow";
import { FeedControls } from "@/components/markets/FeedControls";
import { TrendingView } from "@/components/markets/TrendingView";
import { metricLabel } from "@/lib/metricLabel";

interface PageProps {
  searchParams: Promise<{ q?: string; sort?: string; section?: string }>;
}

export const dynamic = "force-dynamic";

export default async function MarketsPage({ searchParams }: PageProps) {
  const { q, sort, section } = await searchParams;
  const session = await auth();

  const isTrending = !section || section === "trending";

  const [companies, bookmarkedCompanyIds] = await Promise.all([
    getMarketFeed({
      q: q ?? "",
      sort: isTrending ? "totalVolume" : sort === "volume" ? "volume" : "time",
    }),
    session?.user?.id
      ? db.companyWatchlist
          .findMany({
            where: { userId: session.user.id },
            select: { companyId: true },
          })
          .then((rows) => new Set(rows.map((r) => r.companyId)))
      : Promise.resolve(new Set<string>()),
  ]);

  return (
    <div className="app-container">
      <div className="page-header">
        <h1 className="page-title">
          {isTrending ? "Trending" : "All Markets"}
        </h1>
        <p className="page-subtitle">
          Daily stock price predictions — direction, targets, and volatility
        </p>
      </div>

      {isTrending ? (
        <>
          <Suspense>
            <FeedControls hideSort />
          </Suspense>
          <TrendingView companies={companies} />
        </>
      ) : (
        <>
          <Suspense>
            <FeedControls />
          </Suspense>
          {companies.length === 0 ? (
            <div className="glass-card py-16 text-center">
              <p className="text-sm" style={{ color: "var(--color-text-soft)" }}>
                {q ? `No markets matching "${q}"` : "No open markets yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {companies.map((entry) => (
                <MarketRow
                  key={entry.id}
                  ticker={entry.company.ticker}
                  companyName={entry.company.name}
                  companyId={session ? entry.company.id : undefined}
                  initialCompanyBookmarked={bookmarkedCompanyIds.has(entry.company.id)}
                  reportDate={entry.betDate}
                  totalVolume={entry.totalVolume}
                  contracts={entry.markets.map((m) => ({
                    marketId: m.id,
                    question: m.question,
                    metricLabel: metricLabel(m.metricType),
                    thresholdLabel: m.thresholdLabel,
                    yesPrice: m.yesPriceLatest,
                    noPrice: m.noPriceLatest,
                    volume24h: m.volume24h,
                    probabilitySnaps: m.probabilitySnaps,
                  }))}
                  defaultExpanded={true}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add `hideSort` prop to FeedControls**

Open `src/components/markets/FeedControls.tsx`. Add an optional `hideSort?: boolean` prop. When `hideSort` is true, don't render the sort dropdown. Change the function signature from:

```tsx
export function FeedControls() {
```

to:

```tsx
export function FeedControls({ hideSort = false }: { hideSort?: boolean }) {
```

And wrap the sort dropdown in:

```tsx
{!hideSort && (
  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg shrink-0" ...>
    ...sort dropdown...
  </div>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Smoke test in dev server**

Open `http://localhost:3000/markets` — should show Trending section (hero card + grid).
Open `http://localhost:3000/markets?section=all` — should show the existing list view.
Click sidebar items — active state should highlight correctly.
On mobile (resize browser to <768px) — sidebar should disappear, bottom tab bar should appear.

- [ ] **Step 5: Commit**

```bash
git add src/app/markets/page.tsx src/components/markets/FeedControls.tsx
git commit -m "feat: add section param to markets page, render TrendingView or list"
```

---

## Task 8: Deploy to Vercel

- [ ] **Step 1: Deploy**

```bash
npx vercel --prod
```

Expected: deployment URL printed, status `● Ready`.

- [ ] **Step 2: Smoke test production**

Open `https://stockbets.vercel.app/markets` — verify sidebar, trending view, and bottom nav on mobile all work as expected.

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: production tweaks after deploy"
```
