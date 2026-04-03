# Deposit System Design (Play Money)

## Goal

Give users a starting play-money balance on sign-up and a daily top-up button to add more when they run low.

## Tech Stack

- Prisma/PostgreSQL — schema change on `User`
- Next.js 15 API route — `POST /api/balance/topup`
- NextAuth session — authenticate top-up requests
- React client component — top-up UI on portfolio page

---

## Schema Changes

Add one field to the `User` model in `prisma/schema.prisma`:

```prisma
lastTopUpAt DateTime?   // null = never topped up; used to enforce 24h cooldown
```

---

## Sign-up Change

Update `src/app/api/auth/signup/route.ts` to set `cashBalanceCents: BigInt(100_000)` (= $1,000) when creating a new user, instead of `BigInt(0)`.

---

## Top-up API

**Route:** `POST /api/balance/topup`

**Auth:** Requires a valid session (401 if not signed in).

**Logic:**
1. Look up the current user by `session.user.id`
2. If `lastTopUpAt` is not null and `now - lastTopUpAt < 24 hours`, return 429 with `{ error: "...", nextTopUpAt: <ISO date> }`
3. Otherwise: increment `cashBalanceCents` by 100,000 and set `lastTopUpAt = now`
4. Return 200 with `{ cashBalanceCents: <new value>, nextTopUpAt: <ISO date> }`

**Top-up amount:** $1,000 (100,000 cents)
**Cooldown:** 24 hours

---

## UI

The portfolio page (`src/app/portfolio/page.tsx`) becomes the home for balance management. It shows:

- Current balance formatted as `$X,XXX.XX`
- **"Add $1,000"** button:
  - **Enabled** when cooldown has passed — clicking calls `POST /api/balance/topup` and refreshes the balance
  - **Disabled** with label `"Available in Xh Xm"` when cooldown is active
- Balance updates immediately in the UI after a successful top-up

The TopNav balance pill (`$0.00`) is updated to show the real `cashBalanceCents` from the DB on each page load (fetched server-side in the layout or portfolio page, passed down).

---

## Error Handling

| Scenario | Response |
|---|---|
| Not signed in | 401 Unauthorized |
| Cooldown active | 429 with `nextTopUpAt` timestamp |
| DB error | 500 with generic error message |

---

## USDC Migration Note

This design is intentionally a placeholder. When transitioning to real USDC deposits:
- `cashBalanceCents` field and all betting logic remain unchanged
- The top-up button and cooldown are removed
- Replaced by: on-chain deposit detection, per-user wallet addresses, a transaction ledger, and withdrawal signing
