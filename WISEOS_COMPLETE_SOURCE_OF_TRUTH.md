# WiseOS — Complete Project & Design Source of Truth

> **Purpose:** This document is the authoritative reference for integrating, presenting, and maintaining WiseOS inside NobleArc. It describes the product, the code architecture, the design system, the AI grading pipeline, the data model, the API surface, and the confidentiality rules that govern what may be shown publicly.
>
> **Scope:** WiseOS pilot codebase (Next.js 14 + FastAPI + SQLite), monorepo at `c:\Users\sfpri\Desktop\wiseos_demo`.
>
> **For another AI:** Use this file as the single source of truth. Do not infer details that are not listed here; verify against the referenced source files when in doubt.

---

## 1. Product Identity & Value Proposition

**Name:** WiseOS  
**Legal entity:** Wisecast AB  
**Tagline / positioning:** AI-driven rättningsplattform för STEM (AI-driven grading platform for STEM).  
**Core purpose:** Reduce teacher time spent grading handwritten or digital math and science submissions by automating OCR, mathematical verification, rule application, and pedagogical feedback.

**Primary user:** Teachers / educators who create assignments, upload student answers, review AI-generated results, and publish feedback.

**Pilot value loop:**
1. Teacher creates an assignment (problem + correct answer + grading rules).
2. Students submit handwritten or typed answers.
3. OCR converts handwriting/image to LaTeX/text.
4. Wolfram Alpha verifies mathematical equivalence against the correct answer.
5. Class-specific rules are applied to map verification results to a verdict.
6. An LLM produces concise, pedagogical feedback.
7. Conditional automation flags low-confidence submissions for manual review.
8. Teacher publishes results for the class.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 14, React 18, TypeScript, Tailwind CSS, Zustand) │
│  App Router, dark/light theme, experimental-ui design system        │
│  Local URL: http://localhost:3001                                   │
├─────────────────────────────────────────────────────────────────────┤
│  Backend (FastAPI, SQLAlchemy, Pydantic, SQLite)                    │
│  Local URL: http://localhost:8000                                   │
├─────────────────────────────────────────────────────────────────────┤
│  AI Services (API keys required, see §16)                           │
│  OCR: Mathpix → vision OCR fallbacks (Gemini / OpenRouter)          │
│  Math verification: Wolfram Alpha                                   │
│  Pedagogical feedback: Anthropic Claude → OpenAI → Gemini           │
└─────────────────────────────────────────────────────────────────────┘
```

**Package manager:** `pnpm` with workspaces `apps/*` and `packages/*`.  
**Front-end framework:** Next.js 14.2.13 (`app/` router).  
**State management:** Zustand (`apps/web/lib/store.ts`).  
**Styling:** Tailwind CSS 3.x, custom `experimental-ui` token system, `framer-motion` for animations.  
**Back-end framework:** FastAPI 0.x with Pydantic validation.  
**Database:** SQLite (`apps/api/wiseos.db`) via SQLAlchemy ORM.  
**Authentication:** JWT Bearer tokens (`python-jose`), bcrypt password hashing (`passlib[bcrypt]`).

---

## 3. Monorepo & Key Files

```
wiseos_demo/
├── .env                          # Local secrets (DO NOT COMMIT / DO NOT EXPOSE)
├── .env.example                  # Public template for required variables
├── package.json                  # pnpm workspaces, dev:web / build:web scripts
├── pnpm-workspace.yaml           # apps/*, packages/*
├── README.md                     # Human onboarding and roadmap
├── WISEOS_COMPLETE_SOURCE_OF_TRUTH.md   # This file
│
├── apps/
│   ├── web/                      # Next.js 14 frontend
│   │   ├── app/                  # App Router pages
│   │   ├── components/           # Application components (Sidebar, Onboarding, Workbench, …)
│   │   ├── experimental-ui/      # Design system (tokens, typography, Button, Card, …)
│   │   ├── lib/                  # Zustand store, API client, theme hook
│   │   ├── public/               # Static assets
│   │   ├── app/globals.css       # Base CSS, dark variables, print styles
│   │   ├── app/layout.tsx        # Root layout, fonts, ThemeProvider, Sidebar, Onboarding
│   │   ├── tailwind.config.ts    # Tailwind theme customisation
│   │   └── package.json          # Next.js, React, Zustand, framer-motion, Tailwind
│   └── api/                      # FastAPI backend
│       ├── app/
│       │   ├── main.py           # FastAPI entry point, routers, CORS, /api/v1/grade alias
│       │   ├── config.py         # Pydantic Settings, environment variables
│       │   ├── db.py             # SQLAlchemy engine, init, lightweight migrations
│       │   ├── models.py         # ORM models (User, Teacher, Assignment, Submission)
│       │   ├── schemas.py        # Pydantic request/response schemas
│       │   ├── routers/          # FastAPI routers (auth, assignments, submissions, ocr, wolfram_test, batch)
│       │   └── services/         # Business logic (auth, batch_pipeline, wolfram, ocr, feedback)
│       ├── requirements.txt      # Python dependencies
│       └── wiseos.db             # SQLite database (generated at runtime)
└── packages/                     # (empty in current pilot; reserved for shared packages)
```

---

## 4. Design System — `experimental-ui`

**Source of truth files:**
- `apps/web/experimental-ui/tokens.ts`
- `apps/web/experimental-ui/typography.tsx`
- `apps/web/experimental-ui/index.ts`
- `apps/web/experimental-ui/components/Button.tsx`
- `apps/web/experimental-ui/components/Card.tsx`
- `apps/web/tailwind.config.ts`
- `apps/web/app/globals.css`

**Design philosophy:** Apple Vision Pro / Linear / Vercel inspired, combined with Scandinavian minimalism. Premium, frosted-glass surfaces, muted rose/purple brand, ultra-soft shadows, generous whitespace, and tactile micro-interactions.

**Important isolation rule:** `experimental-ui/index.ts` states that this system is isolated to `/design-lab` and must not be imported into production routes. The production app currently uses its own Tailwind + globals.css styles, but the visual language is governed by the same tokens.

### 4.1 Color Tokens (`tokens.ts`)

| Token | Hex / Value | Usage |
|-------|-------------|-------|
| `background` | `#FAF9F7` | Page background |
| `surface` | `#FFFFFF` | Cards, raised surfaces |
| `primary` | `#9B5A97` | Brand purple, primary actions |
| `primaryHover` | `#8A4E87` | Hover state |
| `primaryMuted` | `#F0E8F0` | Light purple tints |
| `text` | `#1C1A1E` | Primary text |
| `textSecondary` | `#57525A` | Secondary text |
| `textTertiary` | `#8A858D` | Muted text, placeholders |
| `textInverse` | `#FFFFFF` | Text on dark/primary |
| `border` | `#E8E2EC` | Default borders |
| `borderSubtle` | `#F0ECF2` | Divider lines |
| `borderFocus` | `#9B5A97` | Focus rings |
| `accent` | `#F0E8F0` | Accent backgrounds |
| `accentHover` | `#E8DDE8` | Accent hover |
| `success` | `#2D8A5F` / `successMuted` `#E8F5EE` | Correct / success states |
| `warning` | `#B8860B` / `warningMuted` `#FDF6E3` | Warnings / low confidence |
| `error` | `#C74E4E` / `errorMuted` `#FCE8E8` | Errors / rejection |
| `info` | `#4A7FB8` / `infoMuted` `#E8F0F8` | Information |
| `glass` | `rgba(255,255,255,0.72)` | Glass surfaces |
| `glassBorder` | `rgba(255,255,255,0.18)` | Glass borders |

**Shadow tokens:** `shadowXs`, `shadowSm`, `shadowMd`, `shadowLg`, `shadowXl`, `shadowPrimary`. Values are `0 offset-x offset-y rgba(28,26,30, alpha)` with subtle, desaturated blacks.

### 4.2 Tailwind Extended Colors (`tailwind.config.ts`)

**`wise` scale (primary):**
- `500` `#9B5A97` brand
- `600` `#875085` hover
- `700` `#6d4169` active
- Background tints `50`–`200`, dark accents `800`–`950`.

**`ink` neutral text scale:**
- `DEFAULT` `#1e293b`
- `light` `#475569`
- `muted` `#64748b`

**Custom shadows:** `soft`, `card`, `elevated`, `glow`.

### 4.3 Typography Tokens

**Font families:**
- Sans: `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- Mono: `"JetBrains Mono", "SF Mono", Monaco, monospace`
- Handwriting: `Caveat` (imported in `layout.tsx` for student-answer print styling).

**Type scale (rem):** `textXs` 0.75, `textSm` 0.8125, `textBase` 0.875, `textMd` 0.9375, `textLg` 1.0, `textXl` 1.125, `text2xl` 1.375, `text3xl` 1.75, `text4xl` 2.25, `text5xl` 3.0.

**Weights:** 400 normal, 500 medium, 600 semibold, 700 bold.

**Letter spacing:** `-0.03em` tighter, `-0.015em` tight, `0` normal, `0.025em` wide.

**Line heights:** 1.2 tight, 1.35 snug, 1.5 normal, 1.625 relaxed.

### 4.4 Spacing, Radius, Animation, Z-Index

**Spacing scale:** `0.125rem` (2px) increments at the low end, then `0.25`, `0.5`, `0.75`, `1`, `1.25`, `1.5`, `2`, `2.5`, `3`, `4`, `5`, `6`, `8`, `10`, `12`, `16`, `20`, `24` rem.

**Radius scale:** `sm` 0.375rem, `md` 0.5rem, `lg` 0.75rem, `xl` 1rem, `2xl` 1.25rem, `full`.

**Animation:** Fast `150ms`, base `200ms`, slow `300ms`, slower `400ms`. Easings: `cubic-bezier(0.4, 0, 0.2, 1)` default, spring `cubic-bezier(0.34, 1.56, 0.64, 1)`. Framer Motion is the primary driver.

**Z-index scale:** dropdown 1000 → sticky 1020 → fixed 1030 → modalBackdrop 1040 → modal 1050 → popover 1060 → tooltip 1070.

### 4.5 Key Reusable Components

| Component | File | Capability |
|-----------|------|------------|
| `Button` | `experimental-ui/components/Button.tsx` | Variants `primary/secondary/ghost/danger`, sizes `sm/md/lg`, icons, loading, press/hover animations |
| `Card` | `experimental-ui/components/Card.tsx` | Variants `default/elevated/outlined/glass`, padding, hover, subcomponents `Header`, `Content`, `Footer`, `Stat` |
| Typography set | `experimental-ui/typography.tsx` | `DisplayXL`, `Heading1`–`Heading6`, `BodyLarge`/`Body`/`BodySmall`, `Caption`, `Code`, `Label` |
| `LineIcon` | `components/LineIcon.tsx` | 21 custom SVG stroke icons and a Sigma glyph |
| `Sidebar` | `components/Sidebar.tsx` | Fixed 240px, frosted glass, nav links, active state, theme toggle, system status |
| `Onboarding` | `components/Onboarding.tsx` | Product tour modal, controlled by `localStorage` key `wiseos_onboarding_completed` |

---

## 5. Frontend Pages, Routes & UX

**Source files:** `apps/web/app/**/*`.

### 5.1 Route Map

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Dashboard: grading status, time saved, class list, recent activity |
| `/classes` | `app/classes/page.tsx` | List all classes with create action |
| `/classes/new` | `app/classes/new/page.tsx` | Create a new class (name, subject, grade level, rules) |
| `/classes/[id]` | `app/classes/[id]/page.tsx` | Class detail: tabs for Tests, Course overview matrix, Settings |
| `/courses` | `app/courses/page.tsx` | List courses |
| `/courses/[id]` | `app/courses/[id]/page.tsx` | Course detail with associated classes |
| `/review` | `app/review/page.tsx` | Review AI-graded exams via `ReviewWorkbench` |
| `/results` | `app/results/page.tsx` | Published results view |
| `/settings` | `app/settings/page.tsx` | Theme, account, onboarding reset, help, about |
| `/design-lab` | `app/design-lab/page.tsx` | Isolated playground for experimental UI components |

### 5.2 Layout & Global UX

- `app/layout.tsx` sets metadata, viewport, imports `Inter` and `Caveat` from Google Fonts, wraps the app in `ThemeProvider`, `Onboarding`, and `Sidebar`.
- `lib/theme.tsx` provides `useTheme` for `light`/`dark` mode, persisted in `localStorage`.
- `app/globals.css` defines base variables for dark mode, custom scrollbars, print-specific styles (watermark, page breaks, student handwriting rendering via `Caveat`).
- Onboarding is driven by `wiseos_onboarding_completed` in `localStorage`.

### 5.3 Core UX Flows

**A. Class creation & assignment setup**
1. Teacher navigates `/classes/new`.
2. Enters class name, subject, grade level.
3. Defines grading parameters: partial credit, show work required, significant figures, unit error penalty, rounding tolerance, custom free-text rules.
4. Saves class → creates an `Assignment` linked to teacher.

**B. New test / grading wizard**
1. From `/classes/[id]` the `GradingWizard` is triggered.
2. Teacher selects problem, correct answer, upload images or enter text.
3. Frontend calls backend batch pipeline.

**C. Review & publish**
1. `/review` loads `ReviewWorkbench` with pending and AI-graded submissions.
2. Low-confidence items are pre-flagged (`requires_review=true`).
3. Teacher edits scores/feedback, marks approved/rejected.
4. `/results` shows published results after approval.

---

## 6. Backend Architecture

**Source files:** `apps/api/app/**/*`.

### 6.1 FastAPI Application (`main.py`)

- **Title:** `wiseOS API`
- **Version:** `0.1.0`
- **Description:** `AI-driven rättningsplattform för STEM (Wisecast AB)`
- **CORS:** Development-only regex `http://(localhost|127\.0\.0\.1)(:\d+)?` with `allow_methods="*"` and `allow_headers="*"`. Must be locked down in production.
- **Routers included:** `auth`, `assignments`, `submissions`, `ocr`, `wolfram_test`, `batch`.
- **Alias endpoint:** `POST /api/v1/grade` maps to `quick_grade` from the submissions router for stateless grading (per mega-prompt request).
- **Health:** `GET /health` returns `{"status":"ok"}`.
- **Root:** `GET /` returns metadata plus `integration_status()`.

