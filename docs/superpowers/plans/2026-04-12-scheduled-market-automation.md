# Scheduled Market Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically create daily markets at 9:30 AM ET and resolve them at 4:00 PM ET on weekdays via GitHub Actions workflows that run scripts directly against the Neon database.

**Architecture:** Two small runner scripts in `scripts/` import existing library functions (`createDailyMarkets`, `resolveAllOpenMarketsForToday`) and call them directly with the database connection from environment variables. A new GitHub Actions workflow file defines two cron-scheduled jobs — one per script — that run on weekdays only.

**Tech Stack:** TypeScript, tsx, dotenv, GitHub Actions cron, Prisma, existing `src/lib/create-daily-markets.ts` and `src/lib/resolve-markets.ts`.

---

### Task 1: Create the market creation runner script

**Files:**
- Create: `scripts/run-create-markets.ts`

- [ ] **Step 1: Create the script**

```typescript
// scripts/run-create-markets.ts
import * as dotenv from "dotenv";
dotenv.config();

import { createDailyMarkets } from "../src/lib/create-daily-markets";

async function main() {
  console.log("[scheduler] Starting daily market creation...");
  await createDailyMarkets();
  console.log("[scheduler] Market creation complete.");
}

main().catch((err) => {
  console.error("[scheduler] Market creation failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run it locally to verify it works**

```bash
npx tsx scripts/run-create-markets.ts
```

Expected: console output showing market creation logs per company, no errors. If markets already exist for today, you'll see "already exists — skipping" messages which is correct (idempotent).

- [ ] **Step 3: Commit**

```bash
git add scripts/run-create-markets.ts
git commit -m "feat: add run-create-markets runner script"
```

---

### Task 2: Create the market resolution runner script

**Files:**
- Create: `scripts/run-resolve-markets.ts`

- [ ] **Step 1: Create the script**

```typescript
// scripts/run-resolve-markets.ts
import * as dotenv from "dotenv";
dotenv.config();

import { resolveAllOpenMarketsForToday } from "../src/lib/resolve-markets";

async function main() {
  console.log("[scheduler] Starting market resolution...");
  await resolveAllOpenMarketsForToday();
  console.log("[scheduler] Market resolution complete.");
}

main().catch((err) => {
  console.error("[scheduler] Market resolution failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run it locally to verify it works**

```bash
npx tsx scripts/run-resolve-markets.ts
```

Expected: console output showing resolution logs. If no markets are open for today, you'll see no output from the inner loop — that's correct. If `FMP_API_KEY` is not in your `.env`, you'll see a "FMP_API_KEY is not set" error — add it before testing.

- [ ] **Step 3: Commit**

```bash
git add scripts/run-resolve-markets.ts
git commit -m "feat: add run-resolve-markets runner script"
```

---

### Task 3: Create the GitHub Actions scheduler workflow

**Files:**
- Create: `.github/workflows/scheduler.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
# .github/workflows/scheduler.yml
name: Scheduler

on:
  schedule:
    # Create markets: 9:30 AM EST (14:30 UTC) / 10:30 AM EDT — weekdays only
    - cron: "30 14 * * 1-5"
    # Resolve markets: 4:00 PM EST (21:00 UTC) / 5:00 PM EDT — weekdays only
    - cron: "0 21 * * 1-5"
  workflow_dispatch:
    inputs:
      job:
        description: "Which job to run manually"
        required: true
        type: choice
        options:
          - create-markets
          - resolve-markets

env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  FMP_API_KEY: ${{ secrets.FMP_API_KEY }}

jobs:
  create-markets:
    if: github.event_name == 'workflow_dispatch' && github.event.inputs.job == 'create-markets' || github.event_name == 'schedule' && github.event.schedule == '30 14 * * 1-5'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npx prisma generate
      - run: npx tsx scripts/run-create-markets.ts

  resolve-markets:
    if: github.event_name == 'workflow_dispatch' && github.event.inputs.job == 'resolve-markets' || github.event_name == 'schedule' && github.event.schedule == '0 21 * * 1-5'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npx prisma generate
      - run: npx tsx scripts/run-resolve-markets.ts
```

Note: `workflow_dispatch` lets you trigger either job manually from the GitHub Actions UI — useful for testing and for running the creation job right now to populate today's markets.

- [ ] **Step 2: Verify the workflow file is valid YAML**

```bash
npx js-yaml .github/workflows/scheduler.yml
```

Expected: prints the parsed object with no errors. If `js-yaml` is not installed: `npm install -g js-yaml` first, or just check that indentation looks correct visually.

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/scheduler.yml
git commit -m "feat: add GitHub Actions scheduler for market creation and resolution"
git push origin main
```

---

### Task 4: Add FMP_API_KEY to GitHub repository secrets

**Files:** None — this is a GitHub settings step.

- [ ] **Step 1: Get your FMP API key**

It should be in your local `.env` file as `FMP_API_KEY=re_...`. If not, retrieve it from your FMP account dashboard.

- [ ] **Step 2: Add the secret to GitHub**

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `FMP_API_KEY`
5. Value: your FMP API key
6. Click **Add secret**

- [ ] **Step 3: Verify DATABASE_URL is already set**

On the same page, confirm `DATABASE_URL` is listed. It was added during the CI setup and is reused here.

---

### Task 5: Smoke test via workflow_dispatch

**Files:** None — this is a GitHub Actions manual trigger test.

- [ ] **Step 1: Trigger create-markets manually**

1. Go to your repository on GitHub
2. Click **Actions** → **Scheduler** workflow
3. Click **Run workflow**
4. Select `create-markets` from the dropdown
5. Click **Run workflow**

Expected: the job goes green within ~60 seconds. Check the logs — you should see market creation output per company.

- [ ] **Step 2: Verify markets appear in your local app**

```bash
npm run dev
```

Open `http://localhost:3000/markets` — markets for today's companies should now be visible.

- [ ] **Step 3: (Optional) Trigger resolve-markets manually**

Only do this after 4:00 PM ET on a weekday when markets are open. Follow the same steps as above but select `resolve-markets`. Check that markets move to RESOLVED status in the app.
