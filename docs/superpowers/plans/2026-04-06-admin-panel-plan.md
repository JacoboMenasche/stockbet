# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a protected admin panel for managing earnings events, markets, manual resolution with payouts, and FMP sync.

**Architecture:** A single `/admin` page with 4 tabs (Earnings, Markets, Resolve, Sync), protected by email allowlist. Six API routes under `/api/admin/` handle CRUD and actions. Client components manage forms and optimistic updates. The resolve endpoint reuses the same payout transaction pattern as the CLI resolve script.

**Tech Stack:** Next.js 15 App Router, Prisma 5, NextAuth v5, Lucide React

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/lib/admin.ts` | Create | Admin email check helper |
| `src/app/api/admin/earnings/route.ts` | Create | POST create earnings event |
| `src/app/api/admin/earnings/[id]/route.ts` | Create | PATCH update earnings event |
| `src/app/api/admin/markets/route.ts` | Create | POST create market |
| `src/app/api/admin/markets/[id]/route.ts` | Create | PATCH update market |
| `src/app/api/admin/resolve/[marketId]/route.ts` | Create | POST resolve market + payout |
| `src/app/api/admin/sync/route.ts` | Create | POST run FMP sync |
| `src/app/admin/page.tsx` | Create | Admin page server component |
| `src/components/admin/AdminTabs.tsx` | Create | Tab navigation |
| `src/components/admin/EarningsPanel.tsx` | Create | Earnings CRUD UI |
| `src/components/admin/MarketsPanel.tsx` | Create | Markets CRUD UI |
| `src/components/admin/ResolvePanel.tsx` | Create | Manual resolve UI |
| `src/components/admin/SyncPanel.tsx` | Create | FMP sync trigger UI |

---

### Task 1: Admin helper

**Files:**
- Create: `src/lib/admin.ts`

- [ ] **Step 1: Create the file**

```typescript
import { Session } from "next-auth";

const ADMIN_EMAILS = ["jmenasche1214@gmail.com"];

