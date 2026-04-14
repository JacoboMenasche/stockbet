# Agent Context and Frontend Design Policy

This document defines the required context and decision rules for any agent working on this repository.

## Primary design source of truth

`design_spec_sheet.pdf` is the **primary and authoritative source** for all frontend design decisions.

### Design source hierarchy

1. `design_spec_sheet.pdf` (authoritative)
2. `design_spec_sheet.md` (readable mirror of the PDF)
3. Existing implementation in `src\` (only when consistent with the spec)

If implementation and spec conflict, the spec wins unless the user explicitly overrides it.

## Required workflow for frontend work

1. Review `design_spec_sheet.pdf` (or `design_spec_sheet.md`) before any visual/UI decision.
2. Follow the spec for layout, spacing, typography, color, components, and interactions.
3. Keep UI changes consistent with existing patterns unless the spec requires a change.
4. If a required detail is missing from the spec, prefer consistency with neighboring components and document the assumption.
5. Record intentional deviations in PR/commit notes with a clear reason.

## Project context

- App type: Next.js web app (`next@15`, `react@19`, TypeScript)
- Styling: Tailwind CSS
- Data layer: Prisma
- Auth: NextAuth
- Charts/UI libs in use: Recharts, Lucide

## Key paths

- Design spec (source): `design_spec_sheet.pdf`
- Design spec (readable): `design_spec_sheet.md`
- Design page assets: `docs\design_spec_sheet_pages\`
- Application code: `src\`
- Prisma schema and DB scripts: `prisma\`

## Common commands

- Dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Tests: `npm run test`
- Prisma generate: `npm run db:generate`
- Prisma migrate: `npm run db:migrate`

## Implementation guardrails

1. Do not make frontend design choices without checking the spec first.
2. Preserve behavior unless a change is explicitly required.
3. Keep changes scoped and avoid unrelated refactors.
4. Prefer explicit errors over silent fallbacks.
