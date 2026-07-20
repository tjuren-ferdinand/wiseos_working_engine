# wiseOS — AI-driven rättningsplattform för STEM

**Företag:** Wisecast AB · **Produkt:** wiseOS

Hybrid-rättning: Wolfram Alpha verifierar matematisk korrekthet, Claude genererar pedagogisk feedback, Mathpix läser handskriven matematik.

## Arkitektur

```
wiseos/
├── apps/
│   ├── web/      Next.js 14 (App Router) – lärardashboard
│   └── api/      Python FastAPI – rättningsmotor
├── packages/
│   └── types/    Delade TypeScript-typer
├── docker-compose.yml
└── .env.example
```

## Snabbstart (lokalt)

### 1. Sätt upp env
```bash
cp .env.example .env
# Fyll i API-nycklar (valfritt – mock-fallback finns för alla integrationer)
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
| Anthropic Claude | `ANTHROPIC_API_KEY` | Pedagogisk feedback |
| Mathpix | `MATHPIX_APP_ID`, `MATHPIX_APP_KEY` | Handskriven OCR |

Saknas en nyckel används en deterministisk mock så hela flödet kan testas.

## Roadmap

- **MVP (v0.1)** ✅ Upload uppgift → rätta svar → feedback
- **v0.2** Klasshantering, batch-rättning, BankID-login
- **v0.3** Schoolsoft/itslearning-integration
- **v1.0** Skollicens, betygssättningsstöd