export function isAdmin(session: Session | null): boolean {
  return !!session?.user?.email && ADMIN_EMAILS.includes(session.user.email);
}
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/jmena/Desktop/stockbet && git add src/lib/admin.ts && git commit -m "feat: admin email check helper"
```

---

### Task 2: Earnings API routes

**Files:**
- Create: `src/app/api/admin/earnings/route.ts`
- Create: `src/app/api/admin/earnings/[id]/route.ts`

- [ ] **Step 1: Create directories**

```bash
cd /c/Users/jmena/Desktop/stockbet && mkdir -p src/app/api/admin/earnings/\[id\]
```

- [ ] **Step 2: Create POST route for creating earnings events**

File: `src/app/api/admin/earnings/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { companyId, quarter, reportDate, releaseTime } = body;

  if (!companyId || !quarter || !reportDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const event = await db.earningsEvent.create({
    data: {
      companyId,
      quarter,
      reportDate: new Date(reportDate),
      releaseTime: releaseTime ?? "POST_MARKET",
      isConfirmed: true,
    },
    include: { company: true },
  });

  return NextResponse.json(event);
}
```

- [ ] **Step 3: Create PATCH route for updating earnings events**

File: `src/app/api/admin/earnings/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.reportDate) data.reportDate = new Date(body.reportDate);
  if (body.releaseTime) data.releaseTime = body.releaseTime;

  const event = await db.earningsEvent.update({
    where: { id },
    data,
    include: { company: true },
  });

  return NextResponse.json(event);
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd /c/Users/jmena/Desktop/stockbet && npx tsc --noEmit 2>&1 | grep "admin/earnings" || echo "No errors"
```

- [ ] **Step 5: Commit**

```bash
cd /c/Users/jmena/Desktop/stockbet && git add src/app/api/admin/earnings/ && git commit -m "feat: admin earnings API routes (POST + PATCH)"
```

---

### Task 3: Markets API routes

**Files:**
- Create: `src/app/api/admin/markets/route.ts`
- Create: `src/app/api/admin/markets/[id]/route.ts`

- [ ] **Step 1: Create directories**

```bash
cd /c/Users/jmena/Desktop/stockbet && mkdir -p src/app/api/admin/markets/\[id\]
```

- [ ] **Step 2: Create POST route for creating markets**

File: `src/app/api/admin/markets/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { companyId, earningsEventId, question, metricType, threshold, thresholdLabel, consensusEstimate } = body;

  if (!companyId || !earningsEventId || !question || !metricType || threshold === undefined || !thresholdLabel) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const market = await db.market.create({
    data: {
      companyId,
      earningsEventId,
      question,
      metricType,
      threshold,
      thresholdLabel,
      consensusEstimate: consensusEstimate ?? null,
      status: "OPEN",
      yesPriceLatest: 50,
      noPriceLatest: 50,
    },
    include: { company: true, earningsEvent: true },
  });

  return NextResponse.json(market);
}
```

- [ ] **Step 3: Create PATCH route for updating markets**

File: `src/app/api/admin/markets/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.question !== undefined) data.question = body.question;
  if (body.threshold !== undefined) data.threshold = body.threshold;
  if (body.thresholdLabel !== undefined) data.thresholdLabel = body.thresholdLabel;
  if (body.yesPriceLatest !== undefined) data.yesPriceLatest = body.yesPriceLatest;
  if (body.noPriceLatest !== undefined) data.noPriceLatest = body.noPriceLatest;
  if (body.consensusEstimate !== undefined) data.consensusEstimate = body.consensusEstimate;

  const market = await db.market.update({
    where: { id },
    data,
    include: { company: true },
  });

  return NextResponse.json(market);
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd /c/Users/jmena/Desktop/stockbet && npx tsc --noEmit 2>&1 | grep "admin/markets" || echo "No errors"
```

- [ ] **Step 5: Commit**

```bash
cd /c/Users/jmena/Desktop/stockbet && git add src/app/api/admin/markets/ && git commit -m "feat: admin markets API routes (POST + PATCH)"
```

---

### Task 4: Resolve API route

**Files:**
- Create: `src/app/api/admin/resolve/[marketId]/route.ts`

- [ ] **Step 1: Create directory**

```bash
cd /c/Users/jmena/Desktop/stockbet && mkdir -p src/app/api/admin/resolve/\[marketId\]
```

- [ ] **Step 2: Create the resolve + payout route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { marketId } = await context.params;
  const body = await req.json();
  const { actualValue, actualLabel, winningSide } = body;

  if (actualValue === undefined || !actualLabel || !winningSide) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (winningSide !== "YES" && winningSide !== "NO") {
    return NextResponse.json({ error: "winningSide must be YES or NO" }, { status: 400 });
  }

  const market = await db.market.findUnique({ where: { id: marketId } });
  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }
  if (market.status === "RESOLVED") {
    return NextResponse.json({ error: "Market already resolved" }, { status: 400 });
  }

  const result = await db.$transaction(async (tx) => {
    const resolution = await tx.resolution.create({
      data: {
        marketId,
        actualValue,
        actualLabel,
        winningSide,
        sourceFiling: "admin-manual-resolution",
      },
    });

    await tx.market.update({
      where: { id: marketId },
      data: { status: "RESOLVED" },
    });

    const positions = await tx.position.findMany({
      where: { marketId },
    });

    for (const position of positions) {
      const won = position.side === winningSide;
      const totalCost = position.shares * position.avgCostCents;

      if (won) {
        const payout = position.shares * 100;
        const realizedPL = payout - totalCost;

        await tx.user.update({
          where: { id: position.userId },
          data: { cashBalanceCents: { increment: BigInt(payout) } },
        });

        await tx.position.update({
          where: { id: position.id },
          data: { realizedPL, currentPrice: 100, unrealizedPL: 0 },
        });
      } else {
        const realizedPL = -totalCost;

        await tx.position.update({
          where: { id: position.id },
          data: { realizedPL, currentPrice: 0, unrealizedPL: 0 },
        });
      }
    }

    await tx.resolution.update({
      where: { id: resolution.id },
      data: { payoutsIssuedAt: new Date() },
    });

    return { resolution, settledPositions: positions.length };
  });

  return NextResponse.json(result);
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /c/Users/jmena/Desktop/stockbet && npx tsc --noEmit 2>&1 | grep "admin/resolve" || echo "No errors"
```

