# Secrets rotation guide

This document describes how to rotate API keys and secrets used by wiseOS.

## Secrets inventory

| Secret | Where used | Rotation procedure |
|--------|-----------|-------------------|
| `JWT_SECRET_KEY` | Legacy auth token signing | Generate new key, update `.env`, restart API. All existing tokens become invalid. |
| `SUPABASE_URL` | Supabase client init | Update `.env`, restart API. |
| `SUPABASE_ANON_KEY` | Supabase client init | Update `.env`, restart API. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin operations | Update `.env`, restart API. |
| `GEMINI_API_KEY` | Gemini Vision (grading engine) | Update `.env`, restart API. |
| `GROQ_API_KEY` | Groq (fallback vision/feedback) | Update `.env`, restart API. |
| `ANTHROPIC_API_KEY` | Claude (feedback, answer-key extraction) | Update `.env`, restart API. |
| `OPENROUTER_API_KEY` | OpenRouter (fallback vision) | Update `.env`, restart API. |
| `MATHPIX_APP_ID` | Mathpix OCR | Update `.env`, restart API. |
| `MATHPIX_APP_KEY` | Mathpix OCR | Update `.env`, restart API. |
| `WOLFRAM_APP_ID` | Wolfram Alpha math verification | Update `.env`, restart API. |
| `WOLFRAM_API_URL` | Custom Wolfram Cloud function | Update `.env`, restart API. |
| `DATABASE_URL` | SQLAlchemy connection string | Update `.env`, restart API. |
| `SENTRY_DSN` | Sentry error tracking | Update `.env`, restart API. |
| `ADMIN_USER_IDS` | Admin gate for /api/v1/admin | Update `.env`, restart API. |

## General procedure

1. **Update the secret** in the environment configuration (`.env` for local dev,
   secrets manager for production).
2. **Restart the API** — all secrets are read at startup from `settings` (pydantic-settings).
   No secrets are cached or persisted in the database.
3. **Verify** — hit `/health/integrations` to confirm provider status changes from
   `false` to `true` (or vice versa if testing a bad key).
4. **No code changes are needed** — all secrets are configuration, not code.

## Key principles

- **No secrets in code** — all secrets live in `.env` (gitignored) or a secrets manager.
- **No secrets in logs** — provider URLs and API keys are never logged. The
  `/health/integrations` endpoint returns boolean status only, never raw keys.
- **No secrets in the database** — secrets are runtime configuration, not persisted data.
- **Graceful degradation** — if a provider's key is missing or invalid, the
  pipeline produces `needs_review` results, never fabricated data or crashes.