### 6.2 Database Models (`models.py`)

All tables use UUID primary keys (`String(36)`) generated by `_uuid()`.

| Model | Key Fields | Relationships |
|-------|------------|---------------|
| `User` | `id`, `email` (unique), `password_hash`, `full_name`, `is_active`, `created_at` | One-to-one with `Teacher` |
| `Teacher` | `id`, `user_id` (FK, unique), `email`, `school_name`, `subscription_tier` (default `trial`), `created_at` | One-to-one `User`; one-to-many `Assignment` |
| `Assignment` | `id`, `teacher_id` (FK), `title`, `subject`, `grade_level`, `problem_text`, `correct_answer`, `created_at` | Many-to-one `Teacher`; one-to-many `Submission` |
| `Submission` | `id`, `assignment_id` (FK), `student_name`, `answer_text`, `student_pseudonym`, `score`, `ai_feedback`, `wolfram_verification` (JSON), `graded_at`, plus confidence/review fields | Many-to-one `Assignment` |

**Conditional Automation / Confidence fields on `Submission`:**
- `ocr_confidence` (Float)
- `wolfram_confidence` (Float)
- `confidence_overall` (Float)
- `requires_review` (Boolean, default `False`)
- `review_status` (String, default `auto_approved`; allowed values `auto_approved`, `pending_review`, `approved`, `edited`, `rejected`)
- `reviewed_by`, `reviewed_at`, `final_feedback`, `final_score`

