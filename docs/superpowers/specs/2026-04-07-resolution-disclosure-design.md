# Resolution Disclosure Feature

## Summary

Add an AI-generated, admin-editable resolution criteria disclosure to each market. Displayed on the bet detail page below the YES/NO buy panel, it explains how and when the market will be resolved — similar to Kalshi's resolution source section. Admins control a global AI prompt template and can generate/edit disclosures per market.

## Data Model

### New field on `Market`

```prisma
resolutionCriteria  String?   @db.Text
```

Nullable. Populated by AI generation or manual admin input. When non-null, displayed on the bet detail page.

### New `Setting` model

```prisma
model Setting {
  key    String  @id
  value  String  @db.Text
}
```

Seeded with one row:

- **key:** `resolutionPrompt`
- **value:** Default prompt template:

> Write a concise resolution disclosure for a binary prediction market. The market question is: {question}. The metric is {metricType} with a threshold of {thresholdLabel} for {companyName}. The earnings report date is {reportDate}. Explain how and when this market will be resolved, what data source will be used, and under what conditions it resolves YES vs NO. Keep it under 3 sentences. Be formal and precise like Kalshi.

### Template variables

The following placeholders are interpolated from market + related data before sending to the AI:

| Variable | Source |
|----------|--------|
| `{question}` | `market.question` |
| `{metricType}` | `market.metricType` |
| `{thresholdLabel}` | `market.thresholdLabel` |
| `{companyName}` | `market.company.name` |
| `{reportDate}` | `market.earningsEvent.reportDate` |

## API Routes

### `GET /api/admin/settings`

Returns all settings as a key-value object. Admin-only.

**Response:** `{ resolutionPrompt: "..." }`

### `PATCH /api/admin/settings`

Updates one or more settings. Admin-only.

**Body:** `{ key: string, value: string }`

### `POST /api/admin/markets/[marketId]/generate-disclosure`

Generates a resolution disclosure using Claude API. Admin-only.

**Process:**
1. Fetch the market with its company and earnings event
2. Fetch the `resolutionPrompt` setting
3. Interpolate template variables into the prompt
4. Call Anthropic API (`claude-sonnet-4-6`) with the interpolated prompt
5. Return the generated text (does NOT auto-save)

**Response:** `{ disclosure: "..." }`

### Existing `PATCH /api/admin/markets/[marketId]`

Extended to accept `resolutionCriteria` field. Saves the admin-edited disclosure text.

## Admin Panel Changes

### Markets Panel (`MarketsPanel.tsx`)

When editing a market, a new section appears below existing fields:

- **"Resolution Disclosure"** label
- A text area pre-filled with the current `resolutionCriteria` (editable)
- A **"Generate with AI"** button — calls `POST /api/admin/markets/[marketId]/generate-disclosure`, populates the text area with the result
- Loading state on the button while generating
- The text area content saves alongside other market fields via the existing PATCH endpoint

### New Settings Tab

A fifth tab **"Settings"** added to `AdminTabs.tsx`:

- **"AI Prompt Template"** label
- A text area showing the current `resolutionPrompt` value
- Below the text area, a hint showing available variables: `{question}`, `{metricType}`, `{thresholdLabel}`, `{companyName}`, `{reportDate}`
- A **"Save"** button that calls `PATCH /api/admin/settings`
- Success/error feedback message

## Bet Detail Page

In `/src/app/markets/[marketId]/page.tsx`, below the `BuyPanel` component:

- **Condition:** Only renders when `resolutionCriteria` is non-null and non-empty
- **Layout:**
  - Subtle top divider
  - "Resolution Criteria" heading — small, muted/gray text
  - Disclosure text in a styled container (muted background like `bg-white/5`, smaller font `text-sm`, `text-zinc-400`)
- **No empty state** — if no disclosure exists, nothing renders

## Dependencies

- `@anthropic-ai/sdk` npm package for Claude API calls
- `ANTHROPIC_API_KEY` environment variable

## Out of Scope

- Bulk generation of disclosures for all markets at once
- Versioning/history of disclosure edits
- Rich text / markdown in disclosures
- Per-market prompt overrides (only global prompt template)
