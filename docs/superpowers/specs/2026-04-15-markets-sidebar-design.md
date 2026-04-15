# Markets Sidebar & Trending Section Design

## Goal

Replace the TopNav navigation links with a persistent left sidebar. Add a Trending section to the markets page showing the highest-volume markets. On mobile, replace the sidebar with a bottom tab bar.

## Architecture

The global `src/app/layout.tsx` gains a two-column layout: sidebar on the left, main content on the right. The `TopNav` is simplified — nav links are removed, keeping only the logo, theme toggle, and sign-out button. A new `Sidebar` component handles all navigation. A new `BottomNav` component handles mobile navigation.

The markets page gains a `section` search param (`?section=trending` or `?section=all`) to switch between Trending and All Markets views. Default is `trending`.

## File Structure

**New files:**
- `src/components/layout/Sidebar.tsx` — desktop sidebar, client component
- `src/components/layout/BottomNav.tsx` — mobile bottom tab bar, client component

**Modified files:**
- `src/app/layout.tsx` — wrap content in sidebar layout shell
- `src/components/layout/TopNav.tsx` — remove nav links, keep logo + theme toggle + sign out
- `src/app/markets/page.tsx` — add `section` param, render Trending or All Markets view
- `src/components/markets/TrendingView.tsx` — new: hero card + 2-col grid sorted by volume
- `src/lib/queries/markets.ts` — add `getTrendingMarkets()` query (top markets by `totalVolume`)
- `src/app/globals.css` — sidebar layout CSS variables and utility classes

## Sidebar (desktop, ≥768px)

Fixed left sidebar, 220px wide, full viewport height. Sticky/fixed positioning.

**Contents (top to bottom):**
1. Logo + "Ratio Markets" brand name
2. Nav items (flat list, no sub-sections):
   - Trending → `/markets?section=trending`
   - All Markets → `/markets?section=all`
   - Challenges → `/challenges`
   - Leaderboard → `/leaderboard`
   - Portfolio → `/portfolio`
3. Spacer (flex-grow)
4. Balance pill (shows `session.user.cashBalanceCents`, green tint)
5. Theme toggle + sign-out button

Active item is highlighted with the green tint background (`rgba(148,228,132,0.12)`) and green text. Inactive items use muted text color.

The sidebar uses the existing `glass-card` visual language: frosted glass background, soft border.

## Bottom Nav (mobile, <768px)

Fixed bottom bar, full width, 5 items with icons + labels:
- Trending (TrendingUp icon)
- Markets (BarChart2 icon)
- Challenges (Trophy icon)
- Leaderboard (Medal icon)
- Portfolio (Wallet icon)

Active item uses green color. Inactive items use muted color. Bar has a frosted glass background matching the top nav style.

## TopNav (simplified)

After this change, TopNav contains only:
- Logo + brand name (left) — hidden on mobile since sidebar/bottom nav shows it
- Theme toggle (right)
- Sign-out button (right)
- Balance pill (right, hidden on mobile since bottom nav area is tight)

The nav links (`NAV_LINKS` array) are removed entirely.

## Markets Page — Trending Section

When `section=trending` (or no section param, as default):

1. **Search bar** — full width at top (existing `FeedControls` search input, sort control removed since trending is pre-sorted by volume)
2. **Hero card** — the single highest-`totalVolume` market displayed large:
   - Company ticker + name
   - Market question
   - Sparkline chart
   - YES/NO price buttons linking to the market detail page
   - Volume badge
3. **2-column grid** — remaining open markets sorted by `totalVolume` descending, each showing:
   - Ticker + question (truncated)
   - YES/NO price chips
   - Volume

When `section=all`:
- Existing list view with search + sort controls (no changes)

## Markets Page — Layout Change

The `app-container` class currently sets `max-width` and horizontal padding for full-width pages. With the sidebar taking 220px, the main content area needs to account for that width. The sidebar layout is applied at the `layout.tsx` level so all pages benefit automatically — no per-page changes needed beyond the markets page itself.

## getTrendingMarkets Query

```typescript
export async function getTrendingMarkets() {
  return db.market.findMany({
    where: { status: "OPEN" },
    orderBy: { totalVolume: "desc" },
    include: {
      company: { select: { id: true, ticker: true, name: true } },
      probabilitySnaps: {
        orderBy: { recordedAt: "desc" },
        take: 20,
      },
    },
  });
}
```

## Responsive Behavior

- **≥768px**: Sidebar visible, BottomNav hidden. Main content has left margin equal to sidebar width (220px).
- **<768px**: Sidebar hidden, BottomNav visible (fixed bottom). Main content has no left margin, bottom padding to avoid overlap with BottomNav.

## What Is Not Changing

- Market detail page (`/markets/[marketId]`)
- Portfolio, Challenges, Leaderboard pages (content unchanged)
- Trading logic, cron jobs, resolution logic
- Auth pages
