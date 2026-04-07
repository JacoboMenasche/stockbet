# Resolution Disclosure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-generated, admin-editable resolution criteria disclosures to markets, displayed on the bet detail page and managed from the admin panel.

**Architecture:** New `resolutionCriteria` nullable text field on `Market` model. New `Setting` key-value model for global AI prompt template. New admin Settings tab + generate button in Markets edit form. Server-side Claude API call for generation. Disclosure rendered below BuyPanel on market detail page.

**Tech Stack:** Prisma, Next.js App Router, Anthropic SDK (`@anthropic-ai/sdk`), React, Tailwind

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | Add `resolutionCriteria` to Market, add Setting model |
| Modify | `prisma/seed.ts` | Seed default `resolutionPrompt` setting |
| Create | `src/app/api/admin/settings/route.ts` | GET/PATCH settings API |
| Create | `src/app/api/admin/markets/[id]/generate-disclosure/route.ts` | AI disclosure generation API |
| Modify | `src/app/api/admin/markets/[id]/route.ts` | Accept `resolutionCriteria` in PATCH |
| Modify | `src/components/admin/AdminTabs.tsx` | Add Settings tab |
| Create | `src/components/admin/SettingsPanel.tsx` | Settings tab UI |
| Modify | `src/components/admin/MarketsPanel.tsx` | Add disclosure textarea + generate button in edit form |
| Modify | `src/app/admin/page.tsx` | Wire up Settings tab + fetch settings data |
| Modify | `src/app/markets/[marketId]/page.tsx` | Render resolution criteria disclosure |

---

### Task 1: Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `resolutionCriteria` field to Market model**

In `prisma/schema.prisma`, add this line after the `thresholdLabel` field (around line 123), inside the Market model:

```prisma
  resolutionCriteria String?  @db.Text   // AI-generated resolution disclosure
```

- [ ] **Step 2: Add Setting model**

In `prisma/schema.prisma`, add this new model at the end of the file (before the closing of the file, after the `EmailVerificationToken` model):

```prisma
// ─────────────────────────────────────────────────────────────────────────────
// Setting
// Key-value store for admin-configurable settings.
// ─────────────────────────────────────────────────────────────────────────────

model Setting {
  key   String @id
  value String @db.Text
}
```

- [ ] **Step 3: Run migration**

```bash
cd C:/Users/jmena/Desktop/stockbet
npx prisma migrate dev --name add-resolution-criteria-and-settings
```

Expected: Migration created and applied. Prisma client regenerated.

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add resolutionCriteria field and Setting model"
```

---

### Task 2: Seed Default Prompt Setting

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Add setting seed at the end of the main seed function**

At the end of the `main()` function in `prisma/seed.ts`, before the closing brace, add:

```typescript
  // Seed default resolution prompt setting
  await prisma.setting.upsert({
    where: { key: "resolutionPrompt" },
    update: {},
    create: {
      key: "resolutionPrompt",
      value: `Write a concise resolution disclosure for a binary prediction market. The market question is: {question}. The metric is {metricType} with a threshold of {thresholdLabel} for {companyName}. The earnings report date is {reportDate}. Explain how and when this market will be resolved, what data source will be used, and under what conditions it resolves YES vs NO. Keep it under 3 sentences. Be formal and precise like Kalshi.`,
    },
  });
  console.log("Seeded default resolution prompt setting");
```

- [ ] **Step 2: Run seed to verify**

```bash
npx tsx prisma/seed.ts
```

Expected: Seed runs without error. "Seeded default resolution prompt setting" printed.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: seed default resolution prompt setting"
```

---

### Task 3: Install Anthropic SDK

**Files:** (none — package-level)

- [ ] **Step 1: Install the package**

```bash
cd C:/Users/jmena/Desktop/stockbet
npm install @anthropic-ai/sdk
```

Expected: Package installed. `package.json` and `package-lock.json` updated.

- [ ] **Step 2: Verify ANTHROPIC_API_KEY is in .env**

Check `.env` for `ANTHROPIC_API_KEY`. If it doesn't exist, add a placeholder:

```
ANTHROPIC_API_KEY=your-key-here
```

