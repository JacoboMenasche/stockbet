# Social & Challenges — Plan 1: Schema + Challenges + Performance Bonus

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pool challenges (admin + user created), correct-call scoring, payout distribution, and weekly performance bonus cash to stockbets.

**Architecture:** All challenge business logic lives in `src/lib/challenges.ts` as pure functions (scoring, payouts, eligibility) plus DB orchestration functions (create, join, submit picks, resolve). Pages are Next.js 15 server components; interactive pick submission uses a client component calling API routes. Challenge resolution is appended to the existing `resolveAllOpenMarketsForToday()` in `src/lib/resolve-markets.ts`. Plan 2 (Profiles + Feed + Leagues) builds on the schema added here.

**Tech Stack:** Next.js 15 app router, Prisma + Neon PostgreSQL, Vitest for unit tests, Node.js `crypto` for invite slug generation (no new dependencies).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | Add 5 enums, 6 models, 2 User fields |
| Create | `src/lib/challenges.ts` | Pure logic + all DB operations for challenges & bonus |
| Create | `src/lib/__tests__/challenges.test.ts` | Unit tests for pure scoring/payout/eligibility fns |
| Create | `src/lib/queries/challenges.ts` | Read-only DB queries for pages |
| Modify | `src/lib/resolve-markets.ts` | Call challenge resolution + bonus after market resolution |
| Create | `src/app/api/challenges/route.ts` | GET list / POST create |
| Create | `src/app/api/challenges/[slug]/route.ts` | GET detail |
| Create | `src/app/api/challenges/[slug]/join/route.ts` | POST join |
| Create | `src/app/api/challenges/[slug]/picks/route.ts` | PATCH picks |
| Create | `src/app/challenges/page.tsx` | Browse + create button (server) |
| Create | `src/app/challenges/[slug]/page.tsx` | Challenge detail + picks UI (server shell) |
| Create | `src/app/challenges/create/page.tsx` | Create form page (server shell) |
| Create | `src/components/challenges/ChallengeCard.tsx` | Challenge list item (server) |
| Create | `src/components/challenges/ChallengeDetail.tsx` | Picks + leaderboard (client) |
| Create | `src/components/challenges/CreateChallengeForm.tsx` | Create form (client) |
| Modify | `src/components/layout/TopNav.tsx` | Add Challenges nav link |

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums and models to the schema**

Open `prisma/schema.prisma`. After the existing `ReleaseTime` enum, add:

```prisma
enum ChallengeStatus {
  OPEN
  LOCKED
  RESOLVED
  VOIDED
}

enum PayoutType {
  WINNER_TAKES_ALL
  TOP_THREE_SPLIT
}

enum LeagueJoinMode {
  INVITE
  OPEN
}

enum FeedEventType {
  BET_PLACED
  CHALLENGE_WON
  STREAK
  CHALLENGE_CREATED
}

enum ChallengeType {
  ADMIN
  USER
}
```

After the `Watchlist` model, add:

```prisma
// ─────────────────────────────────────────────────────────────────────────────
// Challenge
// ─────────────────────────────────────────────────────────────────────────────

model Challenge {
  id            String          @id @default(cuid())
  title         String
  type          ChallengeType   @default(USER)
  creatorId     String?
  creator       User?           @relation("CreatedChallenges", fields: [creatorId], references: [id])
  status        ChallengeStatus @default(OPEN)
  entryFeeCents Int             @default(0)
  payoutType    PayoutType      @default(WINNER_TAKES_ALL)
  betDate       DateTime        @db.Date
  inviteSlug    String          @unique
  createdAt     DateTime        @default(now())
  resolvedAt    DateTime?

  markets ChallengeMarket[]
  entries ChallengeEntry[]

  @@index([status, betDate])
}

model ChallengeMarket {
  id          String    @id @default(cuid())
  challengeId String
  challenge   Challenge @relation(fields: [challengeId], references: [id])
  marketId    String
  market      Market    @relation(fields: [marketId], references: [id])

  @@unique([challengeId, marketId])
}

model ChallengeEntry {
  id          String    @id @default(cuid())
  challengeId String
  challenge   Challenge @relation(fields: [challengeId], references: [id])
  userId      String
  user        User      @relation("ChallengeEntries", fields: [userId], references: [id])
  score       Int       @default(0)
  payout      Int       @default(0)
  rank        Int?
  createdAt   DateTime  @default(now())

  picks ChallengePick[]

  @@unique([challengeId, userId])
  @@index([userId])
}

model ChallengePick {
  id       String         @id @default(cuid())
  entryId  String
  entry    ChallengeEntry @relation(fields: [entryId], references: [id])
  marketId String
  market   Market         @relation("ChallengePickMarket", fields: [marketId], references: [id])
  side     Side
  correct  Boolean?

  @@unique([entryId, marketId])
}

// ─────────────────────────────────────────────────────────────────────────────
// League (schema only — logic implemented in Plan 2)
// ─────────────────────────────────────────────────────────────────────────────

model League {
  id         String         @id @default(cuid())
  name       String
  creatorId  String
  creator    User           @relation("CreatedLeagues", fields: [creatorId], references: [id])
  joinMode   LeagueJoinMode @default(INVITE)
  inviteSlug String         @unique
  createdAt  DateTime       @default(now())

  members LeagueMember[]
}

model LeagueMember {
  id       String   @id @default(cuid())
  leagueId String
  league   League   @relation(fields: [leagueId], references: [id])
  userId   String
  user     User     @relation("LeagueMemberships", fields: [userId], references: [id])
  isOwner  Boolean  @default(false)
  joinedAt DateTime @default(now())

  @@unique([leagueId, userId])
  @@index([userId])
}

// ─────────────────────────────────────────────────────────────────────────────
// FeedEvent (schema only — logic implemented in Plan 2)
// ─────────────────────────────────────────────────────────────────────────────

model FeedEvent {
  id        String        @id @default(cuid())
  userId    String
  user      User          @relation("FeedEvents", fields: [userId], references: [id])
  eventType FeedEventType
  refId     String?
  metadata  Json?
  createdAt DateTime      @default(now())

  @@index([createdAt])
}
```

