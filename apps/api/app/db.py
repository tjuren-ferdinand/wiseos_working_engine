from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

from .config import settings


_is_sqlite = settings.DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if _is_sqlite else {}
# sqlite:// (ren in-memory) skapar annars en tom DB per connection/tråd,
# vilket gör att init_db() i en tråd inte syns för requests i en annan.
# StaticPool delar en enda connection — påverkar inte filbaserad sqlite
# eller Postgres i produktion.
_pool = StaticPool if settings.DATABASE_URL in ("sqlite://", "sqlite:///:memory:") else None
engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    poolclass=_pool,
    future=True,
)
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

    # For production, run `alembic upgrade head` instead. `create_all` is kept
    # for dev convenience only — it is idempotent and harmless on databases
    # that are already managed by Alembic.
    Base.metadata.create_all(bind=engine)
