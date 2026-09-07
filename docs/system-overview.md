# WiseOS — Verifierad Systemgenomgång (2026-08-30)

> Allt i detta dokument är verifierat genom att läsa faktisk kod i repot
> (commit `3c7e34e`, tag `v-working-2026-08-30`).
> Avsnitt markerade med **⚠ OKÄNT** kräver åtkomst utanför repot (t.ex. Supabase Dashboard).

---

## 1. Inloggning / Auth — i detalj

### Två parallella auth-system (bekräftat)

Systemet har **två separata auth-system** som existerar sida vid sida:

#### A. Supabase Auth (aktivt, används av frontend)

**Signup-flöde** (verifierat i `apps/web/app/login/page.tsx:77-106`):
1. Användaren klickar "Kom igång gratis" → `AuthModal` öppnas med `mode="signup"`.
2. Formuläret tar **email + lösenord** (minLength=6).
3. `supabase.auth.signUp({ email, password })` anropas.
4. **Om signUp returnerar en session direkt:** användaren loggas in, redirect till `/`.
5. **Om signUp INTE returnerar session** (= e-postverifiering krävs): meddelandet "Kolla din e-post för att bekräfta" visas. Användaren måste klicka länken innan inloggning.

**Login-flöde:**
1. `supabase.auth.signInWithPassword({ email, password })` anropas.
2. Vid success: `router.push("/")` + `router.refresh()`.
3. Vid fel: felmeddelande visas i UI.

**Ingen magic link** — enbart email + lösenord.

**Session/cookies** (verifierat i `apps/web/lib/supabase/middleware.ts`):
- `@supabase/ssr` hanterar cookies automatiskt. Supabase sätter cookies med namn `sb-<project-ref>-auth-token`.
- `createServerClient` i middleware läser/skriver dessa cookies via `getAll()`/`setAll()`.
- På varje request: `supabase.auth.getUser()` refreshar sessionen.
- Cookie-konfigurationen styrs av `@supabase/ssr` — **vi sätter ingen explicit httpOnly/lifetime** i koden. Supabase SDK:ns defaultvärden gäller (httpOnly=true, session-baserad med refresh tokens).

**Route-skydd** (verifierat i `apps/web/lib/supabase/middleware.ts:35-38`):
- Alla sidor utom `/login` kräver inloggad användare.
- Oautentiserade besökare redirectas till `/login`.

**"Invalid Refresh Token"-felet:**
- Supabase SDK refreshar automatiskt. Felet uppstår när refresh token gått ut (t.ex. efter lång inaktivitet) eller cookies rensats. Browsern får 401, middleware redirectar till `/login`. **Ofarligt brus** — det är Supabase:s normala session-expiry-hantering.

#### B. Eget JWT/bcrypt-system (legacy, finns i backend)

Verifierat i `apps/api/app/routers/auth.py` + `apps/api/app/services/auth.py`:
- Endpoints: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`.
- Bcrypt-hashning via `passlib`, JWT via `python-jose`.
- JWT-nyckel: `JWT_SECRET_KEY` i `.env` (default: `wiseos_dev_secret_key_change_in_production_abc123xyz`).
- JWT-livstid: 60 minuter.
- Skapar `User` + `Teacher`-profil i lokal SQLite vid registrering.
- **Används INTE av frontenden idag.** Frontend skickar Supabase-token, inte legacy-JWT.

#### C. Supabase-verifiering i backend (Fas 2, minimal)

Verifierat i `apps/api/app/routers/supabase_auth.py` + `apps/api/app/services/supabase_auth.py`:
- **Enda endpoint:** `GET /api/v1/auth/supabase/me`.
- Verifierar Bearer-token genom att anropa `GET {SUPABASE_URL}/auth/v1/user` med token.
- Returnerar `SupabaseUser(id, email, role)`.
- **Ingen lokal signaturverifiering** — Supabase är "source of truth".

### ⚠ KRITISK SÄKERHETSBRIST: V2-endpoints saknar auth

**Bekräftat:** Ingen av dessa routers använder `Depends(get_current_user)` eller `Depends(get_current_supabase_user)`:
- `classes.py` — alla endpoints öppna
- `results.py` — alla endpoints öppna
- `batch.py` — alla endpoints öppna
- `ocr.py` — alla endpoints öppna
- `claude.py` — alla endpoints öppna
- `submissions.py` — alla endpoints öppna

Frontenden **skickar** Supabase Bearer-token i varje request (verifierat i `apps/web/lib/api.ts:6-16` via `getAuthHeader()`), men **backend ignorerar den**. Vem som helst med nätverksåtkomst till `localhost:8000` kan läsa/skriva all data.

### Roller

- **Inga roller i frontend** — alla inloggade användare behandlas lika.
- Legacy-backend har `Teacher`-modell med `subscription_tier`-fält, men det påverkar ingenting.
- **⚠ OKÄNT:** Om Supabase-projektet har en `profiles`-tabell med roller syns det inte i koden. Kräver Supabase Dashboard-kontroll.

---

## 2. Datalagring — verifierad

### Lokal SQLite-databas (bekräftat)

**Backend-databasen** är en **SQLite-fil**:
- Sökväg: `wiseos.db` i repo-roten (12 MB) + `apps/api/wiseos.db` (104 KB).
- Konfigurerad i `.env`: `DATABASE_URL=sqlite:///./wiseos.db`.
- **Persistens:** Data sparas på disk. Överlevner omstart men **inte** container-deploy om volymen inte mountas.
- `.env.example` anger `postgresql+psycopg://...` och `docker-compose.yml` definierar en Postgres-container — men **i praktiken körs SQLite lokalt idag**.

