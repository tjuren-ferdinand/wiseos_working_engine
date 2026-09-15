# Railway deployment — wiseos.noblearc.se

Environment variables to set in the Railway dashboard per service.
Service roots: `api` → `apps/api`, `web` → `apps/web`.

## Backend service (`api`)

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `sqlite:////data/wiseos.db` | `/data` = Railway volume mount |
| `CORS_ORIGINS` | `https://wiseos.noblearc.se` | Production only. No localhost, no wildcards. |
| `ENVIRONMENT` | `prod` | JSON logging + Sentry tag |
| `ENABLE_LEGACY_AUTH` | `false` | Explicit — keeps legacy JWT router off |
| `JWT_SECRET_KEY` | `openssl rand -hex 32` | Generate fresh. Never reuse the dev placeholder. |
| `JWT_ALGORITHM` | `HS256` | |
| `JWT_EXPIRATION_MINUTES` | `60` | |
| `GEMINI_API_KEY` | from `.env` | **KNOWN RISK**: free-tier AI Studio key — Google may train on submitted data. Upgrade to paid before real student data. |
| `GEMINI_MODEL` | `gemini-3.6-flash` | |
| `OPENAI_API_KEY` | from `.env` | Replaces Groq entirely — feedback, facit generation and vision fallback |
| `OPENAI_MODEL` | `gpt-5.6-terra` | Vision/grading |
| `OPENAI_FEEDBACK_MODEL` | `gpt-5.6-luna` | Feedback + facit generation |
| `OPENAI_VISION_MODEL` | `gpt-5.6-terra` | OCR fallback |
| `OPENAI_FALLBACK_MODELS` | `gpt-5.6-luna` | Same-provider fallbacks for text calls |
| `OCR_PROVIDER` | `auto` | Resolves to Gemini (key present) |
| `GRADING_PROVIDER` | `auto` | Resolves to Gemini→Claude→OpenAI fallback chain when keys set. **Never `groq`** — no adapter exists |
| `FEEDBACK_PROVIDER` | `auto` | Resolves to OpenAI (ANTHROPIC_API_KEY empty) |
| `MATH_PROVIDER` | `auto` | Resolves to Wolfram |
| `WOLFRAM_APP_ID` | from `.env` | |
| `ANTHROPIC_API_KEY` | (empty) | Leave empty until a real key exists |
| `SUPABASE_URL` | from `.env` | |
| `SUPABASE_ANON_KEY` | from `.env` | |
| `SUPABASE_SERVICE_ROLE_KEY` | (empty) | Only needed for Storage admin ops |
| `ADMIN_USER_IDS` | (empty or your Supabase user id) | Empty = all admin calls get 403 (fail-closed) |
| `REVIEW_CONFIDENCE_THRESHOLD` | `0.95` | |
| `RETENTION_ANONYMIZE_DAYS` | `30` | |
| `RETENTION_HARD_DELETE_DAYS` | `90` | |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` | Shared rate-limit counter across replicas. Add a Redis service to the project and reference its variable — see below. Empty = process-local fallback |
| `SENTRY_DSN` | (optional) | Empty = disabled |

## Redis (delad rate limit-räknare)

Batch- och facit-endpoints delar en sliding-window-räknare. Utan Redis är den
processlokal — varje replica räknar för sig och omstart nollställer.

1. Railway project → **New** → **Database** → **Add Redis**.
2. `api` service → **Variables** → **New Variable** → `REDIS_URL` = `${{Redis.REDIS_URL}}` (variable reference to the Redis service).
3. Redeploy `api`. The limiter falls back to process-local memory automatically if Redis is unreachable — the endpoint never goes down for a Redis blip.

## Schemalagd retention-sweep (Railway Cron)

GDPR-policyn (pseudonymisera >30 dagar, radera >90 dagar) körs via
`apps/api/scripts/run_retention.py` — samma script som admin-endpointen
anropar. Schemalägg den som ett separat cron-jobb, inte i webbprocessen:

1. Railway project → **New** → **Cron Job** (eller Service → Settings → Cron Schedule, beroende på dashboard-version).
2. Source: samma repo, root directory `apps/api`.
3. Command: `python scripts/run_retention.py`.
4. Schedule: `0 3 * * *` (dagligen 03:00 UTC — låg belastning).
5. Variables på cron-tjänsten: minst `DATABASE_URL` (`sqlite:////data/wiseos.db` + samma `/data`-volym som `api`), `RETENTION_ANONYMIZE_DAYS`, `RETENTION_HARD_DELETE_DAYS`, `ENVIRONMENT`, `SENTRY_DSN`. Provider-nycklar behövs inte.
6. Kör manuellt en gång efter deploy ("Run now") och kontrollera loggen för `RETENTION-RAPPORT`.

## Frontend service (`web`)

These are **build-time** vars (Next.js inlines `NEXT_PUBLIC_*`). Set them as
Railway variables on the `web` service — they are passed as Docker build args.

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<api-service>.up.railway.app` (the api service's public domain) |
| `NEXT_PUBLIC_SUPABASE_URL` | from `.env` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from `.env` |

## Railway setup steps

1. New project → add two services from the same repo.
2. Service `api`: root directory `apps/api`, attach volume mounted at `/data`.
3. Service `web`: root directory `apps/web`.
4. Set all env vars above per service.
5. Generate a public domain for `api` first, then set `NEXT_PUBLIC_API_URL` on `web` to that domain and redeploy `web` (build arg requires rebuild).
6. Add custom domain `wiseos.noblearc.se` to the `web` service.
7. Cloudflare DNS: CNAME `wiseos` → the `web` service's Railway domain.
8. Cloudflare Zero Trust: Access application scoped to `wiseos.noblearc.se`.

## Generate the JWT secret

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

or on any machine with OpenSSL:

```bash
openssl rand -hex 32
```
