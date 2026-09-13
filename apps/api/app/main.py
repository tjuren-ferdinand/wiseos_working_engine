from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .config import settings
from .db import engine, init_db
from .logging_config import configure_logging
from .middleware.request_id import RequestIDMiddleware
from .routers import admin, ocr, wolfram_test, batch, classes, courses, results, claude, supabase_auth, access_requests
from .services.batch_pipeline import integration_status
from .services.gemini_client import ping as gemini_ping

# Structured logging — JSON in prod/staging, human-readable in dev
configure_logging(environment=settings.ENVIRONMENT)

# Sentry — only when SENTRY_DSN is set
if settings.SENTRY_DSN:
    import sentry_sdk
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        traces_sample_rate=0.1,
    )

app = FastAPI(
    title="wiseOS API",
    version="0.1.0",
    description="AI-driven rättningsplattform för STEM (Wisecast AB)",
)

app.add_middleware(RequestIDMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.on_event("startup")
def _startup():
    init_db()
    _seed_allowlist()


def _seed_allowlist():
    """Lägg till INITIAL_ALLOWED_TEACHERS-emails i allowed_teachers om de inte finns."""
    from .db import SessionLocal
    from . import models
    emails = {
        e.strip().lower()
        for e in settings.INITIAL_ALLOWED_TEACHERS.split(",")
        if e.strip()
    }
    if not emails:
        return
    db = SessionLocal()
    try:
        existing = {
            r.email for r in db.query(models.AllowedTeacher).filter(
                models.AllowedTeacher.email.in_(emails)
            ).all()
        }
        for email in emails - existing:
            db.add(models.AllowedTeacher(email=email, created_by="system"))
        db.commit()
    finally:
        db.close()


@app.get("/")
def root():
    return {
        "name": "wiseOS API",
        "version": "0.1.0",
        "docs": "/docs",
        "integrations": integration_status(),
    }


@app.get("/health")
def health():
    """Shallow liveness — always returns ok."""
    return {"status": "ok"}


@app.get("/health/ready")
def health_ready():
    """Readiness probe — verifies DB connectivity."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        return {"status": "not_ready", "database": f"error: {type(e).__name__}"}


@app.get("/health/integrations")
async def health_integrations():
    """Djuptest av konfigurerade providers – anropar dem faktiskt."""
    status = integration_status()
    status["gemini_reachable"] = await gemini_ping()
    return status


app.include_router(ocr.router)
app.include_router(wolfram_test.router)
app.include_router(batch.router)
app.include_router(classes.router)
app.include_router(courses.router)
app.include_router(results.router)
app.include_router(claude.router)
app.include_router(supabase_auth.router)
app.include_router(admin.router)
app.include_router(access_requests.router)
