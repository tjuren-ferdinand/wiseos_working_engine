from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .routers import assignments, submissions, ocr, wolfram_test, batch, auth, classes, results, claude
from .services.batch_pipeline import integration_status

app = FastAPI(
    title="wiseOS API",
    version="0.1.0",
    description="AI-driven rättningsplattform för STEM (Wisecast AB)",
)

app.add_middleware(
    CORSMiddleware,
    # Tillåt localhost och 127.0.0.1 på alla portar för utveckling (browser preview-proxyn
    # spinnar upp slumpmässiga portar). I produktion: konfigurera CORS_ORIGINS strikt.
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    init_db()


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
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(assignments.router)
app.include_router(submissions.router)
app.include_router(ocr.router)
app.include_router(wolfram_test.router)
app.include_router(batch.router)
app.include_router(classes.router)
app.include_router(results.router)
app.include_router(claude.router)


# Alias enligt mega-prompten: stateless rättning på /api/v1/grade
from .schemas import QuickGradeRequest, QuickGradeResponse  # noqa: E402
from .routers.submissions import quick_grade  # noqa: E402


@app.post("/api/v1/grade", response_model=QuickGradeResponse, tags=["grade"])
async def grade_alias(req: QuickGradeRequest):
    return await quick_grade(req)
