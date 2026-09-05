# WiseOS - session-checkpoint

**Repo:** `C:\Users\sfpri\Desktop\wiseos_demo`  
**Branch:** `ui-global-rollout-v2`  
**HEAD:** `5b1b317` (4 commits this session: migrations → providers → tests → ops)  
**Senaste verifierade testkörning:** 114 pytest-pass, `python -m compileall -q` ren, `pnpm exec tsc --noEmit` ren, `pnpm build` ren.

## Var vi befann oss när sessionen pausades

Plattformshärdningsfasen (plan-3766349cb86fba8f.md) är **klar** — alla fyra områden implementerade, testade, verifierade och committade. Systemet har nu Alembic-migrationer, provider-abstraktion med circuit breaker, omfattande testtäckning och ops-infrastruktur.

### Lösta incidenter denna session

**1. `env.py` URL-override-bug (accidental real-DB migration)**

**Vad hände:** `apps/api/app/migrations/env.py` hade en bugg där `config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)` körde **ovillkorligt** — den skrev över testens explicit satta URL (pekad på `tmp_path`-kopia) med den riktiga `wiseos.db`-sökvägen. När `test_migrations.py` körde `alembic stamp` + `alembic upgrade head` på vad den trodde var en kopia, körde den faktiskt på den riktiga `wiseos.db`.

**Fix:** Ändrade till villkorlig override — `settings.DATABASE_URL` används bara som fallback när ingen URL explicit satts:
```python
if not config.get_main_option("sqlalchemy.url"):
    config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
```

**Konsekvens:** Migreringen var index-only (`CREATE INDEX`), ingen dataskada. Backup togs post-migration (inte pre-migration) — detta är ett känt processgap. Alla 12 `grading_results`-rader verifierade identiska mellan backup och nuvarande DB (SHA-256 hash match).

**Regressiontester tillagda:** `tests/test_no_real_db_touch.py` — 2 tester som skyddar mot att detta händer igen:
- `test_migrations_do_not_touch_real_db` — verifierar att `wiseos.db` hash/mtime/rows är oförändrade efter migration på en kopia
- `test_env_py_respects_explicit_url` — verifierar att `env.py` inte skriver över explicit satt URL

**2. FK/cascade-konflikt (tidigare session, dokumenterad)**

`GradingResult.student_id` har `ForeignKey(students.id, ondelete="SET NULL")` i modellen, men `classes.py:delete_student` hard-deletar grading_results direkt — inkompatibelt med SET NULL-semantik. Beslut: FK:n läggs INTE till i befintlig SQLite-DB (bara index). Dokumenterat med KNOWN-ISSUE-kommentarer i `models.py` och `classes.py`.

**Detta är andra gången en "verify before trusting"-granskning fångade ett verkligt problem.** Första gången var FK/cascade-konflikten (planen antog att FK kunde läggas till; granskning visade att det skulle bryta `delete_student`). Andra gången var `env.py`-buggen (testen skulle ha kört på kopia; bugg gjorde att den körde på riktiga DB). **Lärdom: framtida faser ska defaulta till copy-first-mönstret som tvingas av tester, inte bara beskrivs i en plan.**

### Genomförda delar denna session (plan-3766349cb86fba8f.md)

**Area 1 — Alembic setup + migrations (commit `00c2573`):**
- `alembic.ini`, `env.py`, `script.py.mako`, `versions/` — full Alembic-setup
- Baseline `c6c4ebf10225`: alla 9 tabeller inkl. V1-orphans (`assignments`, `submissions`) + `tests.facit`
- `6d18e944fa4c`: villkorliga V1-automatiseringskolumner (no-op på färska DBs)
- `e889d11880ea`: 4 performance-index (`ix_tests_klass_id`, `ix_students_klass_id`, `ix_grading_results_scanned_at`, `ix_grading_results_student_id`)
- `db.py`: ad-hoc ALTER TABLE-loop borttagen, `create_all` kvar för dev
- `models.py` + `classes.py`: KNOWN-ISSUE-kommentarer om student_id FK-konflikt
- `test_migrations.py`: 7 tester — baseline, V1-tabeller, facit-kolumn, index, FK-beteende, data-preservation

**Area 2 — Provider abstraction (commit `9caa576`):**
- `providers/base.py`: VisionProvider, FeedbackProvider, MathVerificationProvider, OCRProvider protocols
- 9 adapters: `gemini_vision`, `groq_vision`, `openrouter_vision`, `mathpix_ocr`, `claude_vision`, `wolfram`, `gemini_feedback`, `groq_feedback`, `anthropic_feedback`
- `providers/resilience.py`: `CircuitBreaker` (5 fel → öppen, 60s cooldown) + `with_retry` (HTTP-only: 429/5xx/timeout/network)
- `providers/registry.py`: `get_vision_provider()`, `get_feedback_provider()`, `get_math_provider()`, `get_ocr_provider()` — "auto" resolverar via API-nycklar
- `config.py`: `OCR_PROVIDER`, `GRADING_PROVIDER`, `FEEDBACK_PROVIDER`, `MATH_PROVIDER`, `ENVIRONMENT`, `SENTRY_DSN`; `AI_PROVIDER` deprecated
- Call-site wiring: `batch_pipeline.py`, `feedback.py`, `ocr.py`, `answer_key.py`, `claude.py`, `wolfram_test.py`
- **Gemini-adapter använder INTE `with_retry`** — den delegerar till `analyze_document` som har egen HTTP+content-retry (invalid_json, empty_response, max_tokens)
- `wolfram_test.py` httpx-anrop flyttat till `WolframVerifier.raw_query()`

