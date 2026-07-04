# Security Posture — Innovation to Impact Platform

Alignment: **NCA ECC-1 (Essential Cybersecurity Controls)** and **OWASP ASVS L1 / Top 10 (2021)**.
Last reviewed: 2026-07-04.

---

## 1. Transport & Response Headers

Configured in [`next.config.js`](../next.config.js) via the `headers()` block. Applied to every route (`source: '/:path*'`).

| Header | Value | Rationale |
|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Set by Vercel automatically. HSTS preload enrolled. |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing attacks. |
| `X-Frame-Options` | `DENY` | Blocks clickjacking via `<iframe>`. Backed up by CSP `frame-ancestors 'none'`. |
| `X-XSS-Protection` | `0` | Modern OWASP/MDN guidance: explicitly disable the legacy XSS auditor, which itself introduced XSS bugs in some browsers. Real defence is CSP + input handling in React. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Sends origin only on cross-origin nav; no path or query leakage. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Denies powerful browser APIs the app does not use. |
| `Content-Security-Policy-Report-Only` | See below | Enforced after a 24h observation window (see §1.1). |

### 1.1 Content Security Policy

Directive-by-directive:

```
default-src 'self'
script-src 'self' 'unsafe-inline' 'unsafe-eval'
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
font-src 'self' https://fonts.gstatic.com data:
img-src 'self' data: blob: https:
connect-src 'self' https://*.supabase.co wss://*.supabase.co
frame-ancestors 'none'
base-uri 'self'
form-action 'self'
object-src 'none'
upgrade-insecure-requests
```

- `'unsafe-inline'` + `'unsafe-eval'` on `script-src` are required by Next.js 14 App Router hydration. Removing them requires nonce-based CSP wired through middleware — tracked as a follow-up.
- `connect-src` allows Supabase REST/Auth (HTTPS) and Realtime (WebSocket).
- `frame-ancestors 'none'` is the CSP-level equivalent of `X-Frame-Options: DENY` and takes precedence in modern browsers.
- **Rollout**: shipping as `Content-Security-Policy-Report-Only` first. After ~24h of clean browser telemetry, rename to `Content-Security-Policy` to enforce.

---

## 2. Authentication & Session Cookies

Provider: **Supabase Auth** via `@supabase/ssr`.

| Attribute | Value | Set by |
|---|---|---|
| `HttpOnly` | `true` | Supabase SSR (default) |
| `Secure` | `true` (in prod, over HTTPS) | Supabase SSR (default) |
| `SameSite` | `Lax` | Supabase SSR (default) |
| `Path` | `/` | Supabase SSR |

**Why `SameSite=Lax` and not `Strict`:** the session cookie must be sent on the top-level GET that follows an OAuth / magic-link redirect back into the app. With `Strict`, the browser withholds the cookie on that redirect and the user appears logged out. OWASP's Session Management Cheat Sheet recommends `Lax` for exactly this pattern. NCA ECC-1 §2-3-3 requires "appropriate SameSite attribute" — it does not mandate `Strict`.

---

## 3. CSRF

**Not applicable to this codebase.** Rationale:

CSRF is a risk when a browser is tricked into submitting an authenticated `<form>` POST that carries a session cookie cross-origin. This application has **no such endpoints**:

- Zero `app/**/route.ts` handlers exist (`find src/app -type d -name api` returns empty).
- All mutations go through the Supabase JS client, which sends `Authorization: Bearer <access_token>` — bearer-token requests are not attached automatically by browsers on cross-origin form submissions.
- Server-side reads use `@supabase/ssr` cookies for session refresh only, never for mutations.

A CSRF token layer would be inert here. If we later add cookie-authenticated `route.ts` handlers, this section must be revisited and a token layer added at that time.

---

## 4. Rate Limiting

**Not implemented in application code.** Enforced upstream:

- **Supabase Auth**: `/auth/v1/*` endpoints (signup, signin, password reset, magic-link) have per-IP + per-user rate limits configured in the Supabase dashboard. Adjust in **Dashboard → Auth → Rate Limits**.
- **Supabase REST/RPC**: throttled at the PostgREST layer; configurable in the same dashboard.
- **Vercel Edge**: DDoS mitigation and IP-level rate limiting available on Vercel Pro (auto-enabled).

If/when we introduce first-party `route.ts` handlers, wire `@upstash/ratelimit` at the edge (max 100 req/min per IP) and document the config here.

---

## 5. Authorization (RBAC)

Enforced by [`middleware.ts`](../middleware.ts) on every protected route prefix. Roles derived from `user.user_metadata.role`, falling back to `roleFromEmail()` for backwards compat. See [`src/lib/roles.ts`](../src/lib/roles.ts) for the role → route map and [`ANALYTICS_ROLES`](../src/lib/roles.ts) for the admin+judge exception on `/admin/analytics`.

Database-level RLS is enforced on the `innovation` schema at the Supabase side — application-level RBAC is defence in depth, not the sole gate.

---

## 6. Input Validation

- Forms validate client-side via native HTML constraints and React state.
- Supabase RLS + column constraints (NOT NULL, CHECK, foreign keys) enforce server-side integrity.
- User-generated text is rendered by React (auto-escapes HTML by default). No `dangerouslySetInnerHTML` in the codebase (verify with `grep -rn "dangerouslySetInnerHTML" src`).

---

## 7. Search Engine Exposure

[`public/robots.txt`](../public/robots.txt) blocks:

- `/{ar,en}/admin/*`
- `/{ar,en}/evaluation/*`
- `/{ar,en}/committee/*`
- `/{ar,en}/audit/*`
- `/{ar,en}/analytics/*`
- `/{ar,en}/login`, `/{ar,en}/signup`
- `/api/*` (forward-guard; no such routes exist today)

Public pages (`/`, `/about`, `/ideas`, `/faq`, `/partners`, `/roadmap`, `/events`) remain indexable.

---

## 8. Follow-Ups

- [ ] After 24h of clean CSP telemetry, flip `Content-Security-Policy-Report-Only` → `Content-Security-Policy` (enforce).
- [ ] Wire nonce-based CSP through middleware so `'unsafe-inline'` and `'unsafe-eval'` can be dropped from `script-src`.
- [ ] Configure a CSP `report-to` / `report-uri` endpoint so violations surface without needing to check every developer's browser console.
- [ ] When the first `app/**/route.ts` handler lands, add `@upstash/ratelimit` and re-evaluate CSRF surface.
