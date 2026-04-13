# Challenge Public/Private + Trading P&L Scoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public/private visibility to challenges and a Trading P&L scoring mode where participants are ranked by realized profit/loss on challenge markets instead of YES/NO picks.

**Architecture:** Extend the `Challenge` schema with `isPublic`, `scoringMode`, and `startDate` fields. Add a pure `scorePnlEntries()` helper alongside the existing picks-scoring functions. Branch on `scoringMode` in `_resolveOneChallenge()` to use P&L scoring when appropriate. Gate `getChallengeList()` behind `isPublic: true`. Update the form and detail UI to expose the new options.

**Tech Stack:** Next.js 15, Prisma 5, PostgreSQL, TypeScript, Vitest

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `ScoringMode` enum; add `isPublic`, `scoringMode`, `startDate` to `Challenge` |
| `src/lib/challenges.ts` | Add `scorePnlEntries()`; update `createChallenge()`; update `_resolveOneChallenge()` |
| `src/lib/__tests__/challenges.test.ts` | Add tests for `scorePnlEntries()` |
| `src/app/api/challenges/route.ts` | Accept and validate `isPublic`, `scoringMode`, `startDate` |
| `src/lib/queries/challenges.ts` | Filter `getChallengeList()` by `isPublic: true` |
| `src/components/challenges/CreateChallengeForm.tsx` | Add public/private toggle, scoring mode selector, start date field |
| `src/components/challenges/ChallengeCard.tsx` | Add scoring mode badge |
| `src/components/challenges/ChallengeDetail.tsx` | Hide picks UI for P&L mode; show P&L in leaderboard |

---

## Task 1: Schema — Add ScoringMode enum and Challenge fields

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the ScoringMode enum and three new fields to Challenge**

In `prisma/schema.prisma`, add the enum after the existing enums block (after `ChallengeType`):

```prisma
enum ScoringMode {
  PICKS
  TRADING_PNL
}
```

Then in the `Challenge` model, add three fields after `resolvedAt`:

```prisma
  isPublic    Boolean     @default(false)
  scoringMode ScoringMode @default(PICKS)
  startDate   DateTime?   @db.Date
```

The full `Challenge` model should now end with:
```prisma
  inviteSlug    String          @unique
  createdAt     DateTime        @default(now())
  resolvedAt    DateTime?
  isPublic      Boolean         @default(false)
  scoringMode   ScoringMode     @default(PICKS)
  startDate     DateTime?       @db.Date

  markets ChallengeMarket[]
  entries ChallengeEntry[]

  @@index([status, betDate])
  @@index([creatorId])
```

- [ ] **Step 2: Run the migration**

```bash
cd /Users/jacobomenasche/Desktop/stockbets && npx prisma migrate dev --name add-challenge-public-pnl
```