### Alla tabeller (bekräftat i `apps/api/app/models.py`)

| Tabell | Modell | Används aktivt | Beskrivning |
|---|---|---|---|
| `users` | `User` | Legacy-auth | id, email, password_hash, full_name, is_active, created_at |
| `teachers` | `Teacher` | Legacy-auth | id, user_id→users, email, school_name, subscription_tier |
| `assignments` | `Assignment` | Legacy/V1 | id, teacher_id→teachers, title, subject, correct_answer |
| `submissions` | `Submission` | Legacy/V1 | id, assignment_id→assignments, student_name, answer_text, score, review_status, confidence-fält |
| **`classes`** | `Klass` | **V2 aktiv** | id, name, kurs_id, grading_params (JSON), grade_thresholds (JSON) |
| **`students`** | `KlassStudent` | **V2 aktiv** | id, klass_id→classes, name, identifier |
| **`tests`** | `Test` | **V2 aktiv** | id, klass_id→classes, title, date, max_points, facit_mode, questions (JSON), status, custom_params |
| **`grading_results`** | `GradingResult` | **V2 aktiv** | id, test_id→tests, student_name, student_id, steps (JSON), total_score, max_score, percentage, grade |
| **`answer_keys`** | `AnswerKeyRecord` | **V2 aktiv** | id, test_id→tests (unique), items (JSON), source |

### Supabase — vad som faktiskt används

- **Supabase Auth:** Används för inloggning/session.
- **Supabase Database:** Används **inte** för applikationsdata. All prov-/resultatdata lagras i lokal SQLite.
- **⚠ OKÄNT:** RLS-policyer, eventuella extra tabeller i Supabase (t.ex. `profiles`), Storage-buckets — kräver Supabase Dashboard. Koden har `SUPABASE_SERVICE_ROLE_KEY` som placeholder men den är tom.

### Migrationshistorik

Inga separata migrationsfiler. `db.py` kör `Base.metadata.create_all()` vid startup + manuella `ALTER TABLE ADD COLUMN`-satser i `init_db()` (verifierat i `apps/api/app/db.py:34-54`). Nya kolumner läggs till idempotent med try/except.

---

## 3. Backend-systemet — verifierat

### Ramverk och plats

- **Plats:** `apps/api/` (i samma repo)
- **Språk:** Python
- **Ramverk:** FastAPI 0.115.0 (verifierat i `apps/api/requirements.txt`)
- **Server:** Uvicorn 0.30.6
- **ORM:** SQLAlchemy 2.0.35
- **Validering:** Pydantic 2.9.2

### Alla API-endpoints (bekräftat i `apps/api/app/main.py` + routers)

#### V2 — aktiva endpoints (ingen auth)