The admin should replace `your-key-here` with a real key.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add @anthropic-ai/sdk dependency"
```

---

### Task 4: Settings API Route

**Files:**
- Create: `src/app/api/admin/settings/route.ts`

- [ ] **Step 1: Create the settings API route**

Create `src/app/api/admin/settings/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await db.setting.findMany();
  const result: Record<string, string> = {};
  for (const s of settings) {
    result[s.key] = s.value;
  }
  return NextResponse.json(result);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { key, value } = await req.json();
  if (!key || typeof value !== "string") {
    return NextResponse.json({ error: "key and value required" }, { status: 400 });
  }

  const setting = await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });

  return NextResponse.json(setting);
}
```

- [ ] **Step 2: Verify route loads**

```bash
cd C:/Users/jmena/Desktop/stockbet
npx next build --no-lint 2>&1 | tail -5
```

Expected: No build errors for this route (or start dev server and test with curl).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/settings/route.ts
git commit -m "feat: add admin settings GET/PATCH API"
```

---

### Task 5: Generate Disclosure API Route

**Files:**
- Create: `src/app/api/admin/markets/[id]/generate-disclosure/route.ts`

- [ ] **Step 1: Create the generate-disclosure API route**

Create `src/app/api/admin/markets/[id]/generate-disclosure/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const market = await db.market.findUnique({
    where: { id },
    include: { company: true, earningsEvent: true },
  });

  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }

  const promptSetting = await db.setting.findUnique({
    where: { key: "resolutionPrompt" },
  });

  if (!promptSetting) {
    return NextResponse.json(
      { error: "Resolution prompt template not configured" },
      { status: 500 }
    );
  }

  const reportDate = market.earningsEvent.reportDate.toISOString().split("T")[0];

  const prompt = promptSetting.value
    .replace(/\{question\}/g, market.question)
    .replace(/\{metricType\}/g, market.metricType)
    .replace(/\{thresholdLabel\}/g, market.thresholdLabel)
    .replace(/\{companyName\}/g, market.company.name)
    .replace(/\{reportDate\}/g, reportDate);

  const client = new Anthropic();

  const message = await client.messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const disclosure = textBlock ? textBlock.text : "";

  return NextResponse.json({ disclosure });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/markets/[id]/generate-disclosure/route.ts
git commit -m "feat: add AI disclosure generation API route"
```

---

### Task 6: Extend Market PATCH Route

**Files:**
- Modify: `src/app/api/admin/markets/[id]/route.ts`

- [ ] **Step 1: Add `resolutionCriteria` to the PATCH handler**

In `src/app/api/admin/markets/[id]/route.ts`, add this line after the `consensusEstimate` check (after line 25):

```typescript
  if (body.resolutionCriteria !== undefined) data.resolutionCriteria = body.resolutionCriteria;
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/markets/[id]/route.ts
git commit -m "feat: accept resolutionCriteria in market PATCH"
```

---

### Task 7: Settings Panel Component

**Files:**
- Create: `src/components/admin/SettingsPanel.tsx`

- [ ] **Step 1: Create the SettingsPanel component**

Create `src/components/admin/SettingsPanel.tsx`:

```tsx
"use client";

import { useState } from "react";

interface SettingsPanelProps {
  initialPrompt: string;
}

export function SettingsPanel({ initialPrompt }: SettingsPanelProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "resolutionPrompt", value: prompt }),
    });
    setLoading(false);
    if (res.ok) {
      setMessage("Saved");
    } else {
      setMessage("Failed to save");
    }
  }

  return (
    <div>
      <h2
        className="text-sm font-medium mb-4"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        AI Prompt Template
      </h2>

      <div
        className="rounded-xl border p-4 space-y-3"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          backgroundColor: "rgba(255,255,255,0.02)",
        }}
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={6}
          className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none resize-y"
          style={{
            backgroundColor: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        />
        <p
          className="text-xs"
          style={{ color: "rgba(255,255,255,0.3)" }}
        >
          Available variables: {"{question}"}, {"{metricType}"},{" "}
          {"{thresholdLabel}"}, {"{companyName}"}, {"{reportDate}"}
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-xs font-medium disabled:opacity-40"
            style={{
              backgroundColor: "rgba(167,139,250,0.2)",
              color: "#a78bfa",
              border: "1px solid rgba(167,139,250,0.3)",
            }}
          >
            {loading ? "Saving..." : "Save"}
          </button>
          {message && (
            <span
              className="text-xs"
              style={{
                color: message === "Saved" ? "#4ade80" : "#f87171",
              }}
            >
              {message}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/SettingsPanel.tsx
git commit -m "feat: add SettingsPanel admin component"
```

