# Deposit System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add play-money balance system — $1,000 on sign-up, daily top-up button, real balance in TopNav and portfolio page.

**Architecture:** `lastTopUpAt` on `User` enforces the 24h cooldown. `cashBalanceCents` is stored as BigInt on `User` and surfaced in the NextAuth JWT so `TopNav` reads it from `useSession()` without extra fetches. After a top-up, `useSession().update()` refreshes the JWT so TopNav reflects the new balance immediately.

**Tech Stack:** Prisma, Next.js 15 App Router, NextAuth v5, next-auth/react

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `lastTopUpAt DateTime?` to User |
| `src/app/api/auth/signup/route.ts` | Modify | Change initial balance from BigInt(0) to BigInt(100_000) |
| `src/app/api/balance/topup/route.ts` | Create | POST — check cooldown, increment balance, return new state |
| `src/auth.ts` | Modify | Add cashBalanceCents to JWT + session callbacks |
| `src/types/next-auth.d.ts` | Create | TypeScript module augmentation for Session type |
| `src/components/portfolio/BalanceTopUp.tsx` | Create | Client component — balance display + top-up button with countdown |
| `src/app/portfolio/page.tsx` | Modify | Server component — fetch user balance, render BalanceTopUp |
| `src/components/layout/TopNav.tsx` | Modify | Replace hardcoded `$0.00` with real balance from session |

---

### Task 1: Schema update + sign-up starting balance

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/app/api/auth/signup/route.ts`

- [ ] **Step 1: Add `lastTopUpAt` to User model in schema**

In `prisma/schema.prisma`, find the User model and add `lastTopUpAt DateTime?` after `updatedAt`:

```prisma
model User {
  id               String     @id @default(cuid())
  email            String     @unique
  emailVerified    DateTime?
  password         String?
  displayName      String?
  avatarUrl        String?
  cashBalanceCents BigInt     @default(0)
  lastTopUpAt      DateTime?
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt

  accounts  Account[]
  orders    Order[]
  positions Position[]
}
```

- [ ] **Step 2: Push schema to DB**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Regenerate Prisma client**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx prisma generate
```

- [ ] **Step 4: Update sign-up route to grant $1,000**

In `src/app/api/auth/signup/route.ts`, change line 47:

```typescript
        cashBalanceCents: BigInt(100_000),
```

(was `BigInt(0)`)

- [ ] **Step 5: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add prisma/schema.prisma src/app/api/auth/signup/route.ts && git commit -m "feat: add lastTopUpAt to User, grant $1000 on sign-up"
```

---

### Task 2: Top-up API route

**Files:**
- Create: `src/app/api/balance/topup/route.ts`

- [ ] **Step 1: Create the route**

Create directory `src/app/api/balance/topup/` and file `route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const TOP_UP_AMOUNT = BigInt(100_000); // $1,000 in cents
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { cashBalanceCents: true, lastTopUpAt: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const now = new Date();

  if (user.lastTopUpAt) {
    const elapsed = now.getTime() - user.lastTopUpAt.getTime();
    if (elapsed < COOLDOWN_MS) {
      const nextTopUpAt = new Date(user.lastTopUpAt.getTime() + COOLDOWN_MS);
      return NextResponse.json(
        { error: "Cooldown active", nextTopUpAt: nextTopUpAt.toISOString() },
        { status: 429 }
      );
    }
  }

  const updated = await db.user.update({
    where: { id: session.user.id },
    data: {
      cashBalanceCents: { increment: TOP_UP_AMOUNT },
      lastTopUpAt: now,
    },
    select: { cashBalanceCents: true },
  });

  const nextTopUpAt = new Date(now.getTime() + COOLDOWN_MS);

  return NextResponse.json({
    cashBalanceCents: Number(updated.cashBalanceCents),
    nextTopUpAt: nextTopUpAt.toISOString(),
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx tsc --noEmit 2>&1 | grep "api/balance"
```

Expected: no output (no errors in the new file).

- [ ] **Step 3: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add src/app/api/balance/ && git commit -m "feat: POST /api/balance/topup with 24h cooldown"
```

---

### Task 3: Auth JWT + TypeScript types + TopNav real balance

**Files:**
- Create: `src/types/next-auth.d.ts`
- Modify: `src/auth.ts`
- Modify: `src/components/layout/TopNav.tsx`

- [ ] **Step 1: Create TypeScript module augmentation**

Create `src/types/next-auth.d.ts`:

```typescript
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      cashBalanceCents: number;
    } & DefaultSession["user"];
  }
}
```

- [ ] **Step 2: Update src/auth.ts JWT and session callbacks**

Replace the existing `callbacks` block in `src/auth.ts` with:

```typescript
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { cashBalanceCents: true },
        });
        token.cashBalanceCents = Number(dbUser?.cashBalanceCents ?? 0);
      }
      if (trigger === "update" && session?.cashBalanceCents !== undefined) {
        token.cashBalanceCents = session.cashBalanceCents;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.cashBalanceCents = (token.cashBalanceCents as number) ?? 0;
      }
      return session;
    },
  },
```

- [ ] **Step 3: Update TopNav to show real balance**

In `src/components/layout/TopNav.tsx`, add the `formatCents` import at the top:

```typescript
import { formatCents } from "@/lib/format";
```

Then replace the hardcoded `$0.00` span (line 77) with:

```tsx
<span className="font-medium">{formatCents(session.user?.cashBalanceCents ?? 0)}</span>
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx tsc --noEmit 2>&1 | grep -v "markets\|FeedControls\|portfolio"
```

Expected: no new errors in auth.ts, TopNav.tsx, or next-auth.d.ts.

- [ ] **Step 5: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add src/types/next-auth.d.ts src/auth.ts src/components/layout/TopNav.tsx && git commit -m "feat: cashBalanceCents in JWT session, real balance in TopNav"
```

---

### Task 4: Portfolio page with BalanceTopUp component

**Files:**
- Create: `src/components/portfolio/BalanceTopUp.tsx`
- Modify: `src/app/portfolio/page.tsx`

- [ ] **Step 1: Create BalanceTopUp client component**

Create `src/components/portfolio/BalanceTopUp.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Wallet, Plus } from "lucide-react";
import { formatCents } from "@/lib/format";

interface BalanceTopUpProps {
  initialCashBalanceCents: number;
  initialNextTopUpAt: string | null;
}

function useCountdown(target: Date | null): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;

    function tick() {
      const ms = target!.getTime() - Date.now();
      if (ms <= 0) {
        setLabel(null);
        return;
      }
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setLabel(`Available in ${h}h ${m}m`);
    }

    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [target]);

  return label;
}