| Metod | Endpoint | Vad den gör | Router |
|---|---|---|---|
| GET | `/api/v1/classes` | Lista alla klasser med studenter | `classes.py` |
| POST | `/api/v1/classes` | Skapa klass | `classes.py` |
| GET | `/api/v1/classes/{id}` | Hämta klass | `classes.py` |
| POST | `/api/v1/classes/{id}/students` | Lägg till elev | `classes.py` |
| GET | `/api/v1/classes/{id}/tests` | Lista prov per klass | `classes.py` |
| POST | `/api/v1/classes/{id}/tests` | Skapa prov | `classes.py` |
| GET | `/api/v1/classes/tests/{id}` | Hämta prov | `classes.py` |
| GET | `/api/v1/results` | Lista resultat (filtreras på `testId`) | `results.py` |
| POST | `/api/v1/results` | Skapa resultat | `results.py` |
| GET | `/api/v1/results/{id}` | Hämta resultat | `results.py` |

**⚠ SAKNAS i backend:** `PATCH /api/v1/classes/tests/{id}` och `PATCH /api/v1/results/{id}` och `PATCH /api/v1/classes/{id}`.
Frontenden anropar dessa (verifierat i `lib/api.ts:311-352`), men backend har **inga PATCH-endpoints**. `updateTest` och `updateResult` returnerar sannolikt 405 Method Not Allowed. `publishResults` och `updateProvStatus` i `store.ts` fångar felet tyst med `try/catch` — statuset ändras i Zustand men **persisteras inte till backend**.

#### Batch-rättning

| Metod | Endpoint | Vad den gör | Router |
|---|---|---|---|
| POST | `/api/v1/batch/grade` | Batch-rättning med multipart upload | `batch.py` |
| POST | `/api/v1/ocr/process` | OCR från base64-bild | `ocr.py` |
| POST | `/api/v1/ocr/upload` | OCR från uppladdad fil | `ocr.py` |
| POST | `/api/v1/ocr/answer-key/upload` | Extrahera facit från bild/pdf | `ocr.py` |
| POST | `/api/v1/ocr/answer-key/generate` | AI-generera facit från beskrivning | `ocr.py` |
| POST | `/api/v1/claude/analyze` | Analysera enskild fråga/svar | `claude.py` |
| POST | `/api/v1/grade` | Stateless quick-grade (alias) | `main.py` → `submissions.py` |

#### Auth-endpoints

| Metod | Endpoint | Vad den gör | Router |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Registrera (legacy) | `auth.py` |
| POST | `/api/v1/auth/login` | Logga in (legacy) | `auth.py` |
| GET | `/api/v1/auth/me` | Hämta user (legacy JWT) | `auth.py` |
| GET | `/api/v1/auth/supabase/me` | Verifiera Supabase-token | `supabase_auth.py` |

#### V1/Legacy

| Metod | Endpoint | Router |
|---|---|---|
| GET/POST | `/api/v1/assignments` | `assignments.py` |
| GET | `/api/v1/assignments/{id}` | `assignments.py` |
| POST | `/api/v1/submissions/grade` | `submissions.py` |
| GET | `/api/v1/submissions/pending` | `submissions.py` |
| POST | `/api/v1/submissions/{id}/review` | `submissions.py` |
| POST | `/api/v1/wolfram/*` | `wolfram_test.py` |

### AI-chatt (`/api/chat`)

- Endpointen finns **i Next.js** som API-route: `apps/web/app/api/chat/route.ts`.
- Använder `GeminiProvider` med `GEMINI_API_KEY` och `GEMINI_MODEL` (server-side env vars).
- `chat-service.ts` kallar `POST /api/chat` (relativ URL = Next.js API-route, inte backend).
- **Status:** Koden finns och är komplett. Men om `GEMINI_API_KEY` inte är satt i `apps/web/.env.local` returnerar den "AI-tjänsten är inte konfigurerad ännu." Nyckeln finns enbart i root `.env` för backend — **inte i `apps/web/.env.local`**, så chatten fungerar inte utan manuell konfiguration.

### Rättningsflödet i detalj (verifierat)

