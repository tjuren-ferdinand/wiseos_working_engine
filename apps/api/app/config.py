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
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"
    MATHPIX_APP_ID: str = ""
    MATHPIX_APP_KEY: str = ""

    # Villkorad Automatisering: under denna tröskel flaggas inlämning för manuell granskning.
    REVIEW_CONFIDENCE_THRESHOLD: float = 0.95

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