Expected output: `✔  Generated Prisma Client` and `The following migration(s) have been created and applied`

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
cd /Users/jacobomenasche/Desktop/stockbets && npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
cd /Users/jacobomenasche/Desktop/stockbets && git add prisma/schema.prisma prisma/migrations && git commit -m "feat: add isPublic, scoringMode, startDate to Challenge schema"
```

---

## Task 2: Add scorePnlEntries() and tests

**Files:**
- Modify: `src/lib/challenges.ts`
- Modify: `src/lib/__tests__/challenges.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/lib/__tests__/challenges.test.ts`, add this import at the top:

```ts
import {
  scoreEntry,
  rankEntries,
  computePayouts,
  isEligibleForBonus,
  scorePnlEntries,
} from "@/lib/challenges";
```

Then append after the existing test blocks:

```ts
describe("scorePnlEntries", () => {
  it("assigns P&L from map to each entry", () => {
    const now = new Date();
    const entries = [
      { id: "e1", userId: "u1", createdAt: now },
      { id: "e2", userId: "u2", createdAt: now },
    ];
    const pnlByUser = new Map([
      ["u1", 500],
      ["u2", -100],
    ]);
    const scored = scorePnlEntries(entries, pnlByUser);
    expect(scored.find((e) => e.id === "e1")?.score).toBe(500);
    expect(scored.find((e) => e.id === "e2")?.score).toBe(-100);
  });

  it("defaults to 0 for users with no positions", () => {
    const now = new Date();
    const entries = [{ id: "e1", userId: "u1", createdAt: now }];
    const scored = scorePnlEntries(entries, new Map());
    expect(scored[0].score).toBe(0);
  });

  it("handles negative P&L", () => {
    const now = new Date();
    const entries = [{ id: "e1", userId: "u1", createdAt: now }];
    const pnlByUser = new Map([["u1", -300]]);
    const scored = scorePnlEntries(entries, pnlByUser);
    expect(scored[0].score).toBe(-300);
  });

  it("handles empty entries", () => {
    const scored = scorePnlEntries([], new Map());
    expect(scored).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/jacobomenasche/Desktop/stockbets && npx vitest run src/lib/__tests__/challenges.test.ts
```

Expected: fail with `scorePnlEntries is not a function` or similar import error.

- [ ] **Step 3: Implement scorePnlEntries() in challenges.ts**

In `src/lib/challenges.ts`, add this function in the "Pure functions" section, after `isEligibleForBonus`:

```ts
export function scorePnlEntries(
  entries: { id: string; userId: string; createdAt: Date }[],
  pnlByUser: Map<string, number>
): { id: string; userId: string; createdAt: Date; score: number }[] {
  return entries.map((e) => ({
    ...e,
    score: pnlByUser.get(e.userId) ?? 0,
  }));
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/jacobomenasche/Desktop/stockbets && npx vitest run src/lib/__tests__/challenges.test.ts
```

Expected: all tests pass including the 4 new `scorePnlEntries` tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/jacobomenasche/Desktop/stockbets && git add src/lib/challenges.ts src/lib/__tests__/challenges.test.ts && git commit -m "feat: add scorePnlEntries pure helper with tests"
```

---

## Task 3: Update createChallenge() to accept new fields

**Files:**
- Modify: `src/lib/challenges.ts`

- [ ] **Step 1: Add ScoringMode to the import and update createChallenge signature**

At the top of `src/lib/challenges.ts`, update the Prisma import:

```ts
import { Side, PayoutType, ChallengeType, ScoringMode } from "@prisma/client";
```

Then replace the `createChallenge` function signature and body. Find the existing function:

```ts
export async function createChallenge({
  title,
  creatorId,
  type = ChallengeType.USER,
  entryFeeCents = 0,
  payoutType = PayoutType.WINNER_TAKES_ALL,
  marketIds,
}: {
  title: string;
  creatorId?: string;
  type?: ChallengeType;
  entryFeeCents?: number;
  payoutType?: PayoutType;
  marketIds: string[];
}) {
```

Replace with:

```ts
export async function createChallenge({
  title,
  creatorId,
  type = ChallengeType.USER,
  entryFeeCents = 0,
  payoutType = PayoutType.WINNER_TAKES_ALL,
  marketIds,
  isPublic = false,
  scoringMode = ScoringMode.PICKS,
  startDate = null,
}: {
  title: string;
  creatorId?: string;
  type?: ChallengeType;
  entryFeeCents?: number;
  payoutType?: PayoutType;
  marketIds: string[];
  isPublic?: boolean;
  scoringMode?: ScoringMode;
  startDate?: Date | null;
}) {
```

- [ ] **Step 2: Add new fields to the db.challenge.create() call**

Inside `createChallenge`, find the `db.challenge.create` call and add the three new fields:

```ts
  const inviteSlug = generateSlug();
  return db.challenge.create({
    data: {
      title,
      creatorId: creatorId ?? null,
      type,
      entryFeeCents,
      payoutType,
      betDate: market.betDate,
      inviteSlug,
      isPublic: type === ChallengeType.ADMIN ? true : isPublic,
      scoringMode,
      startDate: startDate ?? null,
      markets: {
        create: marketIds.map((marketId) => ({ marketId })),
      },
    },
    include: { markets: true },
  });
```

Note: `type === ChallengeType.ADMIN ? true : isPublic` ensures admin challenges are always public.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/jacobomenasche/Desktop/stockbets && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing errors unrelated to challenges.ts).

- [ ] **Step 4: Commit**

```bash
cd /Users/jacobomenasche/Desktop/stockbets && git add src/lib/challenges.ts && git commit -m "feat: update createChallenge to accept isPublic, scoringMode, startDate"
```

---

## Task 4: Update _resolveOneChallenge() for P&L mode

**Files:**
- Modify: `src/lib/challenges.ts`

- [ ] **Step 1: Add P&L scoring branch to _resolveOneChallenge()**

In `src/lib/challenges.ts`, find `async function _resolveOneChallenge(challenge: any)`. Replace the section after the void check (after the `if (challenge.entries.length <= 1)` block) with this:

```ts
  // Build resolution map: marketId → winningSide (used by PICKS mode)
  const resolutionMap = new Map<string, "YES" | "NO">();
  for (const cm of challenge.markets) {
    if (cm.market.resolution) {
      resolutionMap.set(cm.marketId, cm.market.resolution.winningSide as "YES" | "NO");
    }
  }

  let ranked: any[];

  if (challenge.scoringMode === "TRADING_PNL") {
    // Fetch realized P&L per participant on challenge markets
    const challengeMarketIds = challenge.markets.map((cm: any) => cm.marketId);
    const pnlByUser = new Map<string, number>();

    for (const entry of challenge.entries) {
      const positions = await db.position.findMany({
        where: {
          userId: entry.userId,
          marketId: { in: challengeMarketIds },
          realizedPL: { not: null },
        },
        select: { realizedPL: true },
      });
      const totalPnl = positions.reduce((sum, p) => sum + (p.realizedPL ?? 0), 0);
      pnlByUser.set(entry.userId, totalPnl);
    }

    const scoredEntries = scorePnlEntries(challenge.entries, pnlByUser);
    ranked = rankEntries(scoredEntries) as any[];
  } else {
    // PICKS mode (existing behavior)
    const scoredEntries = challenge.entries.map((entry: any) => ({
      ...entry,
      score: scoreEntry(
        entry.picks.map((p: any) => ({ marketId: p.marketId, side: p.side as "YES" | "NO" })),
        resolutionMap
      ),
    }));
    ranked = rankEntries(scoredEntries) as any[];
  }
```

Leave everything after (the `totalPotCents`, `payouts`, `db.$transaction`, and `FeedEvent` blocks) unchanged.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/jacobomenasche/Desktop/stockbets && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/jacobomenasche/Desktop/stockbets && git add src/lib/challenges.ts && git commit -m "feat: branch _resolveOneChallenge on scoringMode for P&L scoring"
```

---

## Task 5: Update POST /api/challenges to accept new fields

**Files:**
- Modify: `src/app/api/challenges/route.ts`

- [ ] **Step 1: Update the destructure and add validation**

In `src/app/api/challenges/route.ts`, find the destructure line:

```ts
  const { title, marketIds, entryFeeCents, payoutType, isAdmin } = body as {
    title?: unknown;
    marketIds?: unknown;
    entryFeeCents?: unknown;
    payoutType?: unknown;
    isAdmin?: unknown;
  };
```

Replace with:

```ts
  const { title, marketIds, entryFeeCents, payoutType, isAdmin, isPublic, scoringMode, startDate } = body as {
    title?: unknown;
    marketIds?: unknown;
    entryFeeCents?: unknown;
    payoutType?: unknown;
    isAdmin?: unknown;
    isPublic?: unknown;
    scoringMode?: unknown;
    startDate?: unknown;
  };
```

Then after the existing `payoutType` validation, add:

```ts
  if (scoringMode !== undefined && scoringMode !== "PICKS" && scoringMode !== "TRADING_PNL") {
    return NextResponse.json({ error: "scoringMode must be PICKS or TRADING_PNL" }, { status: 400 });
  }
  if (startDate !== undefined && startDate !== null && typeof startDate !== "string") {
    return NextResponse.json({ error: "startDate must be an ISO date string or null" }, { status: 400 });
  }
```

- [ ] **Step 2: Pass new fields to createChallenge()**

Find the `createChallenge` call and update it:

```ts
    const challenge = await createChallenge({
      title: title.trim(),
      creatorId: session.user.id,
      type,
      entryFeeCents: entryFeeCents as number,
      payoutType: payoutType as PayoutType,
      marketIds: marketIds as string[],
      isPublic: isPublic === true,
      scoringMode: (scoringMode as ScoringMode | undefined) ?? ScoringMode.PICKS,
      startDate: startDate ? new Date(startDate as string) : null,
    });
```

Add `ScoringMode` to the import at the top:

```ts
import { ChallengeType, PayoutType, ScoringMode } from "@prisma/client";
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/jacobomenasche/Desktop/stockbets && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/jacobomenasche/Desktop/stockbets && git add src/app/api/challenges/route.ts && git commit -m "feat: API route accepts isPublic, scoringMode, startDate for challenges"
```

---

## Task 6: Filter getChallengeList() by isPublic

**Files:**
- Modify: `src/lib/queries/challenges.ts`

- [ ] **Step 1: Add isPublic filter to getChallengeList**

In `src/lib/queries/challenges.ts`, find `getChallengeList`:

```ts
export async function getChallengeList() {
  return db.challenge.findMany({
    where: { status: ChallengeStatus.OPEN },
```

Replace `where` with:

```ts
    where: { status: ChallengeStatus.OPEN, isPublic: true },
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/jacobomenasche/Desktop/stockbets && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/jacobomenasche/Desktop/stockbets && git add src/lib/queries/challenges.ts && git commit -m "feat: getChallengeList only returns public challenges"
```

---

## Task 7: Update CreateChallengeForm with new controls

**Files:**
- Modify: `src/components/challenges/CreateChallengeForm.tsx`

- [ ] **Step 1: Replace CreateChallengeForm.tsx with the updated version**

Replace the entire file contents with:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface OpenMarket {
  id: string;
  question: string;
  company: { ticker: string };
}

interface CreateChallengeFormProps {
  openMarkets: OpenMarket[];
  isAdmin: boolean;
}

export function CreateChallengeForm({ openMarkets, isAdmin }: CreateChallengeFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [selectedMarkets, setSelectedMarkets] = useState<Set<string>>(new Set());
  const [entryFeeCents, setEntryFeeCents] = useState(0);
  const [payoutType, setPayoutType] = useState<"WINNER_TAKES_ALL" | "TOP_THREE_SPLIT">("WINNER_TAKES_ALL");
  const [asAdmin, setAsAdmin] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [scoringMode, setScoringMode] = useState<"PICKS" | "TRADING_PNL">("PICKS");
  const [startDate, setStartDate] = useState("");
  const [loading, setLoading] = useState(false);

  function toggleMarket(id: string) {
    setSelectedMarkets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (!title.trim()) return alert("Title is required");
    if (selectedMarkets.size === 0) return alert("Select at least one market");
    setLoading(true);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          marketIds: Array.from(selectedMarkets),
          entryFeeCents,
          payoutType,
          isAdmin: asAdmin,
          isPublic: asAdmin ? true : isPublic,
          scoringMode,
          startDate: scoringMode === "TRADING_PNL" && startDate ? startDate : null,
        }),
      });
      if (res.ok) {
        const { slug } = await res.json();
        router.push(`/challenges/${slug}`);
      } else {
        let message = "Failed to create challenge";
        try {
          const body = await res.json();
          if (body.error) message = body.error;
        } catch {}
        alert(message);
      }
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    backgroundColor: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
          Challenge Title
        </label>
        <input
          type="text"
          placeholder="e.g. Big Tech Thursday"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
          style={inputStyle}
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
          Select Markets ({selectedMarkets.size} selected)
        </label>
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {openMarkets.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggleMarket(m.id)}
              className="w-full text-left rounded-lg px-3 py-2 text-sm transition-colors"
              style={{
                backgroundColor: selectedMarkets.has(m.id) ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.04)",
                border: selectedMarkets.has(m.id) ? "1px solid rgba(167,139,250,0.3)" : "1px solid rgba(255,255,255,0.06)",
                color: selectedMarkets.has(m.id) ? "#a78bfa" : "rgba(255,255,255,0.6)",
              }}
            >
              <span className="font-medium mr-2">{m.company.ticker}</span>
              {m.question}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Entry Fee (¢)
          </label>
          <input
            type="number"
            min={0}
            value={entryFeeCents}
            onChange={(e) => setEntryFeeCents(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
            style={inputStyle}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Payout Type
          </label>
          <select
            value={payoutType}
            onChange={(e) => setPayoutType(e.target.value as "WINNER_TAKES_ALL" | "TOP_THREE_SPLIT")}
            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
            style={inputStyle}
          >
            <option value="WINNER_TAKES_ALL" style={{ backgroundColor: "#1a1a2e" }}>Winner takes all</option>
            <option value="TOP_THREE_SPLIT" style={{ backgroundColor: "#1a1a2e" }}>Top 3 split (60/30/10)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
          Scoring Mode
        </label>
        <select
          value={scoringMode}
          onChange={(e) => setScoringMode(e.target.value as "PICKS" | "TRADING_PNL")}
          className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
          style={inputStyle}
        >
          <option value="PICKS" style={{ backgroundColor: "#1a1a2e" }}>Picks (YES / NO)</option>
          <option value="TRADING_PNL" style={{ backgroundColor: "#1a1a2e" }}>Trading P&amp;L</option>
        </select>
      </div>

      {scoringMode === "TRADING_PNL" && (
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Start Date (optional — for multi-day challenges)
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
            style={inputStyle}
          />
        </div>
      )}

      {!asAdmin && (
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
            Visibility
          </label>
          <div className="flex gap-3">
            {(["private", "public"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setIsPublic(v === "public")}
                className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{
                  backgroundColor: (isPublic ? v === "public" : v === "private")
                    ? "rgba(167,139,250,0.15)"
                    : "rgba(255,255,255,0.04)",
                  border: (isPublic ? v === "public" : v === "private")
                    ? "1px solid rgba(167,139,250,0.3)"
                    : "1px solid rgba(255,255,255,0.06)",
                  color: (isPublic ? v === "public" : v === "private")
                    ? "#a78bfa"
                    : "rgba(255,255,255,0.4)",
                }}
              >
                {v === "private" ? "Private (invite link)" : "Public (anyone can join)"}
              </button>
            ))}
          </div>
        </div>
      )}

      {isAdmin && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={asAdmin}
            onChange={(e) => setAsAdmin(e.target.checked)}
            className="rounded"
          />
          <span className="text-xs" style={{ color: "rgba(167,139,250,0.8)" }}>
            Create as Featured challenge (admin only — always public)
          </span>
        </label>
      )}

      <button
        type="button"
        onClick={handleCreate}
        disabled={loading}
        className="w-full py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
        style={{ backgroundColor: "rgba(167,139,250,0.2)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
      >
        {loading ? "Creating..." : "Create Challenge"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/jacobomenasche/Desktop/stockbets && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/jacobomenasche/Desktop/stockbets && git add src/components/challenges/CreateChallengeForm.tsx && git commit -m "feat: add public/private toggle and scoring mode selector to CreateChallengeForm"
```

---

## Task 8: Add scoring mode badge to ChallengeCard

**Files:**
- Modify: `src/components/challenges/ChallengeCard.tsx`

- [ ] **Step 1: Add P&L badge to ChallengeCard**

In `src/components/challenges/ChallengeCard.tsx`, find the metadata line:

```tsx
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          {challenge._count.markets} market{challenge._count.markets !== 1 ? "s" : ""} ·{" "}
          {isFree ? "Free" : `${challenge.entryFeeCents}¢ entry`} ·{" "}
          {challenge.payoutType === "WINNER_TAKES_ALL" ? "Winner takes all" : "Top 3 split"} ·{" "}
          {challenge._count.entries} joined
        </p>
```

Replace with:

```tsx
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          {challenge._count.markets} market{challenge._count.markets !== 1 ? "s" : ""} ·{" "}
          {isFree ? "Free" : `${challenge.entryFeeCents}¢ entry`} ·{" "}
          {challenge.payoutType === "WINNER_TAKES_ALL" ? "Winner takes all" : "Top 3 split"} ·{" "}
          {challenge.scoringMode === "TRADING_PNL" ? "P&L" : "Picks"} ·{" "}
          {challenge._count.entries} joined
        </p>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/jacobomenasche/Desktop/stockbets && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors. (`scoringMode` is now on the `ChallengeListItem` type automatically via Prisma inference.)

- [ ] **Step 3: Commit**

```bash
cd /Users/jacobomenasche/Desktop/stockbets && git add src/components/challenges/ChallengeCard.tsx && git commit -m "feat: show scoring mode badge on ChallengeCard"
```

---

## Task 9: Update ChallengeDetail for P&L mode

**Files:**
- Modify: `src/components/challenges/ChallengeDetail.tsx`

- [ ] **Step 1: Hide picks UI and update leaderboard score column for P&L mode**

In `src/components/challenges/ChallengeDetail.tsx`, find the "Markets + picks" block:

```tsx
      {/* Markets + picks */}
      {isOpen && hasJoined && (
```

Replace with:

```tsx
      {/* Markets + picks — only shown for PICKS mode */}
      {isOpen && hasJoined && challenge.scoringMode !== "TRADING_PNL" && (
```

Then find the leaderboard score cell:

```tsx
                    <td className="py-2 pr-3 tabular" style={{ color: "rgba(255,255,255,0.6)" }}>
                      {challenge.status === "RESOLVED"
                        ? `${entry.score}/${challenge.markets.length}`
                        : `${entry.picks.length} pick${entry.picks.length !== 1 ? "s" : ""}`}
                    </td>
```

Replace with:

```tsx
                    <td className="py-2 pr-3 tabular" style={{ color: "rgba(255,255,255,0.6)" }}>
                      {challenge.scoringMode === "TRADING_PNL"
                        ? challenge.status === "RESOLVED"
                          ? entry.score >= 0
                            ? `+${(entry.score / 100).toFixed(2)}`
                            : `${(entry.score / 100).toFixed(2)}`
                          : "—"
                        : challenge.status === "RESOLVED"
                        ? `${entry.score}/${challenge.markets.length}`
                        : `${entry.picks.length} pick${entry.picks.length !== 1 ? "s" : ""}`}
                    </td>
```

Also update the leaderboard header to show the right column label. Find:

```tsx
                {["#", "Player", "Score", "Payout"].map((h) => (
```

Replace with:

```tsx
                {["#", "Player", challenge.scoringMode === "TRADING_PNL" ? "P&L" : "Score", "Payout"].map((h) => (
```

Finally, add a P&L info note below the join button for TRADING_PNL challenges. Find:

```tsx
      {isOpen && !hasJoined && userId && (
        <button
```

Replace with:

```tsx
      {isOpen && challenge.scoringMode === "TRADING_PNL" && hasJoined && (
        <div
          className="rounded-xl border p-4 text-sm"
          style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
        >
          You&apos;ve joined. Place trades on the challenge markets — your realized P&amp;L will be your score at resolution.
        </div>
      )}

      {isOpen && !hasJoined && userId && (
        <button
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/jacobomenasche/Desktop/stockbets && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/jacobomenasche/Desktop/stockbets && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/jacobomenasche/Desktop/stockbets && git add src/components/challenges/ChallengeDetail.tsx && git commit -m "feat: ChallengeDetail hides picks UI and shows P&L scores for TRADING_PNL mode"
```