```
POST /api/v1/batch/grade (multipart: prov_id, files[], answer_key_json, params)
  │
  ├─ batch.py: validerar filer (max 60, max 15MB, tillåtna MIME-typer)
  │
  └─ batch_pipeline.py:
       ├─ group_pages_by_student(): filnamn → elevdokument (flersidiga prov grupperas)
       │
       ├─ Per elevdokument (max 3 parallellt via Semaphore):
       │    └─ gemini_vision.analyze_document():
       │         ├─ Bygger prompt med SYSTEM_INSTRUCTION (svenska, STEM-fokuserad)
       │         ├─ Skickar ALLA sidor som inline base64-bilder i ETT multimodalt anrop
       │         ├─ Gemini API (REST): generativelanguage.googleapis.com/v1beta
       │         ├─ Modell: settings.GEMINI_MODEL (just nu "gemini-3.5-flash")
       │         ├─ Structured output (JSON-schema): questions[], unlisted_questions[]
       │         ├─ Retry: max 4 försök, exponential backoff (2s-30s)
       │         ├─ Timeout: 180 sekunder per anrop
       │         └─ Vid fel: needs_review med felorsak (aldrig påhittat resultat)
       │
       └─ Returnerar StudentDocumentResult[] med scanPages (data-URL:er)
```

### AI-provider för rättning

- **Primär:** Google Gemini (`gemini-3.5-flash`) via REST API — `apps/api/app/services/gemini_vision.py`
- **API-nyckel:** `GEMINI_API_KEY` i root `.env`
- **OCR-fallback-kedja** (i `vision_ocr.py`, för facit-OCR, ej elevrättning): Gemini → OpenRouter → Groq
- **Feedback/analys** (i `feedback.py`): Groq (primary, `AI_PROVIDER=groq`) → Gemini → Anthropic
- **Wolfram** (i `wolfram.py`): Wolfram Alpha API via `WOLFRAM_APP_ID` — matematisk verifiering
- **Anthropic/Claude:** Konfigurerat i `.env` men `ANTHROPIC_API_KEY` är tom. Inte aktiv.

### Alla API-nycklar (bekräftat i root `.env`)

| Nyckel | Satt? | Används för |
|---|---|---|
| `GEMINI_API_KEY` | ✅ Ja | Rättning (gemini_vision), OCR-fallback, feedback |
| `GROQ_API_KEY` | ✅ Ja | Feedback-generering, OCR-fallback |
| `WOLFRAM_APP_ID` | ✅ Ja | Matematisk verifiering |
| `ANTHROPIC_API_KEY` | ❌ Tom | Reserverad för Claude |
| `MATHPIX_APP_ID/KEY` | ❌ Tom | Reserverad för Mathpix OCR |
| `OPENROUTER_API_KEY` | ❌ Tom | Reserverad för OpenRouter |

---

## 4. Dataskydd / GDPR

### Vilken elevdata lagras (bekräftat)

| Datatyp | Var lagras det | Format |
|---|---|---|
| **Elevnamn** | `students.name`, `grading_results.student_name`, `submissions.student_name` | Klartext i SQLite |
| **Elev-ID/identifier** | `students.identifier` | Klartext (valfritt) |
| **Skannade provsidor** | Returneras som `scanPages` (base64 data-URL:er) i batch-svaret | Sparas **inte** persistent i DB. Finns bara i Zustand under sessionen. |
| **Bedömningar** | `grading_results.steps` (JSON), `total_score`, `percentage`, `grade` | SQLite |
| **Elevarbete (transkription)** | I `steps[].studentWork` (JSON-fält i `grading_results`) | SQLite |
| **AI-feedback** | `grading_results.feedback`, `submissions.ai_feedback` | SQLite |

### Anonymisering (bekräftat i `apps/api/app/services/anonymize.py`) — GDPR Vecka 1 (klar)

- `pseudonymize_student()` skapar deterministisk pseudonym (`"Elev #A4F7"`) via SHA-256.
- `scrub_pii()` maskerar personnummer, e-post, telefonnummer **och namnliknande text** (`_NAME_LIKE`-heuristik) i fritext.
- **Används nu även** i `gemini_vision.py` (skrubbar `grading_notes` innan Gemini-prompten byggs) och `wolfram.py` (skrubbar student/correct-svar innan externt anrop). Terminalbevis: `apps/api/scripts/prove_pii_scrub.py`.
- Elevnamnet (`student_label`) skickas fortfarande **inte** till Gemini i payloaden — bara loggat lokalt.
- **⚠ Känd begränsning (best-effort, inte 100% garanti):** `_NAME_LIKE` matchar bara "Förnamn Efternamn"-mönster (två+ efterföljande versalord). Den missar: (1) enstaka förnamn utan efternamn, (2) namn med bindestreck ("Anna-Karin Svensson" scrubbas bara delvis), (3) namn som OCR:n råkar läsa i gemener. Detta är en medveten avvägning – full NER är oproportionerligt för nuvarande skala. Kandidat för Vecka 3+: korsreferera mot kända `KlassStudent.name`-värden i klassen (roster-aware scrub) istället för generisk regex.
- **⚠ Fortsatt känd risk:** Elevens handskrift (bildinnehåll) skickas alltid till Gemini API — det går inte att textbaserat skrubba en bild. Detta kräver en verifierad DPA med Google, inte kodfix.