### 6.3 Services

| Service | File | Responsibility |
|---------|------|----------------|
| Auth | `services/auth.py` + `routers/auth.py` | Password hashing, JWT encode/decode, `/auth/register`, `/auth/login`, `/auth/me` |
| Wolfram | `services/wolfram.py` | Math verification with Wolfram Alpha, fallback to deterministic local comparison, confidence score |
| OCR | `services/ocr.py` | Mathpix OCR primary; fallback to free vision providers and deterministic mocks; returns LaTeX + text + confidence |
| Feedback | `services/feedback.py` | Pedagogical feedback via Anthropic Claude, OpenAI or Gemini (auto-priority); PII scrubbing |
| Batch pipeline | `services/batch_pipeline.py` | Orchestrates OCR → Wolfram → verdict mapping → rule application → LLM feedback; flags for manual review |

### 6.4 Authentication

- JWT access tokens, configured by `JWT_SECRET_KEY`, `JWT_ALGORITHM` (`HS256` typical), `JWT_EXPIRATION_MINUTES`.
- Passwords hashed with bcrypt via `passlib[bcrypt]`.
- Endpoints: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`.
- `Teacher` records are linked to `User` via `user_id` for authorization scope.

---

## 7. AI Grading Pipeline (Detailed)

**Pipeline (Batch mode):**

1. **Input:** assignment definition + correct answer + grading rules + one or more student submissions (images or text).
2. **OCR (`services/ocr.py`):**
   - Try Mathpix API on base64 image.
   - Fallback to Google Gemini vision or OpenRouter if Mathpix fails or is absent.
   - Final deterministic mock if no API keys.
   - Output: `latex`, `text`, `confidence`.
3. **Mathematical Verification (`services/wolfram.py`):**
   - Try Wolfram Cloud function.
   - Fallback to Wolfram Alpha Full Results API.
   - Fallback to local deterministic expression comparison.
   - Output: `is_equivalent`, `confidence`, `explanation`.
4. **Verdict Mapping (`services/batch_pipeline.py`):**
   - Map Wolfram equivalence into a verdict (`correct`, `partial`, `incorrect`, `unverifiable`, etc.).
   - Apply class-level grading rules (partial credit, work shown, sig figs, unit penalty, rounding tolerance, custom regex rules).
5. **Feedback Generation (`services/feedback.py`):**
   - Build prompt from correct answer, student answer, verdict, confidence.
   - Call OpenAI or Anthropic Claude.
   - Scrub PII; fallback to deterministic canned feedback if no API key.
6. **Conditional Automation:**
   - Compute `confidence_overall` from `ocr_confidence` and `wolfram_confidence`.
   - If below threshold, set `requires_review=true` and `review_status='pending_review'`.
   - Human teacher must approve/edit/reject before publishing.

---

## 8. API Endpoints Summary

| Category | Base / Path | Note |
|----------|-------------|------|
| Meta | `GET /` | API metadata + integration status |
| Health | `GET /health` | Liveness probe |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | JWT auth |
| Assignments | `assignments.router` | CRUD for `Assignment` |
| Submissions | `submissions.router` | CRUD + `quick_grade` |
| OCR | `ocr.router` | Direct OCR endpoint |
| Wolfram test | `wolfram_test.router` | Verification test endpoint |
| Batch | `batch.router` | Batch grading job endpoint |
| Stateless grade | `POST /api/v1/grade` | Alias for `quick_grade` |

**Interactive docs:** OpenAPI/Swagger UI available at `http://localhost:8000/docs` when the API is running.

