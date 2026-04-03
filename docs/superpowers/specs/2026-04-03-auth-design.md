# Auth System Design

## Goal

Add user authentication to Ratio Markets using NextAuth v5 with email/password and Google OAuth, including email verification via Resend.

## Tech Stack

- **NextAuth v5 (Auth.js)** — session management, Google OAuth, Credentials provider
- **@auth/prisma-adapter** — connects NextAuth to the existing Prisma/PostgreSQL DB
- **bcryptjs** — password hashing
- **Resend** — transactional email for verification links

---

## Schema Changes

Add to `prisma/schema.prisma`:

**Fields on existing `User` model:**
- `password String?` — nullable; Google users don't have a password
- `emailVerified DateTime?` — null means unverified; set by Google automatically, set manually after email confirmation

**New models required by NextAuth Prisma adapter:**
- `Account` — stores OAuth provider tokens per user (Google, etc.)
- `Session` — DB-backed session records; token lives in secure httpOnly cookie
- `VerificationToken` — stores short-lived tokens for email confirmation links

---

## Auth Flows

### Google OAuth
1. User clicks "Continue with Google"
2. NextAuth handles the OAuth redirect
3. On first login, NextAuth creates `User` + `Account` records automatically
4. `emailVerified` is set to `now()` — Google already verifies emails
5. User lands on `/markets`

### Email/password sign-up
1. User submits sign-up form (email, display name, password, confirm password)
2. `POST /api/auth/signup`:
   - Validates inputs
   - Checks email not already taken
   - Creates `User` with bcrypt-hashed password and `emailVerified: null`
   - Creates `VerificationToken` (random token, 24h expiry)
   - Sends verification email via Resend with link to `/api/auth/verify-email?token=xxx`
3. User is redirected to `/auth/verify-email` ("Check your inbox" page)
4. User clicks link → `GET /api/auth/verify-email?token=xxx`:
   - Looks up token, checks not expired
   - Sets `emailVerified = now()` on the user
   - Deletes the `VerificationToken`
   - Redirects to `/auth/signin?verified=1`

### Email/password sign-in
1. User submits email + password
2. NextAuth Credentials provider:
   - Looks up user by email
   - Compares bcrypt hash
   - Rejects with "Please verify your email first" if `emailVerified` is null
   - Rejects with "Invalid email or password" if credentials don't match
3. On success, creates a DB session and sets the session cookie
4. User lands on `/markets`

---

## Pages

All under `src/app/auth/`:

| Route | Purpose |
|---|---|
| `/auth/signin` | Email/password form + "Continue with Google" button + link to sign-up |
| `/auth/signup` | Registration form: email, display name, password, confirm password |
| `/auth/verify-email` | Static "Check your inbox" confirmation page shown after sign-up |

---

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth catch-all: Google OAuth, sign-in, sign-out |
| `/api/auth/signup` | POST | Create user, hash password, send verification email |
| `/api/auth/verify-email` | GET | Validate token, activate account, redirect to sign-in |

---

## Middleware

`src/middleware.ts` using NextAuth's built-in middleware:

- Protects all routes by default
- Public routes (no auth required): `/`, `/markets`, `/markets/*`, `/company/*`, `/auth/*`, `/api/auth/*`
- Unauthenticated users on protected routes → redirect to `/auth/signin`

---

## Starting Balance

New users start with `cashBalanceCents = 0`. No play money is seeded automatically.

---

## Error Handling

| Scenario | Response |
|---|---|
| Email already registered | 409 with "An account with this email already exists" |
| Passwords don't match | 400 (validated client-side first) |
| Unverified email at sign-in | Credentials provider returns null; NextAuth shows "Please verify your email first" |
| Expired/invalid verification token | Redirect to `/auth/signin?error=invalid-token` |
| Resend API failure | Log error server-side; user sees "Failed to send verification email, please try again" |