### Bildlagring

- Skannade provbilder skickas till **Google Gemini API** (external) som base64.
- Bilderna lagras **inte** på disk eller i Supabase Storage. De existerar bara:
  1. I minnet under batch-rättning.
  2. Som data-URL:er i batch-responsen → Zustand under sessionen.
- **⚠ OKÄNT:** Googles databehandlingspolicy för Gemini API — behåller Google bilderna? Kräver kontroll av Google Gemini API Terms of Service.

### Radering / anonymisering — GDPR Vecka 2 (klar)

- **Retention-policy implementerad** i `apps/api/app/services/retention.py`, konfigurerbar via `RETENTION_ANONYMIZE_DAYS` (default 30) och `RETENTION_HARD_DELETE_DAYS` (default 90) i `config.py`:
  - Dag 30+: `GradingResult.student_name`/`student_id` pseudonymiseras (`anonymized_at` sätts). Pedagogiskt innehåll (poäng, feedback, transkription) behålls.
  - Dag 90+: raden raderas helt (hard delete).
  - Körs via `POST /api/v1/admin/retention/run` (auth-skyddad) eller `apps/api/scripts/run_retention.py` (avsedd för cron/Task Scheduler — **ingen inbyggd schemaläggare finns**, detta måste triggas externt).
  - Regressionstestat i `apps/api/tests/test_retention.py` (5 tester, isolerad in-memory DB).
- **Hard delete-endpoints** för lärarens egna data (ingen automatisk utgångstid — bara explicit radering):
  - `DELETE /api/v1/classes/{class_id}` — hela klassen (cascade: elever, prov, resultat, facit).
  - `DELETE /api/v1/classes/{class_id}/students/{student_id}` — en elev (rensar även kopplade `GradingResult` manuellt, se kod-kommentar om att `student_id` inte är en riktig FK).
  - `DELETE /api/v1/classes/tests/{test_id}` — ett prov (cascade: resultat, facit).
  - `DELETE /api/v1/results/{result_id}` — ett enskilt elevresultat.
- **TTL för provbilder: ej tillämpligt.** Skannade provsidor (`scanPages`) persisteras varken i backend-DB:n eller i frontendens Zustand-store (ingen `persist`-middleware mot `localStorage` hittad i `store.ts`) — de existerar bara i minnet under en aktiv session/request. Det finns alltså ingen server- eller klientsidig lagring att sätta TTL på idag.
- **⚠ Kvarstående begränsning:** Landningssidans påstående "rensas automatiskt efter rättning" (`login/page.tsx:43`) är fortfarande inte 1:1 vad koden gör (koden raderar efter 90 dagar, inte direkt efter rättning) — texten bör uppdateras eller policyn skärpas beroende på vad som faktiskt utlovas till kunder.
- **⚠ RISKOMRÅDE (minskat men inte eliminerat):** Innan Vecka 2 innehöll SQLite-filen (`wiseos.db`) all historisk elevdata utan utgångsdatum. Nu finns en policy och verktyg, men den körs INTE automatiskt förrän någon schemalägger `scripts/run_retention.py` eller `/api/v1/admin/retention/run` externt.

### Servrar och jurisdiktion

| Komponent | Plats | Kontroll |
|---|---|---|
| Frontend (Next.js) | localhost:3000 (dev) | Lokal |
| Backend (FastAPI) | localhost:8000 (dev) | Lokal |
| SQLite-databas | Lokal fil | Lokal |
| Supabase Auth | `octjkgjfdxgozqnzaxlo.supabase.co` | **⚠ OKÄNT** vilken region (AWS us-east-1 är default) |
| Google Gemini API | Google Cloud | **⚠ OKÄNT** dataplats |
| Groq API | Groq Cloud | **⚠ OKÄNT** dataplats |
| Wolfram Alpha API | USA | USA |