---

## 9. Environment Variables & Secrets

**Configuration source:** `apps/api/app/config.py`, `.env`, `.env.example`.

### 9.1 Required / Sensitive Variables (Confidential / Internal)

| Variable | Purpose | Classification |
|----------|---------|----------------|
| `JWT_SECRET_KEY` | JWT signing secret | **Confidential** |
| `JWT_ALGORITHM` | JWT algorithm (e.g. `HS256`) | **Internal** |
| `JWT_EXPIRATION_MINUTES` | Token lifetime | **Internal** |
| `WOLFRAM_APP_ID` | Wolfram Alpha API access | **Confidential** |
| `WOLFRAM_API_URL` | Wolfram API base URL | **Internal** |
| `OPENAI_API_KEY` | OpenAI provider (feedback, facit, grading fallback) | **Confidential** |
| `ANTHROPIC_API_KEY` | Claude fallback | **Confidential** |
| `MATHPIX_APP_ID`, `MATHPIX_APP_KEY` | Mathpix OCR | **Confidential** |
| `GEMINI_API_KEY` | Google vision fallback | **Confidential** |
| `OPENROUTER_API_KEY` | OpenRouter vision/LLM fallback | **Confidential** |
| `DATABASE_URL` | SQLAlchemy DB URL | **Internal** |

