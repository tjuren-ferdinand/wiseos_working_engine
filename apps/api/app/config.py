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
    # Deprecated: use GRADING_PROVIDER instead.
    AI_PROVIDER: str = "groq"
    # Provider selection — explicit names, "auto" resolves by available API keys.
    OCR_PROVIDER: str = "auto"        # auto | mathpix | gemini | groq | openrouter
    GRADING_PROVIDER: str = "auto"    # auto | gemini | groq | anthropic
    FEEDBACK_PROVIDER: str = "auto"   # auto | groq | gemini | anthropic
    MATH_PROVIDER: str = "auto"       # auto | wolfram | local
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    # Reservmodeller med egna dygnskvoter – används när primärmodellen är rate limitad.
    GROQ_FALLBACK_MODELS: str = "llama-3.1-8b-instant,openai/gpt-oss-20b,openai/gpt-oss-120b"
    # Multimodal Groq-modell som tillfälligt ersätter Mathpix för handskrifts-OCR.
    GROQ_VISION_MODEL: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    GROQ_TIMEOUT_SECONDS: float = 30.0
    # Gratis vision-providers som tillfälligt ersätter Mathpix för handskrifts-OCR.
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.6-flash"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_VISION_MODEL: str = "meta-llama/llama-3.2-11b-vision-instruct:free"
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"
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

    # Allowlist-seeding: komma-separerade emails som automatiskt läggs till i
    # allowed_teachers vid startup. Används för att säkra att befintliga
    # lärare inte låses ut vid första deploy av allowlist-gaten.
    INITIAL_ALLOWED_TEACHERS: str = ""

    # Ops
    ENVIRONMENT: str = "dev"  # dev | staging | prod
    SENTRY_DSN: str = ""

    @property
    def admin_user_ids(self) -> set[str]:
        return {uid.strip() for uid in self.ADMIN_USER_IDS.split(",") if uid.strip()}

    @property
    def effective_grading_provider(self) -> str:
        """Resolve the grading provider, honoring deprecated AI_PROVIDER."""
        if self.GRADING_PROVIDER != "auto":
            return self.GRADING_PROVIDER
        if self.AI_PROVIDER != "groq":  # non-default AI_PROVIDER overrides
            return self.AI_PROVIDER
        return "auto"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
