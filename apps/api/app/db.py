from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings


connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    # Import models so they register with Base.metadata
    from . import models  # noqa: F401
    from sqlalchemy import text

    Base.metadata.create_all(bind=engine)

    # Lightweight idempotent migrations för Sprint A (Villkorad Automatisering).
    # Lägger till nya kolumner om en gammal DB redan finns. ALTER TABLE ADD COLUMN
    # är säkert i SQLite och Postgres när IF NOT EXISTS används.
    migrations = [
        "ALTER TABLE submissions ADD COLUMN student_pseudonym VARCHAR(32)",
        "ALTER TABLE submissions ADD COLUMN ocr_confidence FLOAT",
        "ALTER TABLE submissions ADD COLUMN wolfram_confidence FLOAT",
        "ALTER TABLE submissions ADD COLUMN confidence_overall FLOAT",
        "ALTER TABLE submissions ADD COLUMN requires_review BOOLEAN DEFAULT 0",
        "ALTER TABLE submissions ADD COLUMN review_status VARCHAR(32) DEFAULT 'auto_approved'",
        "ALTER TABLE submissions ADD COLUMN reviewed_by VARCHAR(255)",
        "ALTER TABLE submissions ADD COLUMN reviewed_at DATETIME",
        "ALTER TABLE submissions ADD COLUMN final_feedback TEXT",
        "ALTER TABLE submissions ADD COLUMN final_score INTEGER",
    ]
    with engine.begin() as conn:
        for stmt in migrations:
            try:
                conn.execute(text(stmt))
            except Exception:
                # Kolumn finns redan – ignorera
                pass