### 9.2 Non-Sensitive / Operational

| Variable | Purpose |
|----------|---------|
| `API_HOST` / `API_PORT` | FastAPI bind address |
| `CORS_ORIGINS` | Allowed frontend origins (production) |

**Rule for NobleArc:** Never render the actual `.env` file, key values, or `config.py` dumps on any public surface. Mention only that the product supports these providers at a high level.

---

## 10. Responsive Design & Assets

- Sidebar is fixed `240px` on desktop and intended as the primary navigation scaffold.
- `Tailwind` breakpoints `sm 640px`, `md 768px`, `lg 1024px`, `xl 1280px`, `2xl 1536px`.
- Glassmorphism uses `backdrop-blur-2xl` and `bg-white/70` or `glass` token values.
- Print CSS in `globals.css` handles PDF exports of results with watermarks and `Caveat` handwriting font for student answers.
- **Assets:** SVG `LineIcon` icon set, no external icon library. Fonts loaded from Google Fonts (`Inter`, `Caveat`).

---

## 11. NobleArc Integration Brief

### 11.1 Where WiseOS Fits in NobleArc

WiseOS is a **featured portfolio product** under Wisecast AB. It should appear as a dedicated product page and, where applicable, a lightweight interactive demo or overview section.

### 11.2 Visibility Matrix