---

### Task 8: Add Settings Tab to AdminTabs

**Files:**
- Modify: `src/components/admin/AdminTabs.tsx`

- [ ] **Step 1: Add "settings" to the TABS array**

In `src/components/admin/AdminTabs.tsx`, change the TABS array (line 6-11) from:

```typescript
const TABS = [
  { key: "earnings", label: "Earnings" },
  { key: "markets", label: "Markets" },
  { key: "resolve", label: "Resolve" },
  { key: "sync", label: "Sync" },
] as const;
```

to:

```typescript
const TABS = [
  { key: "earnings", label: "Earnings" },
  { key: "markets", label: "Markets" },
  { key: "resolve", label: "Resolve" },
  { key: "sync", label: "Sync" },
  { key: "settings", label: "Settings" },
] as const;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/AdminTabs.tsx
git commit -m "feat: add Settings tab to admin navigation"
```

---

### Task 9: Wire Settings Tab into Admin Page

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Add import for SettingsPanel**

At the top of `src/app/admin/page.tsx`, after the SyncPanel import (line 10), add:

```typescript
import { SettingsPanel } from "@/components/admin/SettingsPanel";
```

- [ ] **Step 2: Fetch settings data when on settings tab**

After the `markets` query block (after line 41), add:

```typescript
  const settingsData = tab === "settings"
    ? await db.setting.findUnique({ where: { key: "resolutionPrompt" } })
    : null;
```

- [ ] **Step 3: Render SettingsPanel**

After the `{tab === "sync" && <SyncPanel />}` line (line 66), add:

```tsx
      {tab === "settings" && (
        <SettingsPanel initialPrompt={settingsData?.value ?? ""} />
      )}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: wire Settings tab into admin page"
```

---

### Task 10: Add Disclosure UI to MarketsPanel

**Files:**
- Modify: `src/components/admin/MarketsPanel.tsx`

- [ ] **Step 1: Add `resolutionCriteria` to the Market interface**

In `src/components/admin/MarketsPanel.tsx`, add to the `Market` interface (after line 12, inside the interface):

```typescript
  resolutionCriteria: string | null;
```

- [ ] **Step 2: Add state variables for disclosure editing**

After the existing state variables (after line 52, the `loading` state), add:

```typescript
  const [editDisclosure, setEditDisclosure] = useState("");
  const [generating, setGenerating] = useState(false);
```

- [ ] **Step 3: Update handleUpdate to include resolutionCriteria**

In the `handleUpdate` function, change the `body: JSON.stringify(...)` call (lines 59-62) from:

```typescript
      body: JSON.stringify({
        question: editQuestion,
        threshold: parseFloat(editThreshold),
        thresholdLabel: editLabel,
      }),
```

to:

```typescript
      body: JSON.stringify({
        question: editQuestion,
        threshold: parseFloat(editThreshold),
        thresholdLabel: editLabel,
        resolutionCriteria: editDisclosure || null,
      }),
```

- [ ] **Step 4: Add generate disclosure handler**

After the `handleCreate` function (after line 94), add:

```typescript
  async function handleGenerate(marketId: string) {
    setGenerating(true);
    const res = await fetch(`/api/admin/markets/${marketId}/generate-disclosure`, {
      method: "POST",
    });
    if (res.ok) {
      const { disclosure } = await res.json();
      setEditDisclosure(disclosure);
    }
    setGenerating(false);
  }
```

- [ ] **Step 5: Initialize editDisclosure when entering edit mode**

In the `onClick` handler of the Edit button (around line 257), add `setEditDisclosure(m.resolutionCriteria ?? "");` after `setEditLabel(m.thresholdLabel);`. The full handler becomes:

```typescript
                      onClick={() => {
                        setEditingId(m.id);
                        setEditQuestion(m.question);
                        setEditThreshold(String(m.threshold));
                        setEditLabel(m.thresholdLabel);
                        setEditDisclosure(m.resolutionCriteria ?? "");
                      }}
```