- [ ] **Step 4: Commit**

```bash
cd /c/Users/jmena/Desktop/stockbet && git add src/app/api/admin/resolve/ && git commit -m "feat: admin resolve API with payout transaction"
```

---

### Task 5: Sync API route

**Files:**
- Create: `src/app/api/admin/sync/route.ts`

- [ ] **Step 1: Create directory**

```bash
cd /c/Users/jmena/Desktop/stockbet && mkdir -p src/app/api/admin/sync
```

- [ ] **Step 2: Create the sync route**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { fetchHistoricalPrices } from "@/lib/fmp";

export async function POST() {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const companies = await db.company.findMany({ select: { id: true, ticker: true } });
  const updated: string[] = [];
  const errors: string[] = [];

  for (const company of companies) {
    try {
      const prices = await fetchHistoricalPrices(company.ticker, 90);
      for (const p of prices) {
        await db.stockPriceCache.upsert({
          where: { companyId_date: { companyId: company.id, date: new Date(p.date) } },
          update: { close: p.close },
          create: {
            companyId: company.id,
            date: new Date(p.date),
            open: 0,
            high: 0,
            low: 0,
            close: p.close,
            volume: 0,
          },
        });
      }
      updated.push(company.ticker);
    } catch {
      errors.push(company.ticker);
    }
  }

  return NextResponse.json({ updated, errors });
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /c/Users/jmena/Desktop/stockbet && npx tsc --noEmit 2>&1 | grep "admin/sync" || echo "No errors"
```

- [ ] **Step 4: Commit**

```bash
cd /c/Users/jmena/Desktop/stockbet && git add src/app/api/admin/sync/ && git commit -m "feat: admin sync API refreshes stock prices from FMP"
```

---

### Task 6: Admin page + tabs

**Files:**
- Create: `src/app/admin/page.tsx`
- Create: `src/components/admin/AdminTabs.tsx`

- [ ] **Step 1: Create AdminTabs component**

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { key: "earnings", label: "Earnings" },
  { key: "markets", label: "Markets" },
  { key: "resolve", label: "Resolve" },
  { key: "sync", label: "Sync" },
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
```

- [ ] **Step 2: Create admin page**

```tsx
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { EarningsPanel } from "@/components/admin/EarningsPanel";
import { MarketsPanel } from "@/components/admin/MarketsPanel";
import { ResolvePanel } from "@/components/admin/ResolvePanel";
import { SyncPanel } from "@/components/admin/SyncPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!isAdmin(session)) redirect("/");

  const { tab = "earnings" } = await searchParams;

  const companies = await db.company.findMany({
    select: { id: true, ticker: true, name: true },
    orderBy: { ticker: "asc" },
  });

  const earnings = tab === "earnings" || tab === "markets" || tab === "resolve"
    ? await db.earningsEvent.findMany({
        include: { company: true, _count: { select: { markets: true } } },
        orderBy: { reportDate: "asc" },
      })
    : null;

  const markets = tab === "markets" || tab === "resolve"
    ? await db.market.findMany({
        where: tab === "resolve" ? { status: { in: ["OPEN", "CLOSED"] } } : { status: "OPEN" },
        include: { company: true, earningsEvent: true },
        orderBy: { createdAt: "desc" },
      })
    : null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-white mb-2">Admin</h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          Manage earnings, markets, and resolutions
        </p>
      </div>

      <Suspense>
        <AdminTabs />
      </Suspense>

      {tab === "earnings" && earnings && (
        <EarningsPanel earnings={earnings} companies={companies} />
      )}
      {tab === "markets" && earnings && markets && (
        <MarketsPanel markets={markets} earnings={earnings} companies={companies} />
      )}
      {tab === "resolve" && markets && (
        <ResolvePanel markets={markets} />
      )}
      {tab === "sync" && <SyncPanel />}
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /c/Users/jmena/Desktop/stockbet && npx tsc --noEmit 2>&1 | grep "admin" || echo "No errors"
```

Note: this will show errors for the panel components that don't exist yet. That's expected — they'll be created in Tasks 7-10.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/jmena/Desktop/stockbet && git add src/app/admin/ src/components/admin/AdminTabs.tsx && git commit -m "feat: admin page with tabs"
```

---

### Task 7: EarningsPanel

**Files:**
- Create: `src/components/admin/EarningsPanel.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";

interface EarningsEvent {
  id: string;
  quarter: string;
  reportDate: string;
  releaseTime: string;
  company: { id: string; ticker: string; name: string };
  _count: { markets: number };
}

interface Company {
  id: string;
  ticker: string;
  name: string;
}

interface EarningsPanelProps {
  earnings: EarningsEvent[];
  companies: Company[];
}

export function EarningsPanel({ earnings, companies }: EarningsPanelProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("POST_MARKET");
  const [showCreate, setShowCreate] = useState(false);
  const [newCompanyId, setNewCompanyId] = useState("");
  const [newQuarter, setNewQuarter] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("POST_MARKET");
  const [loading, setLoading] = useState(false);

  async function handleUpdate(id: string) {
    setLoading(true);
    await fetch(`/api/admin/earnings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportDate: editDate, releaseTime: editTime }),
    });
    setEditingId(null);
    setLoading(false);
    router.refresh();
  }

  async function handleCreate() {
    if (!newCompanyId || !newQuarter || !newDate) return;
    setLoading(true);
    await fetch("/api/admin/earnings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: newCompanyId,
        quarter: newQuarter,
        reportDate: newDate,
        releaseTime: newTime,
      }),
    });
    setShowCreate(false);
    setNewCompanyId("");
    setNewQuarter("");
    setNewDate("");
    setLoading(false);
    router.refresh();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
          Earnings Events
        </h2>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
        >
          {showCreate ? "Cancel" : "Add Earnings"}
        </button>
      </div>

      {showCreate && (
        <div
          className="rounded-xl border p-4 mb-4 space-y-3"
          style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}
        >
          <div className="grid grid-cols-2 gap-3">
            <select
              value={newCompanyId}
              onChange={(e) => setNewCompanyId(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <option value="">Select company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.ticker} — {c.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Quarter (e.g. Q2-2026)"
              value={newQuarter}
              onChange={(e) => setNewQuarter(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
            <select
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <option value="POST_MARKET">Post-market</option>
              <option value="PRE_MARKET">Pre-market</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-xs font-medium disabled:opacity-40"
            style={{ backgroundColor: "rgba(167,139,250,0.2)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
          >
            Create
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Ticker", "Quarter", "Report Date", "Release", "Markets", ""].map((h) => (
                <th key={h} className="pb-3 text-left font-normal" style={{ color: "rgba(255,255,255,0.35)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {earnings.map((e) => (
              <tr key={e.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <td className="py-3 pr-4 text-white font-medium">{e.company.ticker}</td>
                <td className="py-3 pr-4" style={{ color: "rgba(255,255,255,0.5)" }}>{e.quarter}</td>
                <td className="py-3 pr-4">
                  {editingId === e.id ? (
                    <input
                      type="date"
                      value={editDate}
                      onChange={(ev) => setEditDate(ev.target.value)}
                      className="rounded px-2 py-1 text-xs text-white outline-none"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  ) : (
                    <span className="text-white">{formatDate(new Date(e.reportDate))}</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  {editingId === e.id ? (
                    <select
                      value={editTime}
                      onChange={(ev) => setEditTime(ev.target.value)}
                      className="rounded px-2 py-1 text-xs text-white outline-none"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      <option value="POST_MARKET">Post</option>
                      <option value="PRE_MARKET">Pre</option>
                    </select>
                  ) : (
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>
                      {e.releaseTime === "PRE_MARKET" ? "Pre" : "Post"}
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4 tabular" style={{ color: "rgba(255,255,255,0.5)" }}>{e._count.markets}</td>
                <td className="py-3 text-right">
                  {editingId === e.id ? (
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => handleUpdate(e.id)}
                        disabled={loading}
                        className="px-2 py-1 rounded text-xs font-medium disabled:opacity-40"
                        style={{ backgroundColor: "rgba(74,222,128,0.15)", color: "#4ade80" }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{ color: "rgba(255,255,255,0.4)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(e.id);
                        setEditDate(new Date(e.reportDate).toISOString().slice(0, 10));
                        setEditTime(e.releaseTime);
                      }}
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/jmena/Desktop/stockbet && git add src/components/admin/EarningsPanel.tsx && git commit -m "feat: EarningsPanel with create and inline edit"
```

---

### Task 8: MarketsPanel

**Files:**
- Create: `src/components/admin/MarketsPanel.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Market {
  id: string;
  question: string;
  metricType: string;
  threshold: string | number;
  thresholdLabel: string;
  yesPriceLatest: number;
  noPriceLatest: number;
  company: { ticker: string };
  earningsEvent: { id: string; quarter: string };
}

interface EarningsEvent {
  id: string;
  quarter: string;
  company: { id: string; ticker: string; name: string };
}

interface Company {
  id: string;
  ticker: string;
  name: string;
}

interface MarketsPanelProps {
  markets: Market[];
  earnings: EarningsEvent[];
  companies: Company[];
}

const METRIC_TYPES = ["EPS", "GROSS_MARGIN", "REVENUE_GROWTH", "OPERATING_MARGIN", "FREE_CASH_FLOW", "ARPU", "SUBSCRIBERS"];

export function MarketsPanel({ markets, earnings, companies }: MarketsPanelProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editThreshold, setEditThreshold] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newEventId, setNewEventId] = useState("");
  const [newMetric, setNewMetric] = useState("EPS");
  const [newThreshold, setNewThreshold] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUpdate(id: string) {
    setLoading(true);
    await fetch(`/api/admin/markets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: editQuestion,
        threshold: parseFloat(editThreshold),
        thresholdLabel: editLabel,
      }),
    });
    setEditingId(null);
    setLoading(false);
    router.refresh();
  }

  async function handleCreate() {
    if (!newEventId || !newQuestion || !newThreshold || !newLabel) return;
    const event = earnings.find((e) => e.id === newEventId);
    if (!event) return;
    setLoading(true);
    await fetch("/api/admin/markets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: event.company.id,
        earningsEventId: newEventId,
        question: newQuestion,
        metricType: newMetric,
        threshold: parseFloat(newThreshold),
        thresholdLabel: newLabel,
      }),
    });
    setShowCreate(false);
    setNewEventId("");
    setNewQuestion("");
    setNewThreshold("");
    setNewLabel("");
    setLoading(false);
    router.refresh();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
          Open Markets
        </h2>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
        >
          {showCreate ? "Cancel" : "Create Market"}
        </button>
      </div>

      {showCreate && (
        <div
          className="rounded-xl border p-4 mb-4 space-y-3"
          style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}
        >
          <div className="grid grid-cols-2 gap-3">
            <select
              value={newEventId}
              onChange={(e) => setNewEventId(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <option value="">Select earnings event</option>
              {earnings.map((e) => (
                <option key={e.id} value={e.id}>{e.company.ticker} — {e.quarter}</option>
              ))}
            </select>
            <select
              value={newMetric}
              onChange={(e) => setNewMetric(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              {METRIC_TYPES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Threshold (e.g. 47.3)"
              value={newThreshold}
              onChange={(e) => setNewThreshold(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
            <input
              type="text"
              placeholder="Label (e.g. > 47.3%)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>
          <input
            type="text"
            placeholder="Question (e.g. Will AAPL gross margin exceed 47.3%?)"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-xs font-medium disabled:opacity-40"
            style={{ backgroundColor: "rgba(167,139,250,0.2)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
          >
            Create
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Ticker", "Metric", "Question", "Threshold", "YES/NO", ""].map((h) => (
                <th key={h} className="pb-3 text-left font-normal" style={{ color: "rgba(255,255,255,0.35)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {markets.map((m) => (
              <tr key={m.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <td className="py-3 pr-4 text-white font-medium">{m.company.ticker}</td>
                <td className="py-3 pr-4" style={{ color: "rgba(255,255,255,0.5)" }}>{m.metricType}</td>
                <td className="py-3 pr-4">
                  {editingId === m.id ? (
                    <input
                      type="text"
                      value={editQuestion}
                      onChange={(e) => setEditQuestion(e.target.value)}
                      className="rounded px-2 py-1 text-xs text-white outline-none w-full"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  ) : (
                    <span className="text-white line-clamp-1 max-w-xs block">{m.question}</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  {editingId === m.id ? (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={editThreshold}
                        onChange={(e) => setEditThreshold(e.target.value)}
                        className="rounded px-2 py-1 text-xs text-white outline-none w-16"
                        style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="rounded px-2 py-1 text-xs text-white outline-none w-20"
                        style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                    </div>
                  ) : (
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>{m.thresholdLabel}</span>
                  )}
                </td>
                <td className="py-3 pr-4 tabular">
                  <span style={{ color: "var(--color-yes)" }}>{m.yesPriceLatest}</span>
                  <span style={{ color: "rgba(255,255,255,0.2)" }}> / </span>
                  <span style={{ color: "var(--color-no)" }}>{m.noPriceLatest}</span>
                </td>
                <td className="py-3 text-right">
                  {editingId === m.id ? (
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => handleUpdate(m.id)}
                        disabled={loading}
                        className="px-2 py-1 rounded text-xs font-medium disabled:opacity-40"
                        style={{ backgroundColor: "rgba(74,222,128,0.15)", color: "#4ade80" }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{ color: "rgba(255,255,255,0.4)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(m.id);
                        setEditQuestion(m.question);
                        setEditThreshold(String(m.threshold));
                        setEditLabel(m.thresholdLabel);
                      }}
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/jmena/Desktop/stockbet && git add src/components/admin/MarketsPanel.tsx && git commit -m "feat: MarketsPanel with create and inline edit"
```

---

### Task 9: ResolvePanel

**Files:**
- Create: `src/components/admin/ResolvePanel.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Market {
  id: string;
  question: string;
  metricType: string;
  thresholdLabel: string;
  yesPriceLatest: number;
  noPriceLatest: number;
  status: string;
  company: { ticker: string };
}

interface ResolvePanelProps {
  markets: Market[];
}

export function ResolvePanel({ markets }: ResolvePanelProps) {
  const router = useRouter();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [actualValue, setActualValue] = useState("");
  const [actualLabel, setActualLabel] = useState("");
  const [winningSide, setWinningSide] = useState<"YES" | "NO">("YES");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleResolve(marketId: string) {
    if (!actualValue || !actualLabel) return;
    setLoading(true);
    setResult(null);
    const res = await fetch(`/api/admin/resolve/${marketId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actualValue: parseFloat(actualValue),
        actualLabel,
        winningSide,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setResult(`Resolved! ${data.settledPositions} positions settled.`);
      setResolvingId(null);
      setActualValue("");
      setActualLabel("");
      router.refresh();
    } else {
      setResult(`Error: ${data.error}`);
    }
  }

  if (markets.length === 0) {
    return (
      <p className="text-sm py-12 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
        No markets ready to resolve.
      </p>
    );
  }

  return (
    <div>
      <h2 className="text-sm font-medium mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
        Markets to Resolve
      </h2>

      {result && (
        <div
          className="rounded-lg px-4 py-2 mb-4 text-sm"
          style={{
            backgroundColor: result.startsWith("Error") ? "rgba(248,113,113,0.1)" : "rgba(74,222,128,0.1)",
            color: result.startsWith("Error") ? "#f87171" : "#4ade80",
          }}
        >
          {result}
        </div>
      )}

      <div className="space-y-3">
        {markets.map((m) => (
          <div
            key={m.id}
            className="rounded-xl border p-4"
            style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-white font-medium">{m.company.ticker}</span>
                <span className="text-xs ml-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {m.metricType} · {m.thresholdLabel}
                </span>
              </div>
              <div className="tabular text-sm">
                <span style={{ color: "var(--color-yes)" }}>{m.yesPriceLatest}¢</span>
                <span style={{ color: "rgba(255,255,255,0.2)" }}> / </span>
                <span style={{ color: "var(--color-no)" }}>{m.noPriceLatest}¢</span>
              </div>
            </div>
            <p className="text-sm text-white/70 mb-3">{m.question}</p>

            {resolvingId === m.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Actual value (e.g. 48.5)"
                    value={actualValue}
                    onChange={(e) => setActualValue(e.target.value)}
                    className="rounded-lg px-3 py-2 text-sm text-white outline-none"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                  <input
                    type="text"
                    placeholder="Label (e.g. 48.5%)"
                    value={actualLabel}
                    onChange={(e) => setActualLabel(e.target.value)}
                    className="rounded-lg px-3 py-2 text-sm text-white outline-none"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                  <select
                    value={winningSide}
                    onChange={(e) => setWinningSide(e.target.value as "YES" | "NO")}
                    className="rounded-lg px-3 py-2 text-sm text-white outline-none"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <option value="YES">YES wins</option>
                    <option value="NO">NO wins</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleResolve(m.id)}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg text-xs font-medium disabled:opacity-40"
                    style={{ backgroundColor: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}
                  >
                    {loading ? "Resolving…" : "Resolve & Pay Out"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolvingId(null)}
                    className="px-4 py-2 rounded-lg text-xs font-medium"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setResolvingId(m.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
              >
                Resolve
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/jmena/Desktop/stockbet && git add src/components/admin/ResolvePanel.tsx && git commit -m "feat: ResolvePanel with manual resolve and payout"
```

---

### Task 10: SyncPanel

**Files:**
- Create: `src/components/admin/SyncPanel.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState } from "react";

export function SyncPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ updated: string[]; errors: string[] } | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/admin/sync", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setResult(data);
    }
  }

  return (
    <div>
      <h2 className="text-sm font-medium mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
        FMP Data Sync
      </h2>

      <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
        Refreshes stock prices for all companies from Financial Modeling Prep API.
      </p>

      <button
        type="button"
        onClick={handleSync}
        disabled={loading}
        className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
        style={{ backgroundColor: "rgba(167,139,250,0.2)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
      >
        {loading ? "Syncing…" : "Run Full Sync"}
      </button>

      {result && (
        <div className="mt-4 space-y-2">
          {result.updated.length > 0 && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{ backgroundColor: "rgba(74,222,128,0.1)", color: "#4ade80" }}
            >
              Updated {result.updated.length} companies: {result.updated.join(", ")}
            </div>
          )}
          {result.errors.length > 0 && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{ backgroundColor: "rgba(248,113,113,0.1)", color: "#f87171" }}
            >
              Errors for: {result.errors.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/jmena/Desktop/stockbet && git add src/components/admin/SyncPanel.tsx && git commit -m "feat: SyncPanel triggers FMP sync"
```

---

### Task 11: Final TypeScript check and integration commit

- [ ] **Step 1: TypeScript check**

```bash
cd /c/Users/jmena/Desktop/stockbet && npx tsc --noEmit 2>&1 | grep -v "node_modules" | grep -E "error TS" | head -10
```

Expected: only the two pre-existing errors in `TopNav.tsx` and `FeedControls.tsx`.

- [ ] **Step 2: If there are errors, fix them**

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
cd /c/Users/jmena/Desktop/stockbet && git add -A && git commit -m "fix: admin panel TypeScript fixes"
```