export function BalanceTopUp({
  initialCashBalanceCents,
  initialNextTopUpAt,
}: BalanceTopUpProps) {
  const { update } = useSession();
  const [balance, setBalance] = useState(initialCashBalanceCents);
  const [nextTopUpAt, setNextTopUpAt] = useState<Date | null>(
    initialNextTopUpAt ? new Date(initialNextTopUpAt) : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countdown = useCountdown(nextTopUpAt);

  async function handleTopUp() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/balance/topup", { method: "POST" });
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      if (res.status === 429 && data.nextTopUpAt) {
        setNextTopUpAt(new Date(data.nextTopUpAt));
      } else {
        setError(data.error ?? "Something went wrong.");
      }
      return;
    }

    setBalance(data.cashBalanceCents);
    setNextTopUpAt(new Date(data.nextTopUpAt));
    await update({ cashBalanceCents: data.cashBalanceCents });
  }

  const canTopUp = !countdown && !loading;

  return (
    <div
      className="rounded-xl border p-6 mb-6"
      style={{
        borderColor: "rgba(255,255,255,0.08)",
        backgroundColor: "rgba(255,255,255,0.02)",
      }}
    >
      <p
        className="text-xs uppercase tracking-wider mb-3"
        style={{ color: "rgba(255,255,255,0.3)" }}
      >
        Play money balance
      </p>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: "rgba(0,194,168,0.1)" }}
          >
            <Wallet className="h-5 w-5" style={{ color: "var(--color-yes)" }} />
          </div>
          <span
            className="text-2xl font-semibold tabular"
            style={{ color: "var(--color-yes)" }}
          >
            {formatCents(balance)}
          </span>
        </div>

        <button
          type="button"
          onClick={handleTopUp}
          disabled={!canTopUp}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
          style={{
            backgroundColor: canTopUp
              ? "rgba(0,194,168,0.15)"
              : "rgba(255,255,255,0.05)",
            color: canTopUp ? "var(--color-yes)" : "rgba(255,255,255,0.35)",
            border: `1px solid ${canTopUp ? "rgba(0,194,168,0.3)" : "rgba(255,255,255,0.08)"}`,
          }}
        >
          {loading ? (
            "Adding…"
          ) : countdown ? (
            countdown
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Add $1,000
            </>
          )}
        </button>
      </div>

      {error && (
        <p
          className="text-xs mt-3"
          style={{ color: "var(--color-no)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update portfolio page to fetch balance and render BalanceTopUp**

Replace entire `src/app/portfolio/page.tsx`:

```tsx
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { BalanceTopUp } from "@/components/portfolio/BalanceTopUp";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { cashBalanceCents: true, lastTopUpAt: true },
  });

  if (!user) redirect("/auth/signin");

  const nextTopUpAt = user.lastTopUpAt
    ? new Date(user.lastTopUpAt.getTime() + 24 * 60 * 60 * 1000).toISOString()
    : null;

  const isOnCooldown =
    user.lastTopUpAt !== null &&
    Date.now() - user.lastTopUpAt.getTime() < 24 * 60 * 60 * 1000;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-white mb-2">Portfolio</h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          Your balance and open positions
        </p>
      </div>

      <BalanceTopUp
        initialCashBalanceCents={Number(user.cashBalanceCents)}
        initialNextTopUpAt={isOnCooldown ? nextTopUpAt : null}
      />

      <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
        Open positions coming soon.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Start dev server and test**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx next dev
```

Test:
1. Sign in → TopNav shows `$1,000.00` (if you signed up after this change) or `$0.00` for existing users
2. Go to `/portfolio` → balance card shows with "Add $1,000" button
3. Click "Add $1,000" → balance updates to `$2,000.00`, button shows countdown
4. TopNav balance updates immediately to match

Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add src/components/portfolio/ src/app/portfolio/page.tsx && git commit -m "feat: portfolio page with balance display and top-up button"
```