- [ ] **Step 6: Add disclosure textarea and generate button in edit mode**

In the table row, when `editingId === m.id`, after the threshold edit inputs (after the closing `</div>` of the threshold edit `div` around line 221), the disclosure UI needs to go in the edit form. The best place is to render it as a full-width row below the current edit row. Replace the entire `{markets.map((m) => (` table body section with:

Find the `<tbody>` block and replace it. After the existing table row for a market in edit mode, add a second row. Specifically, find:

```tsx
              <tr key={m.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
```

and replace the entire `<tr key={m.id}...>...</tr>` block (lines 190-269) with:

```tsx
              <tr key={m.id} style={{ borderBottom: editingId === m.id ? "none" : "1px solid rgba(255,255,255,0.04)" }}>
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
                        setEditDisclosure(m.resolutionCriteria ?? "");
                      }}
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
              {editingId === m.id && (
                <tr key={`${m.id}-disclosure`} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td colSpan={6} className="pb-4 pt-0 px-0">
                    <div
                      className="rounded-lg border p-3 space-y-2"
                      style={{
                        borderColor: "rgba(255,255,255,0.08)",
                        backgroundColor: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <label
                        className="text-xs font-medium block"
                        style={{ color: "rgba(255,255,255,0.4)" }}
                      >
                        Resolution Disclosure
                      </label>
                      <textarea
                        value={editDisclosure}
                        onChange={(e) => setEditDisclosure(e.target.value)}
                        rows={3}
                        placeholder="AI-generated or manually written resolution criteria..."
                        className="w-full rounded-lg px-3 py-2 text-xs text-white outline-none resize-y"
                        style={{
                          backgroundColor: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.1)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleGenerate(m.id)}
                        disabled={generating}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
                        style={{
                          backgroundColor: "rgba(56,189,248,0.15)",
                          color: "#38bdf8",
                          border: "1px solid rgba(56,189,248,0.3)",
                        }}
                      >
                        {generating ? "Generating..." : "Generate with AI"}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/MarketsPanel.tsx
git commit -m "feat: add disclosure textarea and AI generate button to MarketsPanel"
```

---

### Task 11: Display Disclosure on Bet Detail Page

**Files:**
- Modify: `src/app/markets/[marketId]/page.tsx`

- [ ] **Step 1: Add resolution criteria section below BuyPanel**

In `src/app/markets/[marketId]/page.tsx`, after the closing `)}` of the ternary that renders either BuyPanel or the "Sign in" box (after line 119), add:

```tsx
      {/* Resolution criteria disclosure */}
      {market.resolutionCriteria && (
        <div className="mt-8">
          <div
            className="h-px w-full mb-4"
            style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
          />
          <h2
            className="text-xs font-medium mb-2 uppercase tracking-wider"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            Resolution Criteria
          </h2>
          <div
            className="rounded-lg px-4 py-3"
            style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
          >
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              {market.resolutionCriteria}
            </p>
          </div>
        </div>
      )}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/markets/[marketId]/page.tsx
git commit -m "feat: display resolution criteria on bet detail page"
```

---

### Task 12: Smoke Test

- [ ] **Step 1: Start dev server**

```bash
cd C:/Users/jmena/Desktop/stockbet
npm run dev
```

- [ ] **Step 2: Test Settings tab**

Navigate to `/admin?tab=settings`. Verify:
- The prompt template textarea loads with the seeded default
- Editing and saving works (check for "Saved" feedback)

- [ ] **Step 3: Test disclosure generation**

Navigate to `/admin?tab=markets`. Click "Edit" on a market. Verify:
- The "Resolution Disclosure" textarea appears below threshold fields
- "Generate with AI" button calls the API and populates the textarea
- Saving the market persists the disclosure text

- [ ] **Step 4: Test bet detail page**

Navigate to `/markets/{marketId}` for the market you just edited. Verify:
- The "Resolution Criteria" section appears below the buy panel
- Text matches what was saved in admin

- [ ] **Step 5: Test empty state**

Navigate to a market that has no disclosure. Verify:
- No "Resolution Criteria" section is rendered

- [ ] **Step 6: Commit any fixes if needed**