- [ ] **Step 2: Add fields and relations to existing models**

In the `User` model, add after `updatedAt`:

```prisma
  username    String?   @unique
  lastBonusAt DateTime?
```

And add these relations to `User` (after existing `watchlist` relation):

```prisma
  challengesCreated Challenge[]    @relation("CreatedChallenges")
  challengeEntries  ChallengeEntry[] @relation("ChallengeEntries")
  leaguesCreated    League[]       @relation("CreatedLeagues")
  leagueMembers     LeagueMember[] @relation("LeagueMemberships")
  feedEvents        FeedEvent[]    @relation("FeedEvents")
```

In the `Market` model, add after existing `watchlist` relation:

```prisma
  challengeMarkets ChallengeMarket[]
  challengePicks   ChallengePick[]   @relation("ChallengePickMarket")
```

- [ ] **Step 3: Run migration**

```bash
cd /Users/jacobomenasche/Desktop/stockbets
npx prisma migrate dev --name add-challenges-leagues-feed --env-file .env
```

Expected: Migration created and applied, Prisma client regenerated. No errors.

- [ ] **Step 4: Verify client types**

```bash
npx tsx --env-file=.env -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
console.log('Challenge model:', typeof p.challenge);
console.log('ChallengeEntry model:', typeof p.challengeEntry);
console.log('ChallengePick model:', typeof p.challengePick);
p.\$disconnect();
"
```

Expected output:
```
Challenge model: object
ChallengeEntry model: object
ChallengePick model: object
```

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: add challenges, leagues, and feed schema"
```

---

## Task 2: Pure Logic Functions + Tests

**Files:**
- Create: `src/lib/challenges.ts` (pure functions only in this task)
- Create: `src/lib/__tests__/challenges.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/challenges.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  scoreEntry,
  rankEntries,
  computePayouts,
  isEligibleForBonus,
} from "@/lib/challenges";

describe("scoreEntry", () => {
  it("counts correct YES picks", () => {
    const picks = [
      { marketId: "m1", side: "YES" as const },
      { marketId: "m2", side: "NO" as const },
    ];
    const resolutions = new Map([["m1", "YES" as const], ["m2", "YES" as const]]);
    expect(scoreEntry(picks, resolutions)).toBe(1);
  });

  it("returns 0 for empty picks", () => {
    expect(scoreEntry([], new Map())).toBe(0);
  });

  it("counts all correct", () => {
    const picks = [
      { marketId: "m1", side: "YES" as const },
      { marketId: "m2", side: "NO" as const },
    ];
    const resolutions = new Map([["m1", "YES" as const], ["m2", "NO" as const]]);
    expect(scoreEntry(picks, resolutions)).toBe(2);
  });

  it("ignores picks for markets without resolution", () => {
    const picks = [{ marketId: "m1", side: "YES" as const }];
    expect(scoreEntry(picks, new Map())).toBe(0);
  });
});

describe("rankEntries", () => {
  it("ranks by score descending", () => {
    const now = new Date();
    const entries = [
      { id: "e1", score: 2, createdAt: now },
      { id: "e2", score: 5, createdAt: now },
      { id: "e3", score: 3, createdAt: now },
    ];
    const ranked = rankEntries(entries);
    expect(ranked[0].id).toBe("e2");
    expect(ranked[1].id).toBe("e3");
    expect(ranked[2].id).toBe("e1");
  });

  it("breaks ties by earlier join time", () => {
    const earlier = new Date("2026-01-01T10:00:00Z");
    const later = new Date("2026-01-01T11:00:00Z");
    const entries = [
      { id: "e1", score: 3, createdAt: later },
      { id: "e2", score: 3, createdAt: earlier },
    ];
    const ranked = rankEntries(entries);
    expect(ranked[0].id).toBe("e2");
    expect(ranked[1].id).toBe("e1");
  });

  it("assigns rank numbers starting at 1", () => {
    const now = new Date();
    const ranked = rankEntries([{ id: "e1", score: 1, createdAt: now }]);
    expect(ranked[0].rank).toBe(1);
  });
});

describe("computePayouts", () => {
  it("winner takes all pot", () => {
    const payouts = computePayouts(3, 900, "WINNER_TAKES_ALL");
    expect(payouts[0]).toBe(900);
    expect(payouts[1]).toBe(0);
    expect(payouts[2]).toBe(0);
  });

  it("top three split 60/30/10", () => {
    const payouts = computePayouts(3, 1000, "TOP_THREE_SPLIT");
    expect(payouts[0]).toBe(610); // 600 + 10 remainder
    expect(payouts[1]).toBe(300);
    expect(payouts[2]).toBe(100);
  });

  it("top three split with only 2 entries: remainder goes to winner", () => {
    const payouts = computePayouts(2, 1000, "TOP_THREE_SPLIT");
    expect(payouts[0]).toBe(700); // 600 + 100 remainder
    expect(payouts[1]).toBe(300);
    expect(payouts.length).toBe(2);
  });

  it("returns all zeros when pot is 0 (free challenge)", () => {
    const payouts = computePayouts(5, 0, "WINNER_TAKES_ALL");
    expect(payouts.every((p) => p === 0)).toBe(true);
  });

  it("total distributed always equals total pot", () => {
    const pot = 777;
    const payouts = computePayouts(3, pot, "TOP_THREE_SPLIT");
    expect(payouts.reduce((a, b) => a + b, 0)).toBe(pot);
  });
});

