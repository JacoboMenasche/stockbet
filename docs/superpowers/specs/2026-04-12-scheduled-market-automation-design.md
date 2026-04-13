# Scheduled Market Automation Design

## Goal

Automatically create daily markets at 9:30 AM ET and resolve them at 4:00 PM ET on weekdays, using GitHub Actions scheduled workflows that run scripts directly against the Neon database.

## Architecture

GitHub Actions triggers two jobs on a cron schedule. Each job checks out the repo, installs dependencies, generates the Prisma client, and runs a small TypeScript runner script using `tsx`. The scripts import existing library functions and call them directly — no HTTP server required. Database credentials are stored as GitHub repository secrets.

## Components

### Runner Scripts

**`scripts/run-create-markets.ts`**
- Imports `createDailyMarkets` from `src/lib/create-daily-markets`
- Calls it and logs success/failure
- Exits with code 1 on error so GitHub Actions marks the job as failed

**`scripts/run-resolve-markets.ts`**
- Imports `resolveAllOpenMarketsForToday` from `src/lib/resolve-markets`
- Calls it and logs success/failure
- Exits with code 1 on error

Both scripts use `dotenv` to load environment variables (for local testing) and rely on `DATABASE_URL` and `FMP_API_KEY` being set in the environment.

### GitHub Actions Workflow

**`.github/workflows/scheduler.yml`**

Two jobs, both running on `ubuntu-latest`, weekdays only:

| Job | Cron (UTC) | ET equivalent |
|---|---|---|
| `create-markets` | `30 14 * * 1-5` | 9:30 AM EST / 10:30 AM EDT |
| `resolve-markets` | `0 21 * * 1-5` | 4:00 PM EST / 5:00 PM EDT |

Each job:
1. `actions/checkout@v4`
2. `actions/setup-node@v4` (Node 20, npm cache)
3. `npm ci`
4. `npx prisma generate`
5. `npx tsx scripts/run-<name>.ts`

Environment variables injected from GitHub secrets: `DATABASE_URL`, `FMP_API_KEY`.

### DST Note

GitHub Actions uses UTC. These cron times are fixed — they shift by 1 hour when daylight saving changes. In summer (EDT), create-markets runs at 10:30 AM ET and resolve-markets at 5:00 PM ET. Both are still within acceptable windows (before market close / after market close).

## Required GitHub Secrets

| Secret | Already set? | Used by |
|---|---|---|
| `DATABASE_URL` | Yes (CI uses it) | Both scripts |
| `FMP_API_KEY` | No — needs to be added | resolve-markets |

## Local Testing

Both scripts can be run locally with:
```bash
npx tsx scripts/run-create-markets.ts
npx tsx scripts/run-resolve-markets.ts
```

Requires a `.env` file with `DATABASE_URL` and `FMP_API_KEY` set.

## Error Handling

- Scripts exit with code 1 on uncaught errors — GitHub Actions marks the job red and sends a notification email
- `createDailyMarkets` is idempotent — re-running on the same day skips already-created markets
- `resolveAllOpenMarketsForToday` logs per-market failures and continues — partial resolution is better than none