**Area 3 — Testing (commit `ba69f97`):**
- `test_pdf_and_mime.py`: PDF-expansion, MIME-filtrering, sidgränser
- `test_answer_key_parsing.py`: JSON-extraktion, normalisering, defaults
- `test_score_calculation.py`: math verification-states, score-aggregering
- `test_batch_integration.py`: end-to-end pipeline med mockade providers
- `test_batch_failures.py`: provider-fel → needs_review, ingen fabrikerad data, inga krascher
- `test_provider_resilience.py`: 5 dedikerade circuit-breaker-tester + 4 per-provider-feltester
- `test_no_real_db_touch.py`: regressionstest för env.py-buggen
- `test_failure_modes.py`: fixad WolframVerifier-patch → get_math_provider
- **Totalt: 114 tester passerar**

**Area 4 — Ops (commit `5b1b317`):**
- `logging_config.py`: JSON-structured (prod/staging) eller human-readable (dev)
- `middleware/request_id.py`: `X-Request-ID` på alla svar, loggar får `request_id`
- `main.py`: `configure_logging`, `RequestIDMiddleware`, Sentry (endast om `SENTRY_DSN` satt), `/health/ready` (DB-connectivity)
- `docs/secrets-rotation.md`: alla hemligheter + rotationsprocedur
- `docs/database-backup.md`: SQLite + PostgreSQL backup/restore
- `.env.example`: alla nya inställningar dokumenterade

### Verifiering — rådata

**PRAGMA index_list på riktiga `wiseos.db`:**
```
tests.ix_tests_klass_id: ['klass_id']
tests.sqlite_autoindex_tests_1: ['id']
students.ix_students_klass_id: ['klass_id']
students.sqlite_autoindex_students_1: ['id']
grading_results.ix_grading_results_student_id: ['student_id']
grading_results.ix_grading_results_scanned_at: ['scanned_at']
grading_results.ix_grading_results_test_id: ['test_id']
grading_results.sqlite_autoindex_grading_results_1: ['id']
```

**Row-by-row data-preservation (backup vs current):**
```
Current DB hash: 25cdad300017abaae7920e7365a621c5ecdd1773329313d40acb4088baaf30ac
Backup DB hash:  25cdad300017abaae7920e7365a621c5ecdd1773329313d40acb4088baaf30ac
Result: ALL 12 ROWS IDENTICAL — every column value matches
```

**`/health/integrations` — boolean status only, no secrets:**
```json
{"wolfram":true,"gemini":true,"groq":true,"anthropic":false,"mathpix":false,
 "ocrProvider":"unavailable","gradingProvider":"gemini-vision",
 "feedbackProvider":"groq","mathProvider":"wolfram","mathpixStatus":"not_configured",
 "gradingEngine":"gemini-vision","model":"gemini-3.6-flash"}
```

### Todo-lista (uppdaterad — alla plansteg klara)

1. [x] Rekonstruera faktisk frontend→API→pipeline→databas→resultat-arkitektur och inventera alla ofullständiga flöden  
2. [x] Sanera spårad credential-placeholder och härda konfiguration utan att exponera hemligheter  
3. [x] Reparera batchresultatens persistence inklusive originalskanning, facit och idempotens  
4. [x] Reparera studentidentifiering så osäkra namn aldrig slår ihop elevers sidor  
5. [x] Reparera PDF-/bildingestion och verklig sidgruppering  
6. [x] Göra OCR-, feedback-, answer-key- och matematikproviders explicita, konfigurerbara och ärligt rapporterade  
7. [x] Reparera kurs→klass→prov→elev→resultat-kontrakt och versionsstyrda migrationer  
8. [~] Förenkla och koppla frontendens minimala provflöde till backend utan demo-/hårdkodad state  
   - Zustand/api-klient är uppdaterade, men flödet behöver E2E-testas.
9. [~] Reparera granskningsvyn, originalskanning, overrides, progress och felhantering  
   - Workbench och PrintLayout är delvis uppdaterade, men override-persistence och total-återberäkning måste verifieras.
10. [x] Lösa TypeScript-, lint-, Python- och buildfel utan att försvaga kontroller  
11. [~] Bygga ut unit-, integration- och realistiska E2E-/feltester för hela lärarflödet  
    - 114 tester passerar, men E2E-test för fullt lärarflöde saknas fortfarande.
