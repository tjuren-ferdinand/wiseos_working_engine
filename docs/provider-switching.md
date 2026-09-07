# Provider switching via environment variables

WiseOS selects AI/OCR/math providers through environment variables — no code
changes required for the supported combinations. This document lists exactly
what to set, which secrets are needed, and how to verify the switch.

## The four provider slots

| Env var | Controls | Valid values |
|---------|----------|--------------|
| `OCR_PROVIDER` | Text extraction from scanned documents (answer keys, `/api/v1/ocr`) | `auto`, `mathpix`, `gemini`, `openrouter`, `groq` |
| `GRADING_PROVIDER` | Student-work grading engine (image-first analysis) | `auto`, `gemini` |
| `FEEDBACK_PROVIDER` | Pedagogical feedback text per question | `auto`, `anthropic`, `groq`, `gemini` |
| `MATH_PROVIDER` | Mathematical equivalence verification | `auto`, `wolfram`, `local` |

`auto` resolves from whichever API keys are populated (see priority order below).

## Important limitation: grading is Gemini-only today

`GRADING_PROVIDER=anthropic` (or any value other than `auto`/`gemini`)
**raises `RuntimeError` at call time**:

```
VISION ERROR: GRADING_PROVIDER='anthropic' is not yet supported for vision grading
```

The grading engine requires `analyze_document` — multi-page image analysis of
handwritten student work. Only the Gemini adapter implements this. The
`ClaudeVisionAdapter` exists but only handles **answer-key extraction**
(a different interface). Wiring an Anthropic grading adapter requires code
changes and is out of scope for configuration-only switching.

**Working combinations today:**

| Goal | Settings |
|------|----------|
| Production target (partial) | `OCR_PROVIDER=mathpix`, `FEEDBACK_PROVIDER=anthropic`, `GRADING_PROVIDER=gemini` (or `auto` with `GEMINI_API_KEY`) |
| All-Gemini | `GRADING_PROVIDER=gemini`, `FEEDBACK_PROVIDER=gemini`, `OCR_PROVIDER=gemini` |
| Cost-optimized | `GRADING_PROVIDER=gemini`, `FEEDBACK_PROVIDER=groq`, `OCR_PROVIDER=mathpix` |

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

- **OCR**: `mathpix` (if `MATHPIX_APP_ID`+`MATHPIX_APP_KEY`) → `gemini` → `openrouter` → `groq`
- **Grading**: `gemini` (only implemented option)
- **Feedback**: `anthropic` → `groq` → `gemini`
- **Math**: `wolfram` (falls back to local deterministic comparison when no keys)

## Deprecated: `AI_PROVIDER`

`AI_PROVIDER` is kept for backward compatibility. `GRADING_PROVIDER` takes
precedence; `AI_PROVIDER` only applies when `GRADING_PROVIDER=auto` and is set
to a non-default value.
