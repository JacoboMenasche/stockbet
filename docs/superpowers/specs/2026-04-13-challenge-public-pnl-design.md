# Challenge Public/Private + Trading P&L Scoring — Design Spec

**Date:** 2026-04-13  
**Status:** Approved

---

## Overview

Two features added to the challenges system:

1. **Public/Private toggle** — challenge creators choose whether their challenge appears in the public list or is invite-link only.
2. **Trading P&L scoring mode** — admin can create challenges scored by participants' realized P&L on the challenge's markets, instead of YES/NO picks.

---

## 1. Data Model

### New enums (schema.prisma)

```prisma
enum ScoringMode {
  PICKS        // score by correct YES/NO picks (existing behavior)
  TRADING_PNL  // score by realized P&L from market orders on challenge markets
}
```

### Changes to Challenge model

```prisma
model Challenge {
  // ... all existing fields unchanged ...
  isPublic    Boolean     @default(false)
  scoringMode ScoringMode @default(PICKS)
  startDate   DateTime?   @db.Date  // multi-day P&L window start; null = single betDate
}
```

**Rules:**
- `isPublic: true` → appears in the public challenges list; anyone can find and join
- `isPublic: false` → invite link only; not shown in the list (current default behavior)
- Admin challenges (`type: ADMIN`) are always created with `isPublic: true`
- `startDate` is only relevant when `scoringMode = TRADING_PNL`; if null, only trades on `betDate` count

---

## 2. Scoring Logic

### PICKS mode (unchanged)
Existing `scoreEntry()` / `rankEntries()` / `computePayouts()` functions are not modified.

### TRADING_PNL mode

At resolution time, a new `scorePnlEntries()` helper replaces `scoreEntry()` for P&L challenges:

- For each participant, query `Position.realizedPL` where:
  - `position.marketId` is one of the challenge's markets
  - `position.userId` matches the participant
- Score = sum of all matching `realizedPL` values (in cents)
- Ranking: highest P&L wins; ties broken by earlier join time (same as picks mode)

**Edge cases:**
- Participant places no trades → score = 0, ranked last
- Market not yet resolved at challenge resolution time → that position's P&L is excluded (unrealizedPL not counted)
- Negative P&L is valid and ranks below zero

---

## 3. API + Business Logic

### `createChallenge()` — `src/lib/challenges.ts`

Add params:
- `isPublic: boolean` (default `false`)
- `scoringMode: ScoringMode` (default `PICKS`)
- `startDate?: Date | null`

Admin challenges (`type: ADMIN`) override `isPublic` to `true` regardless of input.

### `POST /api/challenges` — `src/app/api/challenges/route.ts`

Accept and validate new fields:
- `isPublic: boolean` (default `false`)
- `scoringMode: "PICKS" | "TRADING_PNL"` (default `"PICKS"`)
- `startDate: string | null` (ISO date string; optional, only used with `TRADING_PNL`)

### `resolveChallengesForDate()` — `src/lib/challenges.ts`

Branch on `challenge.scoringMode`:
- `PICKS` → existing `scoreEntry()` path, no change
- `TRADING_PNL` → new `scorePnlEntries()` helper queries positions and returns P&L scores

### `getChallengeList()` — `src/lib/queries/challenges.ts`

Add filter: `isPublic: true`. Private challenges remain accessible via their slug URL but are excluded from the list.

---

## 4. UI

### `CreateChallengeForm.tsx`

Two new controls:

1. **Public/Private toggle** — "Public (anyone can find this)" vs "Private (invite link only)". Admin users creating as admin are locked to Public.
2. **Scoring mode selector** — "Picks (YES/NO)" vs "Trading P&L". When P&L is selected, an optional **Start Date** input appears for multi-day challenges.

### Challenges list page — `src/app/challenges/page.tsx`

No structural change. `getChallengeList()` now returns only public challenges. Each `ChallengeCard` shows a badge indicating scoring mode ("Picks" or "P&L").

### Challenge detail page — `src/app/challenges/[slug]/page.tsx`

When `scoringMode = TRADING_PNL`:
- The picks submission UI (YES/NO buttons) is hidden
- The leaderboard shows P&L in dollars instead of a picks score
- Instructions explain that trades placed on the challenge markets count toward the score

---

## 5. Out of Scope

- Live/real-time leaderboard during the challenge (scores finalize at resolution)
- Unrealized P&L counting toward score
- P&L scoped to all markets (challenge markets only)
