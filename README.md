# ReserveAI — AI-Powered Appointment Scheduling System

> An end-to-end, production-grade appointment booking platform that leverages large language models to classify enquiries, extract scheduling intent, and orchestrate a multi-step approval workflow — all without the user touching a calendar.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture](#3-architecture)
4. [Project Structure](#4-project-structure)
5. [Design System](#5-design-system)
6. [UX Improvements](#6-ux-improvements)
7. [Environment Variables](#7-environment-variables)
8. [Local Development](#8-local-development)
9. [Deployment (Render)](#9-deployment-render)
10. [Critical Technical Decisions](#10-critical-technical-decisions)
11. [Security Model](#11-security-model)
12. [Roadmap](#12-roadmap)

---

## 1. Project Overview

**ReserveAI** is a SaaS-style appointment booking system designed for service-based businesses. Instead of presenting users with a raw calendar widget, it accepts a free-text enquiry in Turkish, runs it through an AI classification layer, and — if the intent is relevant — guides the user through a three-step booking flow:

| Step | What happens |
|------|-------------|
| **Step 1 — Enquiry** | User describes their need in free text. The AI (Groq / OpenAI / Gemini, configurable) classifies the intent as `relevant` or `other` and extracts any date/time hints from the message. |
| **Step 2 — T&C** | User accepts terms. The acceptance is recorded server-side before any appointment slot is committed. |
| **Step 3 — Schedule** | User selects a date and time from a server-validated availability window. The server checks weekday constraints, the booking window, and timezone (Europe/Istanbul), then sends a receipt e-mail to the user and an asynchronous approval request to the admin. |

After submission, the admin receives an approval e-mail with one-click Approve / Reject links. The decision triggers a final e-mail to the user and, on approval, creates a Google Calendar event.

**Target audience:** Small-to-medium professional service providers (law firms, consultancies, clinics) who want an AI-first client intake without integrating a full CRM.

---

## 2. Technology Stack

### Frontend

| Library | Version | Role |
|---------|---------|------|
| React | 18.3 | UI rendering, Context API for form state |
| Vite | 5.2 | Build tool, HMR, path aliasing (`@shared`) |
| TypeScript | 5.4 | End-to-end type safety, shared schemas |
| Tailwind CSS | 3.4 | Utility-first styling with dark-mode via `html.dark` class strategy |
| react-hook-form | 7.51 | Performant, uncontrolled form management |
| Zod | 3.23 | Runtime schema validation — same schemas shared with backend via `@shared` alias |
| Axios | 1.7 | HTTP client with interceptors for error normalisation |
| Luxon | 3.4 | Timezone-aware date formatting (Europe/Istanbul) |
| lucide-react | 0.394 | Icon system |

> **Notable absence:** No React Router. Routing is implemented as a minimal path-based switch in `main.tsx`, avoiding the bundle overhead of a full router for a small number of routes.

### Backend

| Library | Version | Role |
|---------|---------|------|
| Node.js | 20 LTS | Runtime |
| Express | 4.19 | HTTP framework |
| TypeScript | 5.4 | Type safety |
| Mongoose | 8.4 | MongoDB ODM |
| Nodemailer | 6.9 | Transactional e-mail via Gmail OAuth2 (no SMTP password) |
| googleapis | 140 | Google Calendar API v3 integration |
| groq-sdk | 0.3 | Primary LLM provider (llama-3.3-70b-versatile) |
| openai | 4.47 | Optional LLM provider fallback |
| helmet | 7.1 | Security headers |
| express-rate-limit | 7.3 | Per-route rate limiting |
| winston | 3.13 | Structured logging |
| Zod | 3.23 | Request body validation |

### Infrastructure

| Service | Purpose |
|---------|---------|
| MongoDB Atlas (Free M0) | Persistent appointment storage |
| Render — Web Service | Backend (Node.js, always-on via paid tier or ping strategy) |
| Render — Static Site | Frontend (CDN-distributed, zero cold start) |
| Gmail OAuth2 | Transactional e-mail without exposing SMTP credentials |
| Google Calendar API | Automatic event creation on approval |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│                                                             │
│  PortalPage (/)  ──→  LandingPage (/randevu)                │
│       │                    │                                │
│  Role select           AppointmentContext                   │
│                         (useReducer)                        │
│                              │                              │
│               ┌──────────────┼──────────────┐              │
│             Step1          Step2           Step3            │
│          (AI classify)  (T&C accept)  (schedule)            │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS / JSON
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express API (Render)                      │
│                                                             │
│  POST /api/form/enquiry                                     │
│    └─ AiServiceFactory → GroqService | OpenAiService        │
│         └─ classify(text) → { status, extracted }           │
│                                                             │
│  POST /api/form/accept-terms                                │
│                                                             │
│  POST /api/form/schedule                                    │
│    ├─ DateValidator (weekday, window, timezone)             │
│    ├─ MailService → receipt e-mail (Nodemailer + OAuth2)    │
│    └─ ApprovalController → approval e-mail to admin         │
│                                                             │
│  GET  /api/approve/:token?action=approve|reject             │
│    ├─ Appointment.status update                             │
│    ├─ CalendarService → Google Calendar event               │
│    └─ MailService → final notification to user             │
│                                                             │
│  GET  /api/admin/*  (x-admin-key header guard)             │
└─────────────────────────┬───────────────────────────────────┘
                          │
              ┌───────────┴────────────┐
              │                        │
    MongoDB Atlas               Google APIs
   (Appointments)        (Gmail OAuth2, Calendar v3)
```

### State management — client

Form state lives in a single `AppointmentContext` (React `useReducer`), keeping all three steps loosely coupled. The context is intentionally co-located with the booking route — it is not a global provider — so it resets naturally on navigation.

### AI provider abstraction

`AiServiceFactory` reads the `AI_PROVIDER` environment variable at startup and returns the appropriate service implementation (`GroqService`, `OpenAiService`, or `GeminiService`). Swapping providers requires zero code changes.

### Shared code

The `shared/` directory (Zod schemas, date utilities, constants) is compiled once and imported by both client (`@shared` Vite alias) and server (`tsconfig.json` path mapping). This eliminates API contract drift without a full monorepo toolchain.

---

## 4. Project Structure

```
smart-app/
├── client/                    # Vite + React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/        # Navbar, Footer, StepIndicator, NavModals
│   │   │   ├── screens/       # PortalPage, LandingPage, AdminDashboard, ...
│   │   │   ├── steps/         # Step1, Step2, Step3
│   │   │   └── ui/            # Logo, ResultBanner, ...
│   │   ├── context/           # AppointmentContext (useReducer)
│   │   ├── hooks/             # useAppointment, useTheme
│   │   ├── services/          # api.ts (Axios instances)
│   │   └── validators/        # Zod form schemas (re-exports from @shared)
│   ├── public/
│   │   └── favicon.svg        # Brand SVG logo (gradient + R letterform)
│   └── index.html
│
├── server/                    # Express backend
│   └── src/
│       ├── controllers/       # FormController, ApprovalController, AdminController
│       ├── middleware/        # errorHandler, rateLimiter
│       ├── models/            # Appointment (Mongoose schema)
│       ├── routes/            # form.routes, approval.routes, admin.routes
│       ├── services/
│       │   ├── ai/            # AiService (abstract), GroqService, OpenAiService, GeminiService
│       │   ├── calendar/      # CalendarService (Google Calendar v3)
│       │   ├── mail/          # MailService (Nodemailer + Gmail OAuth2)
│       │   └── sheets/        # SheetsService (optional Google Sheets logging)
│       ├── utils/             # logger (Winston)
│       └── validators/        # Zod server-side validators
│
├── shared/                    # Isomorphic code (client + server)
│   ├── schemas.ts             # Zod schemas — single source of truth
│   ├── types.ts               # Shared TypeScript interfaces
│   ├── constants.ts           # TIME_SLOTS, BOOKING_WINDOW_DAYS, TIMEZONE
│   └── dateUtils.ts           # Luxon-based weekday filter, formatting
│
└── render.yaml                # Render Blueprint — declarative infra-as-code
```

---

## 5. Design System

ReserveAI treats the UI as a first-class concern. All interactive elements share a single, token-driven design language defined in `client/src/index.css` (@layer components) and enforced through a reusable `Button` component.

### 5.1 Component-Based Design

#### `Button` — `client/src/components/ui/Button.tsx`

A single typed component that covers every interactive call-to-action in the application:

```tsx
<Button variant="emerald" size="lg">Randevu Onayla</Button>
<Button variant="sky"     loading={true}>Giriş Yap</Button>
<Button variant="danger"  size="sm">İptal Et</Button>
<Button variant="secondary">Geri Dön</Button>
```

| Prop | Values | Default |
|------|--------|---------|
| `variant` | `primary` · `emerald` · `sky` · `danger` · `secondary` | `primary` |
| `size` | `sm` · `md` · `lg` | `md` |
| `loading` | `boolean` | — |

All other native `<button>` attributes (e.g. `onClick`, `disabled`, `type`) are forwarded as-is.

#### Compact table-action buttons — `btn-action-*`

Admin dashboard rows use a parallel set of CSS classes (`btn-action-emerald`, `btn-action-sky`, `btn-action-danger`, `btn-action-slate`) that share the same colour tokens but apply tighter padding suitable for data-dense tables.

### 5.2 Visual Consistency — Token Map

| Token | CSS class | Colour | Semantic role |
|-------|-----------|--------|---------------|
| Primary | `.btn-primary` | Brand blue (indigo-600) | General CTA |
| Emerald | `.btn-emerald` | emerald-500 / 600 | Customer-facing · approval · next-step |
| Sky | `.btn-sky` | sky-500 / 600 | Admin-facing · login · system actions |
| Danger | `.btn-danger` | red-500 / 600 | Cancel · delete · reject |
| Secondary | `.btn-secondary` | Theme-adaptive grey | Back · secondary action |

### 5.3 Interaction Standards

Every button variant enforces the same motion contract via the `.btn` base class:

```css
.btn {
  border-radius: 9999px;   /* rounded-full — consistent pill shape */
  box-shadow:    md;        /* visible depth at rest */
  transition:    all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.btn:hover  { transform: scale(1.05); }  /* tactile lift on hover  */
.btn:active { transform: scale(0.98); }  /* press-down feedback    */
```

Mobile text is always `text-center`; icon+label buttons use `gap-2` spacing so icons never crowd text at small sizes.

### 5.4 Where Each Variant Appears

| Screen | Variant used |
|--------|-------------|
| Landing page → Randevu Al CTA | `primary` (lg) |
| Step 1–3 form submit buttons | `primary` (full-width) |
| Step 2 T&C accept | `emerald` |
| Admin login | `sky` |
| Admin dashboard → Onayla | `btn-action-emerald` |
| Admin dashboard → Reddet | `btn-action-danger` |
| Admin dashboard → Tamamlandı | `btn-action-sky` |
| Admin dashboard → İptal | `btn-action-slate` |
| Modal / drawer → close | `secondary` |

---

## 6. UX Improvements

### 6.1 Navbar "Randevu Al" — Smooth Scroll Fix

The header CTA previously opened the pricing modal instead of navigating to the booking form. The fix uses a simple DOM lookup:

```ts
const scrollToBooking = () => {
  const el = document.getElementById('action-area');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    window.location.href = '/randevu'; // fallback from other pages
  }
};
```

`scroll-padding-top: 64px` on `<html>` ensures the sticky navbar height is accounted for.

### 6.2 Footer — Legal & Contact Modals

Footer links previously pointed to `href="#"` (dead links). Each link now opens a themed modal panel built entirely from existing CSS variables (`--modal-bg`, `--modal-border`, `--inset-base`), requiring zero new CSS:

| Link | Content |
|------|---------|
| Gizlilik Politikası | Data storage policy, Google API usage, deletion request flow |
| Kullanım Şartları | Service scope, user responsibilities, cancellation policy |
| İletişim | Support and info email addresses with business hours |

The modal renders as a bottom sheet on mobile (`fixed inset-x-4 bottom-0`) and a centered dialog on sm+ screens (`sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2`), with a backdrop overlay and `animate-slide-up` entrance.

### 6.3 Visual Centering

| Component | Change |
|-----------|--------|
| `PortalPage` — Customer & Admin cards | Added `items-center text-center` to card flex containers; CTA rows use `justify-center` |
| `LandingPage` — HowItWorks section | Card layout changed to `flex flex-col items-center text-center`; icon + step number stack vertically |

### 6.4 Design Token Consistency

All new interactive elements (footer modal close button, footer link buttons, navbar CTA) use the same token set as the rest of the UI:

- `rounded-full` pill shape
- `hover:scale-105 active:scale-95` motion contract
- `shadow-md` depth at rest
- `BTN_BASE` / `BTN_VARIANTS` from `Button.tsx` (no new CSS classes)

---

## 7. Environment Variables

### Backend (`server/.env`)

```env
NODE_ENV=production
PORT=10000

# AI provider — openai | gemini | groq
AI_PROVIDER=groq
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile

# Gmail OAuth2 (no plain-text password)
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_USER=you@gmail.com
ADMIN_EMAIL=you@gmail.com

# Google Calendar OAuth2
GOOGLE_CALENDAR_CLIENT_ID=...
GOOGLE_CALENDAR_CLIENT_SECRET=...
GOOGLE_CALENDAR_REFRESH_TOKEN=...
GOOGLE_CALENDAR_ID=you@gmail.com

# MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/smart-app

# Admin panel secret (sent as x-admin-key header)
ADMIN_SECRET_KEY=...

# CORS — comma-separated list of allowed origins
CLIENT_URL=https://reserveai.onrender.com

# Public URL of this server (used in approval e-mail links)
APP_BASE_URL=https://smart-app-server-xxxx.onrender.com

# Booking rules
APPOINTMENT_DURATION_MINUTES=30
BOOKING_WINDOW_DAYS=5
TIMEZONE=Europe/Istanbul

# n8n webhook URLs (optional automation layer)
N8N_WEBHOOK_URL=...
N8N_APPROVAL_WEBHOOK_URL=...
N8N_CANCELLATION_WEBHOOK_URL=...
```

### Frontend (`client/.env.production`)

```env
VITE_API_URL=https://smart-app-server-xxxx.onrender.com
VITE_ADMIN_SECRET_KEY=...
```

---

## 8. Local Development

```bash
# 1. Install dependencies
cd client && npm install
cd ../server && npm install

# 2. Copy and fill env files
cp server/.env.example server/.env
cp client/.env.example client/.env

# 3. Start backend (ts-node-dev with hot reload)
cd server && npm run dev

# 4. Start frontend (Vite HMR)
cd client && npm run dev
# → http://localhost:5173
```

The Vite dev server proxies `/api` requests to `localhost:3000` when `VITE_API_URL` is left empty, so no CORS configuration is needed locally.

---

## 9. Deployment (Render)

The entire infrastructure is declared in `render.yaml` (Render Blueprint). A single `git push` to `main` triggers both services:

| Service | Type | Build command | Publish |
|---------|------|--------------|---------|
| `smart-app-server` | Web Service (Node) | `npm install --include=dev && npm run build` | `node dist/server/src/index.js` |
| `reserveai` | Static Site | `npm install && npm run build` | `dist/` |

### Cold-start mitigation

Render's free-tier Web Services spin down after 15 minutes of inactivity, causing 30–60 second cold starts on the first request. Two complementary strategies mitigate this:

1. **External ping cron job** — A free UptimeRobot (or cron-job.org) monitor sends a `GET /health` request every 10 minutes, keeping the dyno warm without requiring a paid plan.
2. **`/health` endpoint** — The backend exposes a lightweight health check that responds in `< 5 ms` (no DB query), so the ping never counts against rate limits or distorts application metrics.

---

## 10. Critical Technical Decisions

### 9.1 `overflow: clip` on `.page-bg` — not `overflow: hidden`

The landing page uses decorative radial-gradient pseudo-elements (`::before`, `::after`) that intentionally extend outside the container (e.g., `bottom: -150px`) to create depth. Clipping them is necessary to prevent scrollable dead space below the footer.

The naive fix — `overflow: hidden` — creates a **Block Formatting Context (BFC)**, which silently breaks `position: sticky` on any descendant. The sticky Navbar would revert to static flow when the user scrolled.

`overflow: clip` was chosen instead because:
- It clips content at the container boundary, identical to `overflow: hidden` visually.
- It does **not** create a BFC, so `position: sticky` continues to function correctly.
- Browser support: Chrome 90+, Firefox 81+, Safari 16+ — acceptable for the target audience.

```css
.page-bg {
  overflow: clip; /* clips ::after bottom: -150px without breaking sticky */
}
```

### 9.2 Mobile hamburger dropdown — `absolute` inside `sticky` header

The initial implementation rendered the mobile dropdown in document flow, outside the `<header>`. When a user scrolled down and opened the menu, the sticky header sat at the top of the viewport but the dropdown rendered at the header's original scroll position — off-screen.

Moving the dropdown **inside** `<header>` as `position: absolute; top: 100%` ties it to the viewport-anchored sticky header regardless of scroll depth:

```tsx
<header style={{ position: 'sticky', top: 0, zIndex: 1000 }}>
  {/* ... */}
  {mobileOpen && (
    <div className="absolute top-full left-0 right-0 ...">
      {/* menu items always visible below header */}
    </div>
  )}
</header>
```

A `fixed inset-0` overlay (`z-index: 999`) dims the rest of the page and closes the menu on tap-outside, following standard mobile UX patterns.

### 9.3 Step-transition scroll — `useRef` guards against mount-time fire

The booking form is a three-step wizard. On each step transition the UI should scroll the form card into view. A naïve `useEffect(() => scrollIntoView(), [currentStep])` fires on **initial mount** (step 1 load), jerking the page down before the user interacts.

The fix tracks the previous step value with `useRef`. On first render the ref is `null`; the effect stores the current step and returns early, producing no scroll:

```ts
const prevStepRef = useRef<number | null>(null);
useEffect(() => {
  if (!currentStep) { prevStepRef.current = null; return; }
  if (prevStepRef.current === null) { prevStepRef.current = currentStep; return; }
  if (prevStepRef.current === currentStep) return;
  prevStepRef.current = currentStep;
  document.getElementById('booking-form-card')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}, [currentStep]);
```

`scroll-padding-top: 64px` on `<html>` ensures `scrollIntoView` accounts for the sticky navbar height.

### 9.4 AI provider strategy pattern

The server never hard-codes an LLM provider. `AiServiceFactory.create()` returns a concrete implementation based on `process.env.AI_PROVIDER`:

```
AI_PROVIDER=groq   → GroqService   (llama-3.3-70b-versatile, lowest latency)
AI_PROVIDER=openai → OpenAiService (gpt-4o-mini)
AI_PROVIDER=gemini → GeminiService (gemini-1.5-flash)
```

This allows cost/latency trade-offs to be made at deploy time with zero code changes, and enables A/B testing across providers without a feature-flag system.

### 9.5 Gmail OAuth2 over SMTP password

Nodemailer is configured with OAuth2 refresh-token credentials rather than a plain-text SMTP password. This eliminates the risk of credential leakage in logs or environment variable dumps, and survives Google's periodic "less secure app" policy tightening. The same OAuth2 credentials are reused for Google Calendar, minimising the number of secrets in rotation.

### 9.6 Isomorphic Zod schemas via `@shared`

Server-side validation and client-side form validation share identical Zod schemas from `shared/schemas.ts`. The Vite config maps `@shared` to `../../shared` at build time; the TypeScript `tsconfig.json` maps the same alias for the server. A schema change propagates to both surfaces with a single edit, making API contract drift structurally impossible.

---

## 11. Security Model

| Layer | Mechanism |
|-------|-----------|
| Transport | HTTPS enforced by Render; `helmet` sets HSTS, CSP, X-Frame-Options |
| CORS | Allowlist via `CLIENT_URL` env var; supports comma-separated multiple origins |
| Rate limiting | `express-rate-limit` — 20 req/15 min on `/api/form/*`, stricter on `/api/admin/*` |
| Admin auth | Static secret (`ADMIN_SECRET_KEY`) sent as `x-admin-key` header; no session/JWT needed for this use-case |
| Approval tokens | UUID v4 one-time tokens embedded in approval e-mail links; tokens are scoped to a single appointment and action |
| Environment secrets | All credentials live in env vars; `.env` is `.gitignore`d; `render.yaml` uses `sync: false` for secrets so they never appear in the repo |
| Input validation | Zod validators run on every request body before it reaches a controller |

---

## 12. Roadmap

### Near-term

- **Google Sheets logging** — `SheetsService` is already scaffolded; connect it to the approval flow to create an automatically maintained appointments register accessible to non-technical staff.
- **Cancellation flow** — expose the `N8N_CANCELLATION_WEBHOOK_URL` path through the UI so users can cancel confirmed appointments without contacting the admin.
- **Admin role granularity** — replace the single `ADMIN_SECRET_KEY` with a proper session model (JWT + refresh token) to support multiple admin users with audit trails.

### Medium-term

- **Google Calendar two-way sync** — poll for event deletions/modifications via Google Calendar push notifications (webhooks) and reconcile with the database, so the admin's calendar remains the single source of truth.
- **Availability engine** — replace the static `TIME_SLOTS` constant with a server-computed availability grid that reads blocked times from Google Calendar, making the booking window truly dynamic.
- **Multi-language support** — the UI is currently Turkish-only. Extract all strings into a `locale/tr.ts` dictionary as groundwork for i18n.

### Long-term

- **PWA support** — add a Web App Manifest and Service Worker to enable offline-capable, installable mobile experiences without a native app.
- **Multi-tenant architecture** — parameterise the booking rules, AI prompts, and branding per organisation so the platform can serve multiple independent service providers from a single deployment.
- **Analytics dashboard** — surface booking funnel metrics (enquiry → qualified → scheduled → approved conversion rates) directly in the admin panel.

---

## License

MIT © 2026 ReserveAI
