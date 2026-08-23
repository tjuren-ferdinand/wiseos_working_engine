from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Projektets .env ligger i monorepo-roten (../../.env från denna fil).
_ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(_ROOT_ENV), ".env"),  # försök monorepo-root först, sen lokal
        extra="ignore",
    )

    DATABASE_URL: str = "sqlite:///./wiseos.db"
    CORS_ORIGINS: str = "http://localhost:3000"

    WOLFRAM_APP_ID: str = ""
    WOLFRAM_API_URL: str = ""  # Egen Wolfram Cloud-funktion (https://www.wolframcloud.com/obj/.../verifyMath)
    AI_PROVIDER: str = "groq"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    # Reservmodeller med egna dygnskvoter – används när primärmodellen är rate limitad.
    GROQ_FALLBACK_MODELS: str = "llama-3.1-8b-instant,openai/gpt-oss-20b,openai/gpt-oss-120b"
    # Multimodal Groq-modell som tillfälligt ersätter Mathpix för handskrifts-OCR.
    GROQ_VISION_MODEL: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    GROQ_TIMEOUT_SECONDS: float = 30.0
    # Gratis vision-providers som tillfälligt ersätter Mathpix för handskrifts-OCR.
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_VISION_MODEL: str = "meta-llama/llama-3.2-11b-vision-instruct:free"
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"
    MATHPIX_APP_ID: str = ""
    MATHPIX_APP_KEY: str = ""

    # Villkorad Automatisering: under denna tröskel flaggas inlämning för manuell granskning.
    REVIEW_CONFIDENCE_THRESHOLD: float = 0.95

    # JWT Authentication
    JWT_SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_use_openssl_rand_hex_32"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
