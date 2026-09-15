# Provider switching via environment variables

WiseOS selects AI/OCR/math providers through environment variables — no code
changes required for the supported combinations. This document lists exactly
what to set, which secrets are needed, and how to verify the switch.

## The four provider slots

| Env var | Controls | Valid values |
|---------|----------|--------------|
| `OCR_PROVIDER` | Text extraction from scanned documents (answer keys, `/api/v1/ocr`) | `auto`, `mathpix`, `gemini`, `openrouter`, `openai` |
| `GRADING_PROVIDER` | Student-work grading engine (image-first analysis) | `auto`, `gemini`, `openai`, `anthropic` |
| `FEEDBACK_PROVIDER` | Pedagogical feedback text per question | `auto`, `anthropic`, `openai`, `gemini` |
| `MATH_PROVIDER` | Mathematical equivalence verification | `auto`, `wolfram`, `local` |

`auto` resolves from whichever API keys are populated (see priority order below).

## Grading: testmotiverad fallback-kedja

`GRADING_PROVIDER` accepts `auto`, `gemini`, `openai`, `anthropic`. Any other
value **raises `RuntimeError` at call time**.

In `auto` mode grading runs through `FallbackVisionProvider` with the order
proven by `scripts/compare_engines.py` (golden suite, 18 fall × 3 motorer):

**Gemini primary → Claude → OpenAI**

Gemini and Claude both passed 18/18 (equal quality on every category);
Gemini is ~17% faster (median ~10.3s vs ~12.4s) and runs on a cheaper
flash-tier model. OpenAI is last — it could not be measured (invalidated
API key at test time) and stays in the chain as a safety net only.

An outage at one provider no longer halts the pipeline — and a full chain
failure still yields `needs_review`, never fabricated scores.

**Working combinations today:**

| Goal | Settings |
|------|----------|
| Production target | `GRADING_PROVIDER=auto` (Gemini→Claude→OpenAI chain when keys set) |
| All-Gemini | `GRADING_PROVIDER=gemini`, `FEEDBACK_PROVIDER=gemini`, `OCR_PROVIDER=gemini` |
| Claude-only grading | `GRADING_PROVIDER=anthropic`, `ANTHROPIC_API_KEY` set |

## 1. Env vars to set

For the closest-to-target supported configuration:

```ini
# .env
OCR_PROVIDER=mathpix
GRADING_PROVIDER=gemini        # NOT anthropic — see limitation above
FEEDBACK_PROVIDER=anthropic
MATH_PROVIDER=auto             # resolves to wolfram when keys present
```

## 2. Secrets that must be populated

| Setting | Requires |
|---------|----------|
| `OCR_PROVIDER=mathpix` | `MATHPIX_APP_ID` + `MATHPIX_APP_KEY` |
| `FEEDBACK_PROVIDER=anthropic` | `ANTHROPIC_API_KEY` |
| `GRADING_PROVIDER=gemini` | `GEMINI_API_KEY` |
| `MATH_PROVIDER=auto`→wolfram | `WOLFRAM_APP_ID` or `WOLFRAM_API_URL` |

If a provider is selected explicitly but its secrets are missing, calls fail
at request time (auth error → `needs_review` in the pipeline — never a crash,
never fabricated data).

**Unrecognized values fail closed.** Setting e.g. `OCR_PROVIDER=vision` (not in
the valid list) makes the registry raise `RuntimeError` at call time, and
`/health/integrations` reports `"unavailable"` for that slot. This is
intentional — a typo must not silently fall back to a different provider.

## 3. Verifying the switch

Restart the API, then:

```bash
curl http://localhost:8000/health/integrations
```

Expected output for the target configuration:

```json
{
  "ocrProvider": "mathpix",
  "gradingProvider": "gemini-vision",
  "feedbackProvider": "anthropic",
  "mathProvider": "wolfram",
  "mathpix": true,
  "anthropic": true,
  "gemini": true,
  "wolfram": true,
  "gemini_reachable": true
}
```

The response contains **boolean flags and provider names only** — never API
keys, secrets, or raw credentials.

If a slot shows `"unavailable"` instead of the expected name, the env var is
either unset, misspelled, or the required secret is missing.

## Auto-resolution priority (when a slot is `auto`)

- **OCR**: `mathpix` (if `MATHPIX_APP_ID`+`MATHPIX_APP_KEY`) → `gemini` → `openrouter` → `openai`
- **Grading**: `gemini` → `anthropic` → `openai` fallback chain (test-proven order)
- **Feedback**: `anthropic` → `openai` → `gemini`
- **Math**: `wolfram` (falls back to local deterministic comparison when no keys)
