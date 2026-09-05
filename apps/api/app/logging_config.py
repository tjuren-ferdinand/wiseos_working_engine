"""Structured logging configuration.

- dev: human-readable, colored output
- staging/prod: JSON structured logging (machine-parseable)

Called once at startup from main.py.
"""
from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone


class _JsonFormatter(logging.Formatter):
    """Emit each log record as a single JSON line."""

    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info and record.exc_info[0]:
            entry["exc"] = self.formatException(record.exc_info)
        if hasattr(record, "request_id"):
            entry["request_id"] = record.request_id
        return json.dumps(entry, ensure_ascii=False)


class _DevFormatter(logging.Formatter):
    """Human-readable format for local development."""

    def format(self, record: logging.LogRecord) -> str:
        ts = datetime.fromtimestamp(record.created).strftime("%H:%M:%S")
        request_id = getattr(record, "request_id", "")
        rid = f" [{request_id}]" if request_id else ""
        return f"{ts} {record.levelname:<8} {record.name}{rid} {record.getMessage()}"


def configure_logging(environment: str = "dev") -> None:
    """Configure root logger for the given environment."""
    root = logging.getLogger()
    root.setLevel(logging.DEBUG if environment == "dev" else logging.INFO)

    # Remove existing handlers (uvicorn installs its own)
    for h in root.handlers[:]:
        root.removeHandler(h)

    handler = logging.StreamHandler(sys.stderr)
    if environment in ("staging", "prod"):
        handler.setFormatter(_JsonFormatter())
    else:
        handler.setFormatter(_DevFormatter())
    root.addHandler(handler)

    # Quiet noisy loggers
    for name in ("httpcore", "httpx", "urllib3", "asyncio"):
        logging.getLogger(name).setLevel(logging.WARNING)
