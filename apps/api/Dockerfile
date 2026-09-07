# WiseOS API — FastAPI backend
# Build context: apps/api/ (set as service root in Railway)
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps for pymupdf/pypdf (no tesseract — unused in codebase)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Persistent volume mount point for SQLite (Railway volume -> /data)
RUN mkdir -p /data

EXPOSE 8000

# Run migrations then start the server.
# alembic.ini lives at service root; script_location = app/migrations.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