### ⚠ GDPR-flaggor (hög prioritet)

1. **Elevdata (inkl. minderårigas handskrift) skickas till tre externa AI-tjänster** utan verifierat DPA (Data Processing Agreement) med Google/Groq/Wolfram. *(Fritext skrubbas nu, se Vecka 1 — men bilder/handskrift går okrypterat/oskrubbat till Gemini, kräver DPA.)*
2. ~~Ingen radering/anonymiseringsfunktion~~ **Åtgärdat i Vecka 1–2:** `scrub_pii()` (namn/personnummer/e-post/telefon i fritext) + retention-policy (30d pseudonymisering, 90d hard delete) + explicita DELETE-endpoints. Landningssidans exakta formulering ("rensas automatiskt efter rättning") bör dock stämmas av mot den faktiska 90-dagarspolicyn.
3. **Ingen dokumenterad dataskyddspolicy, ingen DPIA** (Data Protection Impact Assessment).
4. **Serverplats okänd** för Supabase/Google/Groq — potentiellt utanför EU/EES.
5. ~~Ingen Admin/roller = ingen teknisk åtskillnad mellan lärare~~ **Åtgärdat i Vecka 1:** `teacher_id`-ägandeskap på `Klass`/`Test`/`GradingResult`, verifierat i varje endpoint (404 vid annan lärares data).

**Rekommendation:** Systemet ska **inte** användas med riktiga elevers personuppgifter förrän kvarstående punkter (DPA, DPIA, serverplats) är åtgärdade.

---

## 5. State-hantering (verifierat)

### Zustand (`lib/store.ts`)

- **Single source of truth** för `kurser`, `klasser`, `prov`, `results`, `batchProgress`.
- Alla komponenter som prenumererar på `useStore` re-renderas när relevant state ändras.

### Hydrering

- **`components/StoreHydrator.tsx`** kallar `actions.hydrate()` vid mount om `hydrated === false`.
- `actions.hydrate()`:
  1. `api.listClasses()` → GET `/api/v1/classes`
  2. `api.listTests(c.id)` per klass → GET `/api/v1/classes/{id}/tests`
  3. `api.listGradingResults()` → GET `/api/v1/results`
- Fel visas som ett enkelt felmeddelande i UI.

### Realtids-uppdateringar

- `ReviewWorkbench` pollar `actions.hydrate()` var 5:e sekund så länge något prov har `status === "grading"`.
- I övrigt: **ingen realtidskoppling** (WebSocket/SSE).

### Optimistisk uppdatering + persistens-gap

`actions.publishResults()` och `actions.updateProvStatus()` uppdaterar Zustand **först** och anropar sedan `api.updateTest()`. Men backend har **ingen PATCH-endpoint för tests** — anropet misslyckas tyst. Status ändras i UI men **sparas inte i databasen**.

---

## 6. Statusflöde för ett prov (verifierat)

```
draft → grading → review → published
```

| Status | Triggas av | Persisterat? |
|---|---|---|
| `draft` | `POST /api/v1/classes/{id}/tests` | ✅ Backend (SQLite) |
| `grading` | `actions.updateProvStatus()` i `runBatchGrade()` | ⚠ Bara Zustand (PATCH saknas i backend) |
| `review` | `actions.updateProvStatus()` efter batch-success | ⚠ Bara Zustand (PATCH saknas i backend) |
| `published` | `actions.publishResults()` → `api.updateTest()` | ⚠ Bara Zustand (PATCH saknas i backend) |

**Konsekvens:** Om sidan laddas om efter publicering visar provet fortfarande `draft` (det värde som finns i SQLite). Statusövergångar existerar bara i klientminnet.

---

## 7. Miljö / deploy (verifierat)

### Frontend miljövariabler (`apps/web/.env.local`)

| Variabel | Värde (dev) | Syfte |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend-bas |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://octjkgjfdxgozqnzaxlo.supabase.co` | Supabase Auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Supabase publik nyckel |