describe("isEligibleForBonus", () => {
  it("requires minimum 5 picks", () => {
    expect(isEligibleForBonus(4, 4, null)).toBe(false);
  });

  it("requires >= 65% win rate", () => {
    expect(isEligibleForBonus(10, 6, null)).toBe(false); // 60%
    expect(isEligibleForBonus(10, 7, null)).toBe(true);  // 70%
  });

  it("allows if lastBonusAt is null", () => {
    expect(isEligibleForBonus(10, 7, null)).toBe(true);
  });

  it("blocks if bonus given within 7 days", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(isEligibleForBonus(10, 7, threeDaysAgo)).toBe(false);
  });

  it("allows if last bonus was more than 7 days ago", () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    expect(isEligibleForBonus(10, 7, eightDaysAgo)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/jacobomenasche/Desktop/stockbets
npm test -- challenges
```

Expected: Multiple failures — `scoreEntry`, `rankEntries`, `computePayouts`, `isEligibleForBonus` not found.

- [ ] **Step 3: Create `src/lib/challenges.ts` with pure functions**

```typescript
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { Side, PayoutType, ChallengeType } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Pure functions (no DB — fully unit-testable)
// ─────────────────────────────────────────────────────────────────────────────

export function scoreEntry(
  picks: { marketId: string; side: "YES" | "NO" }[],
  resolutions: Map<string, "YES" | "NO">
): number {
  return picks.filter((p) => resolutions.get(p.marketId) === p.side).length;
}

export function rankEntries<T extends { score: number; createdAt: Date }>(
  entries: T[]
): (T & { rank: number })[] {
  return [...entries]
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.createdAt.getTime() - b.createdAt.getTime()
    )
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

export function computePayouts(
  rankedCount: number,
  totalPotCents: number,
  payoutType: "WINNER_TAKES_ALL" | "TOP_THREE_SPLIT"
): number[] {
  const payouts = Array<number>(rankedCount).fill(0);
  if (totalPotCents === 0) return payouts;

  if (payoutType === "WINNER_TAKES_ALL") {
    payouts[0] = totalPotCents;
    return payouts;
  }

  // TOP_THREE_SPLIT: 60 / 30 / 10
  const splits = [0.6, 0.3, 0.1];
  for (let i = 0; i < Math.min(rankedCount, 3); i++) {
    payouts[i] = Math.floor(totalPotCents * splits[i]);
  }
  // give any rounding remainder to the winner
  const distributed = payouts.reduce((a, b) => a + b, 0);
  payouts[0] += totalPotCents - distributed;
  return payouts;
}

export function isEligibleForBonus(
  totalPicks: number,
  correctPicks: number,
  lastBonusAt: Date | null
): boolean {
  if (totalPicks < 5) return false;
  if (correctPicks / totalPicks < 0.65) return false;
  if (lastBonusAt === null) return true;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return lastBonusAt < sevenDaysAgo;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function generateSlug(): string {
  return randomBytes(6).toString("base64url").slice(0, 10);
}
```

(DB functions will be added in Tasks 3–5.)

- [ ] **Step 4: Run tests — all should pass**

```bash
npm test -- challenges
```

Expected: All 14 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/challenges.ts src/lib/__tests__/challenges.test.ts
git commit -m "feat: add challenge scoring and payout pure functions with tests"
```

---

## Task 3: Challenge DB Functions — Create, Join, Submit Picks

**Files:**
- Modify: `src/lib/challenges.ts` (append DB functions)

- [ ] **Step 1: Append DB functions to `src/lib/challenges.ts`**

Add after the `generateSlug` helper:

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// DB operations
// ─────────────────────────────────────────────────────────────────────────────

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
  if (marketIds.length === 0) throw new Error("Challenge must include at least one market");

  // Derive betDate from the first market
  const market = await db.market.findUnique({
    where: { id: marketIds[0] },
    select: { betDate: true },
  });
  if (!market?.betDate) throw new Error("Market has no betDate");

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
      markets: {
        create: marketIds.map((marketId) => ({ marketId })),
      },
    },
    include: { markets: true },
  });
}

export async function joinChallenge(slug: string, userId: string) {
  const challenge = await db.challenge.findUnique({
    where: { inviteSlug: slug },
    include: { entries: { where: { userId } } },
  });
  if (!challenge) throw new Error("Challenge not found");
  if (challenge.status !== "OPEN") throw new Error("Challenge is not open");
  if (challenge.entries.length > 0) throw new Error("Already joined this challenge");

  if (challenge.entryFeeCents > 0) {
    return db.$transaction(async (tx) => {
      // Deduct entry fee — fails if insufficient balance
      await tx.user.update({
        where: {
          id: userId,
          cashBalanceCents: { gte: BigInt(challenge.entryFeeCents) },
        },
        data: { cashBalanceCents: { decrement: BigInt(challenge.entryFeeCents) } },
      });
      return tx.challengeEntry.create({
        data: { challengeId: challenge.id, userId },
      });
    });
  }

  return db.challengeEntry.create({
    data: { challengeId: challenge.id, userId },
  });
}

