# Social & Challenges — Design Spec
**Date:** 2026-04-10  
**Status:** Approved

---

## Overview

Five features shipped at MVP scope simultaneously:

1. **Pool Challenges** — users and admins create prediction contests around daily markets
2. **Public Profiles** — per-user stats page with win rate, streak, challenge history
3. **Global Social Feed** — platform-wide activity stream
4. **Private Leagues** — invite-based or searchable groups with shared leaderboards
5. **Performance Bonus Cash** — weekly cash rewards for accurate predictors

---

## 1. Data Model

### New Prisma models

```prisma
enum ChallengeStatus { OPEN LOCKED RESOLVED VOIDED }
enum PayoutType      { WINNER_TAKES_ALL TOP_THREE_SPLIT }
enum LeagueJoinMode  { INVITE OPEN }
enum FeedEventType   { BET_PLACED CHALLENGE_WON STREAK CHALLENGE_CREATED }
enum ChallengeType   { ADMIN USER }

model Challenge {
  id            String          @id @default(cuid())
  title         String
  type          ChallengeType   @default(USER)
  creatorId     String?
  creator       User?           @relation(fields: [creatorId], references: [id])
  status        ChallengeStatus @default(OPEN)
  entryFeeCents Int             @default(0)
  payoutType    PayoutType      @default(WINNER_TAKES_ALL)
  betDate       DateTime        @db.Date
  inviteSlug    String          @unique
  createdAt     DateTime        @default(now())
  resolvedAt    DateTime?

  markets ChallengeMarket[]
  entries ChallengeEntry[]
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
  user        User      @relation(fields: [userId], references: [id])
  score       Int       @default(0)
  payout      Int       @default(0)
  rank        Int?
  createdAt   DateTime  @default(now())

  picks ChallengePick[]
  @@unique([challengeId, userId])
}

model ChallengePick {
  id        String         @id @default(cuid())
  entryId   String
  entry     ChallengeEntry @relation(fields: [entryId], references: [id])
  marketId  String
  market    Market         @relation(fields: [marketId], references: [id])
  side      Side
  correct   Boolean?
  @@unique([entryId, marketId])
}

model League {
  id         String         @id @default(cuid())
  name       String
  creatorId  String
  creator    User           @relation(fields: [creatorId], references: [id])
  joinMode   LeagueJoinMode @default(INVITE)
  inviteSlug String         @unique
  createdAt  DateTime       @default(now())

  members LeagueMember[]
}

model LeagueMember {
  id        String   @id @default(cuid())
  leagueId  String
  league    League   @relation(fields: [leagueId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  isOwner   Boolean  @default(false)
  joinedAt  DateTime @default(now())
  @@unique([leagueId, userId])
}

model FeedEvent {
  id        String         @id @default(cuid())
  userId    String
  user      User           @relation(fields: [userId], references: [id])
  eventType FeedEventType
  refId     String?        // marketId or challengeId
  metadata  Json?          // e.g. { score: 4, total: 5, payout: 1200 }
  createdAt DateTime       @default(now())
  @@index([createdAt])
}
```

### Changes to existing models

```prisma
model User {
  // add:
  username      String?   @unique
  lastBonusAt   DateTime?
  // new relations:
  challengesCreated Challenge[]
  challengeEntries  ChallengeEntry[]
  leaguesCreated    League[]
  leagueMembers     LeagueMember[]
  feedEvents        FeedEvent[]
}

model Market {
  // new relations:
  challengeMarkets ChallengeMarket[]
  challengePicks   ChallengePick[]
}
```

---

## 2. Feature Mechanics

### Challenges

**Creation flow:**
- Any user or admin navigates to `/challenges` → clicks "Create"
- Picks a title, selects markets from today's open list, sets entry fee (0 = free), selects payout type
- Server generates `inviteSlug` (nanoid), creates `Challenge` + `ChallengeMarket` rows
- Admin-created challenges get `type: ADMIN` and are featured at the top of `/challenges`

**Joining:**
- User visits `/challenges/[inviteSlug]` or finds the challenge on `/challenges`
- If `entryFeeCents > 0`, entry fee is deducted from `cashBalanceCents` atomically
- `ChallengeEntry` created immediately (no picks yet)
- User then visits the challenge page to submit picks (one `ChallengePick` per market)
- Picks can be submitted or changed any time before market close (4pm ET)