**OBS:** `GEMINI_API_KEY` och `GEMINI_MODEL` finns **inte** i `apps/web/.env.local`. AI-chatten (`/api/chat`) kräver dem server-side för att fungera.

### Backend miljövariabler (root `.env`)

| Variabel | Syfte |
|---|---|
| `DATABASE_URL` | `sqlite:///./wiseos.db` |
| `GEMINI_API_KEY` | Rättning + OCR |
| `GROQ_API_KEY` | Feedback + OCR-fallback |
| `WOLFRAM_APP_ID` | Matematisk verifiering |
| `AI_PROVIDER` | `groq` (styr feedback-provider) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Backend-verifiering av tokens |
| `JWT_SECRET_KEY` | Legacy auth (ej använd av frontend) |
| `CORS_ORIGINS` | `http://localhost:3000` |

### Köra lokalt

```bash
# Terminal 1 — Backend
cd apps/api
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd apps/web
pnpm dev
```

### Deploy

- **Ingen produktionsdeploy konfigurerad.** `next.config.mjs` har bara `reactStrictMode: true`.
- `docker-compose.yml` definierar Postgres men används inte idag (SQLite i praktiken).
- För produktion: byt till Postgres, konfigurera CORS strikt, sätt upp auth på alla endpoints.

---

## 8. AI-chatt — status (verifierat)

- **Frontend:** Komplett — `Chat.tsx`, `chat-service.ts`, `gemini-provider.ts`, `app/api/chat/route.ts`.
- **Routing:** `POST /api/chat` är en **Next.js API-route** (inte backend). Anropet går direkt från browser → Next.js server → Gemini API.
- **Problemet:** `GEMINI_API_KEY` saknas i `apps/web/.env.local`. Nyckel finns bara i root `.env` (som Next.js inte läser automatiskt).
- **Fix:** Lägg till `GEMINI_API_KEY=...` i `apps/web/.env.local` (server-side env, utan `NEXT_PUBLIC_`-prefix).

---

## 9. Kända begränsningar / TODO (verifierat)

### Kritiska (måste fixas)

1. **Ingen auth på V2 API-endpoints** — alla kan läsa/skriva all data.
2. **PATCH-endpoints saknas** — statusändringar (grading/review/published) sparas inte i DB.
3. **GDPR: elevdata skickas till externa AI utan DPA**, ingen radering, ingen dataskyddspolicy.
4. **Landningssidans "GDPR-säker" och "rensas automatiskt" är inte implementerat.**

### Viktiga

5. **AI-chatt** kräver `GEMINI_API_KEY` i `apps/web/.env.local`.
6. **Realtid:** Bara polling var 5:e sekund. Ingen WebSocket/SSE.
7. **Elev-vy saknas** — `published` status har ingen synlig elevvy.
8. **Ingen multi-tenant** — alla användare ser all data.

### Teknisk skuld

9. **Dubbla auth-system** (Supabase + legacy JWT/bcrypt) — bör konsolideras.
10. **V1/legacy-modell** (`assignments`/`submissions`) finns kvar parallellt med V2.
11. **Kurs-katalogen** i `store.ts` är statisk — ej redigerbar via UI.
12. **`public/`-mappen** har oanvända testbilder.
13. **SQLite** i dev — bör bytas till Postgres för produktion (docker-compose finns förberedd).

---

## 10. Git-läge (2026-08-30)

- **Aktuell dev-branch:** `ui-global-rollout-v2`
- **Backup-branch:** `backup-2026-08-30` → pushad till `github.com/tjuren-ferdinand/wiseos_backup`
- **Tag:** `v-working-2026-08-30` → pushad till `wiseos_backup`
- **Lokal backup-branch:** `working-version-2026-08-30`

---

## 11. Rekommenderad fortsättning

1. **Implementera PATCH-endpoints** i backend (tests + results + classes) — utan detta sparas inga statusändringar.
2. **Lägg till auth på alla V2-endpoints** — Supabase-token-verifiering med `Depends(get_current_supabase_user)`.
3. **Bygg AI-chatt** — fixa env-variabel, eventuellt flytta till backend för bättre kontroll.
4. **Implementera realtid** (WebSocket/SSE) för grading → review.
5. **Bygg elev-vy** för publicerade resultat.
6. **GDPR:** Implementera radering, DPA-avtal, serverplats-verifiering, DPIA.
