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
| `GROQ_API_KEY` | from `.env` | |
| `GROQ_MODEL` | `openai/gpt-oss-20b` | |
| `GROQ_VISION_MODEL` | `meta-llama/llama-4-scout-17b-16e-instruct` | |
| `GROQ_FALLBACK_MODELS` | `llama-3.1-8b-instant,openai/gpt-oss-20b,openai/gpt-oss-120b` | |
| `OCR_PROVIDER` | `auto` | Resolves to Gemini (key present) |
| `GRADING_PROVIDER` | `auto` | Resolves to Gemini. **Never `anthropic`** — no adapter wired, crashes at `registry.py:42` |
| `FEEDBACK_PROVIDER` | `auto` | Resolves to Groq (ANTHROPIC_API_KEY empty) |
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
| `SENTRY_DSN` | (optional) | Empty = disabled |

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
