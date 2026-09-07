# wiseOS — AI-driven rättningsplattform för STEM

**Företag:** Wisecast AB · **Produkt:** wiseOS

Hybrid-rättning: Wolfram Alpha verifierar matematisk korrekthet, Claude genererar pedagogisk feedback, Mathpix läser handskriven matematik.

Aktuell MVP-gren: `2026-08-16-v1.0` — innehåller Equi-designsystem, mörkt läge, mobil-först UI och en tillfällig Gemini AI-integration bakom ett provider-abstraktion så att Claude kan ersätta den senare med minimala ändringar.

## Arkitektur

```
wiseos/
├── apps/
│   ├── web/      Next.js 14 (App Router) – lärardashboard
│   └── api/      Python FastAPI – rättningsmotor
├── lib/ai        AI-provider-abstraktion (GeminiProvider, klart för ClaudeProvider)
├── app/api/chat  Server-side AI-proxy – API-nycklar lämnar aldrig klienten
└── .env.local.example
```

## Snabbstart (lokalt)

### 1. Sätt upp env
```bash
cp .env.local.example .env.local
# Fyll i API-nycklar (valfritt – mock-fallback finns för de flesta integrationer)
```

### 2. Starta databas
```bash
docker compose up -d postgres
```

### 3. Backend (FastAPI)
```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate     # Windows
# source .venv/bin/activate # macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
API: http://localhost:8000 · Docs: http://localhost:8000/docs

### 4. Frontend (Next.js)
```bash
cd apps/web
pnpm install   # eller npm install
pnpm dev
```
Öppna http://localhost:3000

## API-nycklar (valfria för dev)

| Tjänst | Env-variabel | Syfte |
|--------|--------------|-------|
| Wolfram Alpha | `WOLFRAM_APP_ID` | Matematisk verifiering |
| Anthropic Claude | `ANTHROPIC_API_KEY` | Pedagogisk feedback (planerad) |
| Google Gemini | `GEMINI_API_KEY` | Tillfällig AI-assistent (server-side) |
| Mathpix | `MATHPIX_APP_ID`, `MATHPIX_APP_KEY` | Handskriven OCR |

Saknas en nyckel används en deterministisk mock så hela flödet kan testas.

## Roadmap

- **MVP (v0.1)** ✅ Upload uppgift → rätta svar → feedback
- **v0.2** Klasshantering, batch-rättning, BankID-login
- **v0.3** Schoolsoft/itslearning-integration
- **v1.0** Skollicens, betygssättningsstöd