**Resolution** (runs after `resolveAllOpenMarketsForToday()`):
- For each OPEN challenge with `betDate = today`: mark status LOCKED, then resolve
- For each entry: count `ChallengePick` rows where `correct = true` → set `score`
- Rank entries by score desc, ties broken by `createdAt asc`
- Distribute pot:
  - `WINNER_TAKES_ALL`: rank-1 entry gets full pot
  - `TOP_THREE_SPLIT`: 60% / 30% / 10% to ranks 1/2/3 (if fewer than 3 entries, remainder stays with top)
- If 0 or 1 entrant: refund all entry fees, set status VOIDED
- Write `FeedEvent` (type: CHALLENGE_WON) for the winner

**Scoring:**
- Correct call = user's `ChallengePick.side` matches `Resolution.winningSide` for that market
- Unsubmitted picks (no side set) count as incorrect

### Public Profiles

- Page: `/profile/[username]`
- Stats computed at render time from DB:
  - **Win rate**: correct picks / total resolved picks (all time)
  - **Current streak**: consecutive days with at least one correct pick
  - **Challenges won**: count of rank-1 `ChallengeEntry` rows
  - **Recent picks**: last 10 `ChallengePick` rows with market + result
- Username set on signup or editable from portfolio page
- Profile is public (no auth required to view)

### Global Social Feed

- Page: `/feed`
- Queries `FeedEvent` ordered by `createdAt desc`, paginated (20 per page), infinite scroll
- Events written at:
  - Buy order filled → `BET_PLACED` (marketId in refId)
  - Challenge winner resolved → `CHALLENGE_WON` (challengeId in refId, score/payout in metadata)
  - User hits 3-day correct-call streak → `STREAK` (metadata: { streak: N })
  - Challenge created → `CHALLENGE_CREATED` (challengeId in refId)
- Feed is global — no follow system at MVP

### Private Leagues

- Page: `/leagues` — browse searchable leagues + your leagues
- Create: title, join mode (INVITE or OPEN), generates `inviteSlug`
- Join via `/leagues/join/[inviteSlug]` or search (OPEN leagues only)
- League leaderboard: sum of correct picks across all markets in the rolling last 7 days, per member
- `/leagues/[id]` shows leaderboard + member list

### Performance Bonus Cash

- Runs nightly after market resolution
- Eligibility: user has ≥5 resolved picks in last 7 days AND win rate ≥65% over that window AND `lastBonusAt` is null or >7 days ago
- Bonus: +500¢ added to `cashBalanceCents`, `lastBonusAt` updated
- No `FeedEvent` written (private reward, not public)

---

## 3. New Pages & Routes

| Path | Description |
|------|-------------|
| `/challenges` | Browse all open challenges, create button |
| `/challenges/[slug]` | Challenge detail: picks, live leaderboard |
| `/challenges/create` | Create challenge form |
| `/feed` | Global activity feed |
| `/leagues` | Browse + create leagues |
| `/leagues/[id]` | League detail: leaderboard + members |
| `/leagues/join/[slug]` | Join via invite link |
| `/profile/[username]` | Public profile page |

### Nav changes
Add **Challenges** and **Feed** to `TopNav` between Markets and Portfolio.

### Admin panel changes
Add challenge creation to admin panel with `type: ADMIN` flag. Featured challenges appear pinned at top of `/challenges`.

---

## 4. API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/challenges` | List open challenges |
| POST | `/api/challenges` | Create challenge |
| GET | `/api/challenges/[slug]` | Challenge detail + leaderboard |
| POST | `/api/challenges/[slug]/join` | Join + pay entry fee |
| PATCH | `/api/challenges/[slug]/picks` | Submit/update picks |
| GET | `/api/feed` | Paginated feed events |
| GET | `/api/leagues` | List leagues |
| POST | `/api/leagues` | Create league |
| POST | `/api/leagues/join/[slug]` | Join league |
| GET | `/api/profile/[username]` | Public profile stats |

---

## 5. Edge Cases

- **Challenge closes at 4pm ET** — joins and pick updates blocked after market close
- **Unsubmitted picks** — if a user joined but submitted no pick for a market, that market scores 0
- **0 or 1 entrant** — entry fees refunded, challenge marked VOIDED
- **Ties** — broken by `ChallengeEntry.createdAt asc` (earlier joiner wins)
- **Free challenges** — payout mechanics skipped; winner gets FeedEvent + profile stat only
- **Performance bonus gaming** — minimum 5 picks enforced; 7-day cooldown on `lastBonusAt`
- **Username not set** — profile page shows user ID fallback; prompt to set username in portfolio settings

---

## 6. Out of Scope (MVP)

- Follow system on the feed
- Challenge chat / comments
- Multi-day challenges
- League challenge integration (leagues competing in challenges)
- Push notifications
- Performance tier badges (Bronze/Silver/Gold)