12. [ ] Köra full återgranskning och leverera teknisk slutrapport med faktisk produktionsstatus  

### Kvarvarande ändrade filer (från tidigare sessioner — ej del av denna fas)

Dessa filer ändrades i tidigare sessioner men är **inte** committade. De är utanför scope för denna fas och ska inte committas utan explicit granskning:

```
 M apps/api/app/routers/admin.py      (fail-closed require_admin — prior session)
 M apps/api/app/routers/batch.py      (V1 assignment/submission route removal — prior session)
 M apps/api/app/routers/results.py    (V1 route removal — prior session)
 M apps/api/app/schemas.py            (QuickGradeRequest/Response removal — prior session)
 M apps/api/app/services/gemini_client.py   (prompt/retry improvements — prior session)
 M apps/api/app/services/gemini_vision.py   (is_supported_document, prompt fixes — prior session)
 M apps/api/app/services/vision_ocr.py      (OCR rewrite — prior session)
 M apps/web/.env.local.example        (Supabase env vars — prior session)
 D apps/web/app/assignments/new/page.tsx    (V1 dead route — prior session)
 D apps/web/components/BulkUploadZone.tsx   (V1 dead component — prior session)
 M apps/web/components/*.tsx          (frontend presentation changes — prior session)
 M apps/web/lib/*.ts                  (API client/store updates — prior session)
?? apps/web/components/CourseCombobox.tsx   (new component — prior session)
?? apps/web/components/DashboardEmptyState.tsx (new component — prior session)
```

**Not committed:** `wiseos.db.bak.20260905_135655` (post-migration backup — do not commit DB files).

## För att återuppta exakt här

1. **Verifiera att inga oavsiktliga ändringar har tillkommit:**
   ```powershell
   cd C:\Users\sfpri\Desktop\wiseos_demo
   git diff --stat
   git log --oneline -5
   ```
   De 4 nya commitsen ska synas: `5b1b317` (ops), `ba69f97` (tests), `9caa576` (providers), `00c2573` (migrations).
2. **Kör snabbkontroller:**
   ```powershell
   cd apps/api; python -m pytest -q; python -m compileall -q app
   cd ..\..\apps\web; pnpm exec tsc --noEmit; pnpm build
   ```
3. **Fortsätt på nästa punkt** — återstående arbete är frontend-E2E och slutgranskning:
   - E2E-testa hela lärarflödet: `/login` → klass → skapa prov → ladda upp PDF → granska → spara
   - Verifiera att frontendens Zustand/api-klient matchar backend-kontrakten
   - Slutrapport med produktionsstatus

## Kända blockeringar / kritiska P0/P1-frågor

- **`.env` och `apps/web/.env.local` finns och är gitignore:ade.** Innehåller lokala API-nycklar. Aldrig checka in.
- **Supabase-auth är aktivt.** Legacy JWT avstängd (`ENABLE_LEGACY_AUTH=False`). Inloggning kräver `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` i `apps/web/.env.local`.
- **Legacy `assignments`/`submissions`-rutter är borttagna** från `main.py` men filerna finns kvar på disk — inte registrerade, inte laddade.
- **`wiseos.db` är nu Alembic-hanterad.** Kör `alembic upgrade head` för nya migrationer. `create_all` är kvar för dev-convenience men production ska använda Alembic.
- **Kvarvarande uncommitted filer** (se ovan) är från tidigare sessioner och ska granskas separat innan commit.

## Live-testinstanser

Backend (`uvicorn --reload`) och frontend (`pnpm dev`) kan startas för manuell testning:

- Backend API: `http://localhost:8000` — `/health` (liveness), `/health/ready` (readiness), `/health/integrations` (provider-status), `/docs` (OpenAPI)
- Frontend: `http://localhost:3000`

## Testkommandon

| Miljö | Kommando |
|-------|----------|
| Backend unit (114 tester) | `cd apps/api; python -m pytest -q` |
| Backend compile | `cd apps/api; python -m compileall -q app` |
| TS typecheck | `cd apps/web; pnpm exec tsc --noEmit` |
| Frontend build | `cd apps/web; pnpm build` |
| Lokal dev-backend | `cd apps/api; python -m uvicorn app.main:app --reload --port 8000` |
| Lokal dev-frontend | `cd apps/web; pnpm dev` |
| Alembic migration | `cd apps/api; alembic upgrade head` |
| Alembic ny revision | `cd apps/api; alembic revision --autogenerate -m "beskrivning"` |

## Portar för lokal testning

- Backend API / OpenAPI-dokumentation: <http://localhost:8000> och <http://localhost:8000/docs>
- Frontend (Next.js): <http://localhost:3000>

---

**OBS:** Nästa agent ska inte försöka återdesigna WiseOS från scratch, utan fortsätta reparera och testa utifrån denna checkpunkt och den ursprungliga specen: lärare ska kunna skapa klass/prov, ladda upp, få ärlig AI-rättning, granska och spara resultat – utan att behöva bry sig om interna providers/JSON/ID:n.
