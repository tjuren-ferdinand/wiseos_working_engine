from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Projektets .env ligger i monorepo-roten (3 nivåer upp från denna fil).
# I containrar (t.ex. Railway) är filträdet grundare (/app/app/config.py) och
# det finns ingen .env — miljövariabler injiceras direkt av plattformen.
# Indexera bara parents[3] om den finns, annars kraschar importen.
_here = Path(__file__).resolve()
_ROOT_ENV = _here.parents[3] / ".env" if len(_here.parents) > 3 else None
_ENV_FILES = ([str(_ROOT_ENV)] if _ROOT_ENV else []) + [".env"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=tuple(_ENV_FILES),  # monorepo-root först (om den finns), sen lokal
        extra="ignore",
    )

    DATABASE_URL: str = "sqlite:///./wiseos.db"
    CORS_ORIGINS: str = "http://localhost:3000"
    ENABLE_LEGACY_AUTH: bool = False

    WOLFRAM_APP_ID: str = ""
    WOLFRAM_API_URL: str = ""  # Egen Wolfram Cloud-funktion (https://www.wolframcloud.com/obj/.../verifyMath)
    # Provider selection — explicit names, "auto" resolves by available API keys.
    OCR_PROVIDER: str = "auto"        # auto | mathpix | gemini | openrouter | openai
    GRADING_PROVIDER: str = "auto"    # auto | gemini | openai | anthropic
    FEEDBACK_PROVIDER: str = "auto"   # auto | anthropic | openai | gemini
    MATH_PROVIDER: str = "auto"       # auto | wolfram | local
    # OpenAI: terra för vision/bedömning, luna för textvolym.
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-5.6-terra"           # bedömning (vision)
    OPENAI_FEEDBACK_MODEL: str = "gpt-5.6-luna"   # elevfeedback + facitgenerering
    OPENAI_VISION_MODEL: str = "gpt-5.6-terra"    # OCR-fallback
    OPENAI_FALLBACK_MODELS: str = "gpt-5.6-luna"
    OPENAI_TIMEOUT_SECONDS: float = 60.0
    # Gratis vision-providers som tillfälligt ersätter Mathpix för handskrifts-OCR.
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.6-flash"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_VISION_MODEL: str = "meta-llama/llama-3.2-11b-vision-instruct:free"
    ANTHROPIC_API_KEY: str = ""
    # claude-sonnet-4-20250514 retirerades 2026-06-15 — se Anthropic
    # deprecation-schemat. 4.6-generationen använder datumfria ID:n.
    ANTHROPIC_MODEL: str = "claude-sonnet-4-6"
    MATHPIX_APP_ID: str = ""
    MATHPIX_APP_KEY: str = ""

    # Villkorad Automatisering: under denna tröskel flaggas inlämning för manuell granskning.
    REVIEW_CONFIDENCE_THRESHOLD: float = 0.95

    # GDPR-sprint v1 (Vecka 2): retention-policy för GradingResult.
    # Dag 0-30: full data (elevnamn, transkription, feedback).
    # Dag 30+: elevnamn/identitet pseudonymiseras (anonymized_at sätts).
    # Dag 90+: raden raderas helt (hard delete).
    RETENTION_ANONYMIZE_DAYS: int = 30
    RETENTION_HARD_DELETE_DAYS: int = 90

    # JWT Authentication (legacy – befintligt eget system, orört)
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60

    # --- Supabase (Fas 2: Auth / DB / Storage) ---
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Admin-gate: komma-separerade Supabase user IDs som får köra
    # globala underhållsoperationer (t.ex. retention-sweep). Tomt = ingen
    # är admin → alla autentiserade anrop till /api/v1/admin får 403.
    ADMIN_USER_IDS: str = ""
    # Komma-separerade e-postadresser som ALLTID är admin — oberoende av
    # UUID. Används som permanent undantag så att ägarkontot aldrig kan
    # låsas ute av ändringar i användar-ID:n eller framtida
    # åtkomstkontroller (domän-allowlist, pending-approval).
    ADMIN_EMAILS: str = ""

    # Admin-gate via email: komma-separerade emails som räknas som admin
    # oavsett Supabase user ID. Matchning sker lowercase/strippad.
    ADMIN_EMAILS: str = ""

    # Allowlist-seeding: komma-separerade emails som automatiskt läggs till i
    # allowed_teachers vid startup. Används för att säkra att befintliga
    # lärare inte låses ut vid första deploy av allowlist-gaten.
    INITIAL_ALLOWED_TEACHERS: str = ""

    # Ops
    ENVIRONMENT: str = "dev"  # dev | staging | prod
    SENTRY_DSN: str = ""
    # Delad rate limit-räknare över replicas. Tomt = processlokal in-memory
    # (räknaren återställs vid omstart och delas inte mellan workers).
    REDIS_URL: str = ""

    @property
    def admin_user_ids(self) -> set[str]:
        return {uid.strip() for uid in self.ADMIN_USER_IDS.split(",") if uid.strip()}

    @property
    def admin_emails(self) -> set[str]:
        return {e.strip().lower() for e in self.ADMIN_EMAILS.split(",") if e.strip()}

    @property
    def effective_grading_provider(self) -> str:
        """Resolve the grading provider."""
        return self.GRADING_PROVIDER

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