export async function submitPicks(
  slug: string,
  userId: string,
  picks: { marketId: string; side: "YES" | "NO" }[]
) {
  const challenge = await db.challenge.findUnique({
    where: { inviteSlug: slug },
    include: {
      entries: { where: { userId } },
      markets: { select: { marketId: true } },
    },
  });
  if (!challenge) throw new Error("Challenge not found");
  if (challenge.status !== "OPEN") throw new Error("Challenge is closed for picks");

  const entry = challenge.entries[0];
  if (!entry) throw new Error("You have not joined this challenge");

  const validMarketIds = new Set(challenge.markets.map((m) => m.marketId));
  const invalidPick = picks.find((p) => !validMarketIds.has(p.marketId));
  if (invalidPick) throw new Error(`Market ${invalidPick.marketId} is not in this challenge`);

  await db.$transaction(
    picks.map(({ marketId, side }) =>
      db.challengePick.upsert({
        where: { entryId_marketId: { entryId: entry.id, marketId } },
        update: { side: side as Side },
        create: { entryId: entry.id, marketId, side: side as Side },
      })
    )
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/challenges.ts
git commit -m "feat: add challenge create, join, and pick submission DB functions"
```

---

## Task 4: Challenge Resolution

**Files:**
- Modify: `src/lib/challenges.ts` (append resolution function)
- Modify: `src/lib/resolve-markets.ts` (call resolution at end)

- [ ] **Step 1: Append `resolveChallengesForDate` to `src/lib/challenges.ts`**

```typescript
export async function resolveChallengesForDate(betDate: Date) {
  const challenges = await db.challenge.findMany({
    where: { betDate, status: "OPEN" },
    include: {
      entries: {
        include: { picks: true },
        orderBy: { createdAt: "asc" },
      },
      markets: {
        include: {
          market: { include: { resolution: true } },
        },
      },
    },
  });

  for (const challenge of challenges) {
    try {
      await _resolveOneChallenge(challenge);
    } catch (err) {
      console.error(`[challenges] Failed to resolve challenge ${challenge.id}:`, err);
    }
  }
}

async function _resolveOneChallenge(
  challenge: Awaited<ReturnType<typeof db.challenge.findMany>>[number] & {
    entries: (import("@prisma/client").ChallengeEntry & {
      picks: import("@prisma/client").ChallengePick[];
    })[];
    markets: (import("@prisma/client").ChallengeMarket & {
      market: import("@prisma/client").Market & {
        resolution: import("@prisma/client").Resolution | null;
      };
    })[];
  }
) {
  // Void if 0 or 1 entrant
  if (challenge.entries.length <= 1) {
    await db.$transaction([
      ...challenge.entries.map((e) =>
        db.user.update({
          where: { id: e.userId },
          data: { cashBalanceCents: { increment: BigInt(challenge.entryFeeCents) } },
        })
      ),
      db.challenge.update({
        where: { id: challenge.id },
        data: { status: "VOIDED" },
      }),
    ]);
    return;
  }

  // Build resolution map: marketId → winningSide
  const resolutionMap = new Map<string, "YES" | "NO">();
  for (const cm of challenge.markets) {
    if (cm.market.resolution) {
      resolutionMap.set(cm.marketId, cm.market.resolution.winningSide as "YES" | "NO");
    }
  }

  // Score and mark correct/incorrect on each pick
  const scoredEntries = challenge.entries.map((entry) => {
    const score = scoreEntry(
      entry.picks.map((p) => ({ marketId: p.marketId, side: p.side as "YES" | "NO" })),
      resolutionMap
    );
    return { entry, score };
  });

  // Rank
  const ranked = rankEntries(
    scoredEntries.map(({ entry, score }) => ({
      ...entry,
      score,
    }))
  );

  const totalPotCents = challenge.entryFeeCents * challenge.entries.length;
  const payouts = computePayouts(ranked.length, totalPotCents, challenge.payoutType as "WINNER_TAKES_ALL" | "TOP_THREE_SPLIT");

  await db.$transaction([
    // Update each entry with score, rank, payout
    ...ranked.map((entry, i) =>
      db.challengeEntry.update({
        where: { id: entry.id },
        data: { score: entry.score, rank: entry.rank, payout: payouts[i] },
      })
    ),
    // Mark each pick as correct/incorrect
    ...challenge.entries.flatMap((entry) =>
      entry.picks.map((pick) =>
        db.challengePick.update({
          where: { id: pick.id },
          data: { correct: resolutionMap.get(pick.marketId) === pick.side },
        })
      )
    ),
    // Pay out winners
    ...ranked
      .filter((_, i) => payouts[i] > 0)
      .map((entry, i) =>
        db.user.update({
          where: { id: entry.userId },
          data: { cashBalanceCents: { increment: BigInt(payouts[i]) } },
        })
      ),
    // Mark challenge resolved
    db.challenge.update({
      where: { id: challenge.id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    }),
  ]);

  // Write FeedEvent for winner (fire-and-forget — non-critical)
  const winner = ranked[0];
  if (winner) {
    db.feedEvent.create({
      data: {
        userId: winner.userId,
        eventType: "CHALLENGE_WON",
        refId: challenge.id,
        metadata: {
          score: winner.score,
          total: challenge.markets.length,
          payout: payouts[0],
        },
      },
    }).catch((err) => console.error("[challenges] FeedEvent write failed:", err));
  }
}
```

- [ ] **Step 2: Call resolution from `src/lib/resolve-markets.ts`**

At the top of `src/lib/resolve-markets.ts`, add the import:

```typescript
import { resolveChallengesForDate } from "@/lib/challenges";
```

At the end of `resolveAllOpenMarketsForToday()`, before the closing brace, add:

```typescript
  // Resolve any challenges whose markets all settled today
  try {
    await resolveChallengesForDate(today);
  } catch (err) {
    console.error("[resolve] Challenge resolution failed:", err);
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/challenges.ts src/lib/resolve-markets.ts
git commit -m "feat: add challenge resolution with scoring, ranking, and payouts"
```

---

## Task 5: Performance Bonus

**Files:**
- Modify: `src/lib/challenges.ts` (append bonus function)
- Modify: `src/lib/resolve-markets.ts` (call bonus at end)

- [ ] **Step 1: Append `awardPerformanceBonuses` to `src/lib/challenges.ts`**

```typescript
const BONUS_AMOUNT_CENTS = 500;

export async function awardPerformanceBonuses() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const users = await db.user.findMany({
    where: {
      OR: [{ lastBonusAt: null }, { lastBonusAt: { lt: sevenDaysAgo } }],
    },
    select: { id: true, lastBonusAt: true },
  });

  for (const user of users) {
    const picks = await db.challengePick.findMany({
      where: {
        entry: {
          userId: user.id,
          challenge: { resolvedAt: { gte: sevenDaysAgo } },
        },
        correct: { not: null },
      },
      select: { correct: true },
    });

    if (
      isEligibleForBonus(
        picks.length,
        picks.filter((p) => p.correct === true).length,
        user.lastBonusAt
      )
    ) {
      await db.user.update({
        where: { id: user.id },
        data: {
          cashBalanceCents: { increment: BigInt(BONUS_AMOUNT_CENTS) },
          lastBonusAt: new Date(),
        },
      });
      console.log(`[bonus] Awarded ${BONUS_AMOUNT_CENTS}¢ to user ${user.id}`);
    }
  }
}
```

- [ ] **Step 2: Call bonus from `src/lib/resolve-markets.ts`**

Update the import line at the top:

```typescript
import { resolveChallengesForDate, awardPerformanceBonuses } from "@/lib/challenges";
```

After the challenge resolution call at the end of `resolveAllOpenMarketsForToday()`, add:

```typescript
  // Award performance bonuses to eligible users
  try {
    await awardPerformanceBonuses();
  } catch (err) {
    console.error("[resolve] Performance bonus failed:", err);
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/challenges.ts src/lib/resolve-markets.ts
git commit -m "feat: add weekly performance bonus cash for accurate predictors"
```

---

## Task 6: Query Helpers for Pages

**Files:**
- Create: `src/lib/queries/challenges.ts`

- [ ] **Step 1: Create `src/lib/queries/challenges.ts`**

```typescript
import { db } from "@/lib/db";
import { ChallengeStatus } from "@prisma/client";

export type ChallengeListItem = Awaited<ReturnType<typeof getChallengeList>>[number];
export type ChallengeDetailData = Awaited<ReturnType<typeof getChallengeDetail>>;

export async function getChallengeList() {
  return db.challenge.findMany({
    where: { status: ChallengeStatus.OPEN },
    include: {
      creator: { select: { username: true, displayName: true } },
      _count: { select: { entries: true, markets: true } },
    },
    orderBy: [{ type: "asc" }, { createdAt: "desc" }], // ADMIN first
  });
}

export async function getChallengeDetail(slug: string, userId?: string) {
  const challenge = await db.challenge.findUnique({
    where: { inviteSlug: slug },
    include: {
      creator: { select: { username: true, displayName: true } },
      markets: {
        include: {
          market: {
            select: {
              id: true,
              question: true,
              metricType: true,
              thresholdLabel: true,
              yesPriceLatest: true,
              noPriceLatest: true,
              status: true,
            },
          },
        },
      },
      entries: {
        include: {
          user: { select: { username: true, displayName: true } },
          picks: { select: { marketId: true, side: true, correct: true } },
        },
        orderBy: [{ rank: "asc" }, { score: "desc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!challenge) return null;

  const userEntry = userId
    ? challenge.entries.find((e) => e.userId === userId) ?? null
    : null;

  return { challenge, userEntry };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/queries/challenges.ts
git commit -m "feat: add challenge query helpers"
```

---

## Task 7: API Routes

**Files:**
- Create: `src/app/api/challenges/route.ts`
- Create: `src/app/api/challenges/[slug]/route.ts`
- Create: `src/app/api/challenges/[slug]/join/route.ts`
- Create: `src/app/api/challenges/[slug]/picks/route.ts`

- [ ] **Step 1: Create `src/app/api/challenges/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getChallengeList } from "@/lib/queries/challenges";
import { createChallenge } from "@/lib/challenges";
import { ChallengeType, PayoutType } from "@prisma/client";

export async function GET() {
  const challenges = await getChallengeList();
  return NextResponse.json(challenges);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { title, marketIds, entryFeeCents, payoutType, isAdmin } = body as {
    title?: unknown;
    marketIds?: unknown;
    entryFeeCents?: unknown;
    payoutType?: unknown;
    isAdmin?: unknown;
  };

  if (typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!Array.isArray(marketIds) || marketIds.length === 0) {
    return NextResponse.json({ error: "marketIds must be a non-empty array" }, { status: 400 });
  }
  if (typeof entryFeeCents !== "number" || entryFeeCents < 0) {
    return NextResponse.json({ error: "entryFeeCents must be a non-negative number" }, { status: 400 });
  }
  if (payoutType !== "WINNER_TAKES_ALL" && payoutType !== "TOP_THREE_SPLIT") {
    return NextResponse.json({ error: "payoutType must be WINNER_TAKES_ALL or TOP_THREE_SPLIT" }, { status: 400 });
  }

  // Check admin status for ADMIN type
  let type = ChallengeType.USER;
  if (isAdmin === true) {
    const adminUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });
    const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim());
    if (adminUser && adminEmails.includes(adminUser.email)) {
      type = ChallengeType.ADMIN;
    }
  }

  try {
    const challenge = await createChallenge({
      title: title.trim(),
      creatorId: session.user.id,
      type,
      entryFeeCents: entryFeeCents as number,
      payoutType: payoutType as PayoutType,
      marketIds: marketIds as string[],
    });
    return NextResponse.json({ slug: challenge.inviteSlug }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

- [ ] **Step 2: Create `src/app/api/challenges/[slug]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getChallengeDetail } from "@/lib/queries/challenges";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const session = await auth();
  const result = await getChallengeDetail(slug, session?.user?.id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result);
}
```

- [ ] **Step 3: Create `src/app/api/challenges/[slug]/join/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { joinChallenge } from "@/lib/challenges";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await context.params;

  try {
    await joinChallenge(slug, session.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message === "Challenge not found" ? 404
      : message === "Already joined this challenge" ? 409
      : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
```

- [ ] **Step 4: Create `src/app/api/challenges/[slug]/picks/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { submitPicks } from "@/lib/challenges";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { picks } = body as { picks?: unknown };
  if (!Array.isArray(picks) || picks.length === 0) {
    return NextResponse.json({ error: "picks must be a non-empty array" }, { status: 400 });
  }
  for (const p of picks) {
    if (typeof p.marketId !== "string" || (p.side !== "YES" && p.side !== "NO")) {
      return NextResponse.json({ error: "Each pick needs marketId (string) and side (YES|NO)" }, { status: 400 });
    }
  }

  try {
    await submitPicks(slug, session.user.id, picks as { marketId: string; side: "YES" | "NO" }[]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/challenges/
git commit -m "feat: add challenge API routes (list, detail, join, picks)"
```

---

## Task 8: Challenges List Page

**Files:**
- Create: `src/components/challenges/ChallengeCard.tsx`
- Create: `src/app/challenges/page.tsx`

- [ ] **Step 1: Create `src/components/challenges/ChallengeCard.tsx`**

```tsx
import Link from "next/link";
import type { ChallengeListItem } from "@/lib/queries/challenges";

interface ChallengeCardProps {
  challenge: ChallengeListItem;
}

export function ChallengeCard({ challenge }: ChallengeCardProps) {
  const isAdmin = challenge.type === "ADMIN";
  const isFree = challenge.entryFeeCents === 0;

  return (
    <div
      className="rounded-xl border p-4 flex items-start justify-between gap-4"
      style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {isAdmin && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded"
              style={{ backgroundColor: "rgba(167,139,250,0.15)", color: "#a78bfa" }}
            >
              ⭐ Featured
            </span>
          )}
          <h3 className="text-white font-medium truncate">{challenge.title}</h3>
        </div>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          {challenge._count.markets} market{challenge._count.markets !== 1 ? "s" : ""} ·{" "}
          {isFree ? "Free" : `${challenge.entryFeeCents}¢ entry`} ·{" "}
          {challenge.payoutType === "WINNER_TAKES_ALL" ? "Winner takes all" : "Top 3 split"} ·{" "}
          {challenge._count.entries} joined
        </p>
        {challenge.creator && (
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
            by {challenge.creator.username ?? challenge.creator.displayName ?? "anonymous"}
          </p>
        )}
      </div>
      <Link
        href={`/challenges/${challenge.inviteSlug}`}
        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
        style={{ backgroundColor: "rgba(167,139,250,0.2)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
      >
        View
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/challenges/page.tsx`**

```tsx
import Link from "next/link";
import { auth } from "@/auth";
import { getChallengeList } from "@/lib/queries/challenges";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";

export const dynamic = "force-dynamic";

export default async function ChallengesPage() {
  const [session, challenges] = await Promise.all([
    auth(),
    getChallengeList(),
  ]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-medium text-white mb-1">Challenges</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            Predict correctly on more markets than everyone else to win the pot
          </p>
        </div>
        {session && (
          <Link
            href="/challenges/create"
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
          >
            + Create
          </Link>
        )}
      </div>

      {challenges.length === 0 ? (
        <div
          className="rounded-xl border py-16 text-center"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            No open challenges right now. Be the first to create one.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {challenges.map((c) => (
            <ChallengeCard key={c.id} challenge={c} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/challenges/ChallengeCard.tsx src/app/challenges/page.tsx
git commit -m "feat: add challenges list page"
```

---

## Task 9: Challenge Detail Page

**Files:**
- Create: `src/components/challenges/ChallengeDetail.tsx`
- Create: `src/app/challenges/[slug]/page.tsx`

- [ ] **Step 1: Create `src/components/challenges/ChallengeDetail.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChallengeDetailData } from "@/lib/queries/challenges";

interface ChallengeDetailProps {
  data: NonNullable<ChallengeDetailData>;
  userId?: string;
}

export function ChallengeDetail({ data, userId }: ChallengeDetailProps) {
  const { challenge, userEntry } = data;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [picks, setPicks] = useState<Record<string, "YES" | "NO">>(() => {
    const initial: Record<string, "YES" | "NO"> = {};
    if (userEntry) {
      for (const p of userEntry.picks) {
        initial[p.marketId] = p.side as "YES" | "NO";
      }
    }
    return initial;
  });

  const isOpen = challenge.status === "OPEN";
  const hasJoined = !!userEntry;

  async function handleJoin() {
    setLoading(true);
    const res = await fetch(`/api/challenges/${challenge.inviteSlug}/join`, { method: "POST" });
    setLoading(false);
    if (res.ok) router.refresh();
    else {
      const { error } = await res.json();
      alert(error ?? "Failed to join");
    }
  }

  async function handleSubmitPicks() {
    const pickList = Object.entries(picks).map(([marketId, side]) => ({ marketId, side }));
    if (pickList.length === 0) return alert("Select at least one pick");
    setLoading(true);
    const res = await fetch(`/api/challenges/${challenge.inviteSlug}/picks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ picks: pickList }),
    });
    setLoading(false);
    if (res.ok) router.refresh();
    else {
      const { error } = await res.json();
      alert(error ?? "Failed to submit picks");
    }
  }

  return (
    <div className="space-y-6">
      {/* Markets + picks */}
      {isOpen && hasJoined && (
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}
        >
          <h2 className="text-sm font-medium mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>
            Your Picks
          </h2>
          <div className="space-y-2">
            {challenge.markets.map(({ market }) => (
              <div key={market.id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-white flex-1 min-w-0 truncate">{market.question}</span>
                <div className="flex gap-2 shrink-0">
                  {(["YES", "NO"] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setPicks((p) => ({ ...p, [market.id]: side }))}
                      className="px-3 py-1 rounded text-xs font-medium transition-all"
                      style={{
                        backgroundColor:
                          picks[market.id] === side
                            ? side === "YES" ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"
                            : "rgba(255,255,255,0.06)",
                        color:
                          picks[market.id] === side
                            ? side === "YES" ? "#4ade80" : "#f87171"
                            : "rgba(255,255,255,0.4)",
                        border:
                          picks[market.id] === side
                            ? side === "YES" ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(248,113,113,0.3)"
                            : "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {side}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleSubmitPicks}
            disabled={loading}
            className="mt-4 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ backgroundColor: "rgba(167,139,250,0.2)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
          >
            {loading ? "Saving..." : "Save Picks"}
          </button>
        </div>
      )}

      {isOpen && !hasJoined && userId && (
        <button
          type="button"
          onClick={handleJoin}
          disabled={loading}
          className="w-full py-3 rounded-xl text-sm font-medium disabled:opacity-40"
          style={{ backgroundColor: "rgba(167,139,250,0.2)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
        >
          {loading
            ? "Joining..."
            : challenge.entryFeeCents > 0
            ? `Join for ${challenge.entryFeeCents}¢`
            : "Join (free)"}
        </button>
      )}

      {/* Leaderboard */}
      <div>
        <h2 className="text-sm font-medium mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>
          Leaderboard · {challenge.entries.length} player{challenge.entries.length !== 1 ? "s" : ""}
        </h2>
        {challenge.entries.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
            No one has joined yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["#", "Player", "Score", "Payout"].map((h) => (
                  <th key={h} className="pb-2 text-left font-normal text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {challenge.entries.map((entry, i) => {
                const isMe = entry.userId === userId;
                return (
                  <tr
                    key={entry.id}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                  >
                    <td className="py-2 pr-3 text-xs tabular" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {entry.rank ?? i + 1}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="text-white" style={isMe ? { color: "#a78bfa" } : {}}>
                        {entry.user.username ?? entry.user.displayName ?? "anon"}
                        {isMe && " (you)"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 tabular" style={{ color: "rgba(255,255,255,0.6)" }}>
                      {challenge.status === "RESOLVED"
                        ? `${entry.score}/${challenge.markets.length}`
                        : `${entry.picks.length} pick${entry.picks.length !== 1 ? "s" : ""}`}
                    </td>
                    <td className="py-2 tabular" style={{ color: entry.payout > 0 ? "#4ade80" : "rgba(255,255,255,0.3)" }}>
                      {entry.payout > 0 ? `+${entry.payout}¢` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/challenges/[slug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getChallengeDetail } from "@/lib/queries/challenges";
import { ChallengeDetail } from "@/components/challenges/ChallengeDetail";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ChallengeDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const data = await getChallengeDetail(slug, session?.user?.id);

  if (!data) notFound();

  const { challenge } = data;
  const isFree = challenge.entryFeeCents === 0;
  const totalPot = challenge.entryFeeCents * challenge.entries.length;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          {challenge.type === "ADMIN" && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded"
              style={{ backgroundColor: "rgba(167,139,250,0.15)", color: "#a78bfa" }}
            >
              ⭐ Featured
            </span>
          )}
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
          >
            {challenge.status}
          </span>
        </div>
        <h1 className="text-2xl font-medium text-white mt-2">{challenge.title}</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          {isFree ? "Free entry" : `${challenge.entryFeeCents}¢ entry`}
          {totalPot > 0 && ` · ${totalPot}¢ pot`}
          {" · "}
          {challenge.payoutType === "WINNER_TAKES_ALL" ? "Winner takes all" : "Top 3 split"}
        </p>
      </div>

      <ChallengeDetail data={data} userId={session?.user?.id} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/challenges/ChallengeDetail.tsx src/app/challenges/[slug]/page.tsx
git commit -m "feat: add challenge detail page with picks and leaderboard"
```

---

## Task 10: Create Challenge Page

**Files:**
- Create: `src/components/challenges/CreateChallengeForm.tsx`
- Create: `src/app/challenges/create/page.tsx`

- [ ] **Step 1: Create `src/components/challenges/CreateChallengeForm.tsx`**

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
    const res = await fetch("/api/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        marketIds: Array.from(selectedMarkets),
        entryFeeCents,
        payoutType,
        isAdmin: asAdmin,
      }),
    });
    setLoading(false);
    if (res.ok) {
      const { slug } = await res.json();
      router.push(`/challenges/${slug}`);
    } else {
      const { error } = await res.json();
      alert(error ?? "Failed to create challenge");
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

      {isAdmin && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={asAdmin}
            onChange={(e) => setAsAdmin(e.target.checked)}
            className="rounded"
          />
          <span className="text-xs" style={{ color: "rgba(167,139,250,0.8)" }}>
            Create as Featured challenge (admin only)
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

- [ ] **Step 2: Create `src/app/challenges/create/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { MarketStatus } from "@prisma/client";
import { CreateChallengeForm } from "@/components/challenges/CreateChallengeForm";
import { isAfterMarketClose } from "@/lib/create-daily-markets";

export const dynamic = "force-dynamic";

export default async function CreateChallengePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const openMarkets = await db.market.findMany({
    where: { status: MarketStatus.OPEN, betDate: today },
    select: { id: true, question: true, company: { select: { ticker: true } } },
    orderBy: [{ company: { ticker: "asc" } }, { metricType: "asc" }],
  });

  // Determine if this user is an admin
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });
  const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim());
  const isAdmin = !!user && adminEmails.includes(user.email);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-white mb-1">Create Challenge</h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          Pick markets from today, set an entry fee, and share the link
        </p>
      </div>

      {openMarkets.length === 0 ? (
        <div
          className="rounded-xl border py-12 text-center"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            {isAfterMarketClose()
              ? "Markets have closed for today. Check back tomorrow morning."
              : "No open markets available right now."}
          </p>
        </div>
      ) : (
        <CreateChallengeForm openMarkets={openMarkets} isAdmin={isAdmin} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/challenges/CreateChallengeForm.tsx src/app/challenges/create/page.tsx
git commit -m "feat: add create challenge page"
```

---

## Task 11: TopNav Update

**Files:**
- Modify: `src/components/layout/TopNav.tsx`

- [ ] **Step 1: Add Challenges and Feed to nav links**

In `src/components/layout/TopNav.tsx`, replace:

```typescript
const NAV_LINKS = [
  { href: "/markets", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
];
```

with:

```typescript
const NAV_LINKS = [
  { href: "/markets", label: "Markets" },
  { href: "/challenges", label: "Challenges" },
  { href: "/portfolio", label: "Portfolio" },
];
```

- [ ] **Step 2: Run the app and verify**

```bash
npm run dev
```

Open http://localhost:3001 and verify:
- "Challenges" appears in the nav between Markets and Portfolio
- `/challenges` loads with empty state or challenge cards
- `/challenges/create` loads with market selector (requires sign-in)
- Creating a challenge redirects to `/challenges/[slug]` with join button
- Joining a challenge shows pick submission UI

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/TopNav.tsx
git commit -m "feat: add Challenges to top nav"
```

---

## Self-Review Checklist

- [x] **Schema:** All 5 enums, 6 models, User/Market relations — covered in Task 1
- [x] **Pure functions:** scoreEntry, rankEntries, computePayouts, isEligibleForBonus — Task 2
- [x] **createChallenge:** validates markets, derives betDate, generates slug — Task 3
- [x] **joinChallenge:** atomic balance deduction, duplicate join check — Task 3
- [x] **submitPicks:** validates marketIds against challenge, upserts picks — Task 3
- [x] **Resolution:** 0/1 entrant void + refund, scoring, ranking, payouts, picks marked correct — Task 4
- [x] **FeedEvent written on CHALLENGE_WON:** fire-and-forget in `_resolveOneChallenge` — Task 4
- [x] **Performance bonus:** 5-pick minimum, 65% threshold, 7-day cooldown — Task 5
- [x] **Resolution integration:** both challenge resolution and bonus called from `resolveAllOpenMarketsForToday` — Tasks 4, 5
- [x] **Query helpers:** getChallengeList (admin first), getChallengeDetail with userEntry — Task 6
- [x] **API routes:** GET list, POST create, GET detail, POST join, PATCH picks — Task 7
- [x] **Admin check:** ADMIN_EMAILS env var used in POST /api/challenges and create page — Tasks 7, 10
- [x] **Challenges list page:** ChallengeCard, empty state, create button gated by session — Task 8
- [x] **Challenge detail:** picks UI, join button, leaderboard with score/payout — Task 9
- [x] **Create form:** market selector, entry fee, payout type, admin toggle — Task 10
- [x] **Nav:** Challenges link added — Task 11
- [x] **TypeScript:** no `any`, all types derived from Prisma or explicit interfaces