Use these categories for every piece of content shown on or linked from NobleArc:

| Category | Meaning | Examples |
|----------|---------|----------|
| **Public** | Safe to show on the open website without any login. | Product name, one-line purpose, hero value proposition, public screenshots with synthetic data, list of core capabilities (OCR, AI verification, feedback), tech-stack badges (Next.js, FastAPI, AI providers *by name only*), pricing if/when published. |
| **Overview only** | Short descriptions that explain what the feature does without implementation details. | “Conditional automation flags uncertain submissions for review”, “Batch pipeline”, “Teacher review workbench”, “Confidence scoring”. Do not show code, schemas, or internal thresholds. |
| **Private** | Visible only to logged-in WiseOS users (teachers) inside the app. | Personal class list, student names, individual grades, feedback text, review queue, assignment content. |
| **Confidential** | Visible to product/ops team and the deploying organisation only. Never on a public website. | API keys, JWT secrets, environment files, database contents, integration status internals, CORS rules for production. |
| **Internal** | Source code and architecture details for maintainers; not for public consumption. | File structure, router paths, exact model fields, token values, implementation of `batch_pipeline.py`, `wolfram.py` internals, SQLAlchemy/Pydantic details. |

### 11.3 Public Storytelling for NobleArc

**Hero narrative:**
> “WiseOS is an AI-powered grading assistant for STEM teachers. It reads handwritten student answers, verifies the math, applies the teacher’s own rules, and generates clear feedback — while flagging uncertain cases for human review.”

**Key public features to list:**
- Handwritten / image OCR to LaTeX and text.
- Mathematical equivalence verification.
- Rule-based grading with partial credit and unit handling.
- AI-generated, pedagogical feedback.
- Human-in-the-loop review for low-confidence results.
- Class and assignment management.
- Swedish school context (STEM grading).

**Public tech highlights:**
- Modern Next.js 14 dashboard.
- FastAPI backend with Pydantic validation.
- AI integrations with Wolfram Alpha, OpenAI, Anthropic, Mathpix.
- SQLite for pilot; SQLAlchemy ORM for portability.

### 11.4 Interactive / Demo Boundaries

- A **public demo** may only use synthetic, non-PII sample submissions.
- A **private demo / pilot portal** may allow a logged-in teacher to try the review flow with their own data; this requires the real WiseOS deployment, not a static page.
- Do **not** expose `/design-lab` or `/docs` to the public as marketing surfaces unless deliberately chosen.

### 11.5 Linking & Navigation from NobleArc

| NobleArc Page / Surface | Suggested Link / Action |
|-------------------------|-------------------------|
| Portfolio listing | `/products/wiseos` or `wiseos.noblearc.se` (public landing) |
| Product page | Feature highlights, hero image, CTA to contact Wisecast |
| Pilot login | Link to real WiseOS `http(s)://.../settings` or `/` |
| Internal case study | Overview-only narrative; no source code |

---

## 12. Confidentiality & Security Checklist for Integrators

- [ ] Do **not** publish `.env` or API keys.
- [ ] Do **not** expose the SQLite database file via static hosting.
- [ ] Do **not** screenshot real student data or actual grades for marketing.
- [ ] Keep CORS as `localhost` only in development; replace with a strict allow-list in production.
- [ ] Public copy should say “AI providers used include Wolfram Alpha, OpenAI, Anthropic, Mathpix” without referencing internal fallback chain or mock modes.
- [ ] Auth tokens are short-lived (`JWT_EXPIRATION_MINUTES`); do not cache them in public browser demos.

---

## 13. Local Development Quick Reference

| Command | Action |
|---------|--------|
| `pnpm dev:web` | Start Next.js frontend |
| `pnpm build:web` | Build frontend |
| `uvicorn app.main:app --reload` (from `apps/api`) | Start FastAPI backend |
| Frontend URL | `http://localhost:3001` |
| Backend URL | `http://localhost:8000` |
| API docs | `http://localhost:8000/docs` |
| DB file | `apps/api/wiseos.db` |

**Startup dependency:** `init_db()` runs on FastAPI startup, creating tables and applying lightweight migrations (e.g., adding `user_id` to `teachers`).

---

## 14. Assets & Visual Reproduction Guide

When reproducing WiseOS visuals inside NobleArc, use:

- **Primary color:** `#9B5A97` (`wise-500`).
- **Backgrounds:** `#FAF9F7` light, dark mode via CSS variables in `globals.css`.
- **Surface:** `#FFFFFF` with `glass` / `rgba(255,255,255,0.72)` overlays.
- **Shadows:** Ultra-soft, low alpha on `rgb(28,26,30)`.
- **Radius:** `0.75rem`–`1rem` for cards, `9999px` for pills.
- **Icons:** `LineIcon` set (stroke-based SVG), or equivalent thin-stroke Lucide icons if reproducing in another stack.
- **Fonts:** `Inter` for UI, `Caveat` for handwritten student answer samples.
- **Spacing:** Generous; prefer `1.5rem` card padding and `2rem` section gaps.
- **Motion:** `200ms`–`400ms` transitions, spring easing for tactile interactions.

---

## 15. Known Pilot Limitations

- SQLite is used for the pilot; production should migrate to a managed PostgreSQL.
- OCR and LLM fallbacks degrade to deterministic mocks when API keys are absent, which is useful for zero-cost pilots but not representative of production accuracy.
- CORS is open to all localhost ports for browser-preview compatibility; production must be restricted.
- `experimental-ui` is isolated to `/design-lab` and not yet consumed by production routes; the production UI is a separate Tailwind layer.
- No real payment/subscription logic beyond the `subscription_tier` string field.

---

## 16. Index of Key Source Files

| Concern | File |
|---------|------|
| Design tokens | `apps/web/experimental-ui/tokens.ts` |
| Typography components | `apps/web/experimental-ui/typography.tsx` |
| Tailwind config | `apps/web/tailwind.config.ts` |
| Global styles / theme | `apps/web/app/globals.css`, `apps/web/lib/theme.tsx` |
| Layout / shell | `apps/web/app/layout.tsx`, `apps/web/components/Sidebar.tsx` |
| State | `apps/web/lib/store.ts` |
| API client | `apps/web/lib/api.ts` |
| Onboarding | `apps/web/components/Onboarding.tsx` |
| Grading workbench | `apps/web/components/Workbench.tsx` |
| FastAPI app | `apps/api/app/main.py` |
| Config / env | `apps/api/app/config.py`, `.env` |
| DB / migrations | `apps/api/app/db.py` |
| Models | `apps/api/app/models.py` |
| Schemas | `apps/api/app/schemas.py` |
| Auth | `apps/api/app/routers/auth.py`, `apps/api/app/services/auth.py` |
| Batch pipeline | `apps/api/app/services/batch_pipeline.py` |
| Wolfram | `apps/api/app/services/wolfram.py` |
| OCR | `apps/api/app/services/ocr.py` |
| Feedback | `apps/api/app/services/feedback.py` |

---

*End of document. This is the source of truth for the WiseOS pilot as of the audit date. Any structural or design change should be reflected here before being used to update the NobleArc website.*
