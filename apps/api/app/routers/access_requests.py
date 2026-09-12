"""Publika åtkomstförfrågningar — besökare på landningssidan kan begära
åtkomst till pilotprogrammet utan att skapa ett konto.

Endpoints:
  POST /api/v1/access-requests          — publik, IP-rate-limitad
  GET  /api/v1/access-requests          — admin, lista väntande förfrågningar
  PATCH /api/v1/access-requests/{id}    — admin, godkänn/avslå
"""
from __future__ import annotations

import time
from collections import OrderedDict, deque
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models
from ..services.supabase_auth import SupabaseUser
from .admin import require_admin

router = APIRouter(prefix="/api/v1/access-requests", tags=["access-requests"])

# ---------------------------------------------------------------------------
# IP-baserad rate limiting (publik endpoint — ingen user_id finns)
# ---------------------------------------------------------------------------


class IpRateLimiter:
    """Enkel IP-baserad rate limiter för publika endpoints.

    Samma sliding-window-princip som UserRateLimiter men nycklad på
    klient-IP istället för user_id.
    """

    def __init__(self, *, limit: int = 5, window_seconds: float = 60.0):
        self.limit = limit
        self.window_seconds = window_seconds
        self._lock = Lock()
        self._requests: OrderedDict[str, deque[float]] = OrderedDict()

    def check(self, ip: str) -> None:
        with self._lock:
            now = time.monotonic()
            cutoff = now - self.window_seconds
            # Rensa gamla entries
            while self._requests:
                oldest = next(iter(self._requests.values()))
                if oldest[-1] > cutoff:
                    break
                self._requests.popitem(last=False)
            requests = self._requests.get(ip)
            if requests is None:
                requests = deque()
                self._requests[ip] = requests
            while requests and requests[0] <= cutoff:
                requests.popleft()
            if len(requests) >= self.limit:
                raise HTTPException(
                    status_code=429,
                    detail="För många förfrågningar. Försök igen om en stund.",
                )
            requests.append(now)


access_request_limiter = IpRateLimiter(limit=3, window_seconds=300.0)


def _client_ip(request: Request) -> str:
    """Hämta klient-IP — respekterar X-Forwarded-For bakom reverse proxy."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class AccessRequestCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    school: str = Field(min_length=2, max_length=255)
    email: EmailStr
    message: str | None = Field(default=None, max_length=2000)


class AccessRequestResponse(BaseModel):
    id: str
    status: str
    message: str = "Tack! Vi återkommer inom kort."


class AccessRequestAdminUpdate(BaseModel):
    status: str = Field(pattern="^(pending|approved|rejected)$")


class AccessRequestListItem(BaseModel):
    id: str
    name: str
    school: str
    email: str
    message: str | None
    status: str
    created_at: str
    reviewed_at: str | None
    reviewed_by: str | None


# ---------------------------------------------------------------------------
# Publik endpoint — ingen auth krävs
# ---------------------------------------------------------------------------


@router.post("", response_model=AccessRequestResponse, status_code=201)
def create_access_request(
    body: AccessRequestCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Spara en åtkomstförfrågan från landningssidan.

    Publik endpoint — ingen autentisering. Rate-limitad per IP för att
    förhindra spam. E-postadressen normaliseras (lowercase, trim).
    """
    ip = _client_ip(request)
    access_request_limiter.check(ip)

    # Normalisera e-post
    email = body.email.strip().lower()

    # Kolla om e-post redan har en väntande förfrågan
    existing = (
        db.query(models.AccessRequest)
        .filter(
            models.AccessRequest.email == email,
            models.AccessRequest.status == "pending",
        )
        .first()
    )
    if existing:
        return AccessRequestResponse(
            id=existing.id,
            status="pending",
            message="Tack! Vi har redan tagit emot din förfrågan och återkommer inom kort.",
        )

    record = models.AccessRequest(
        name=body.name.strip(),
        school=body.school.strip(),
        email=email,
        message=body.message.strip() if body.message else None,
        status="pending",
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return AccessRequestResponse(
        id=record.id,
        status=record.status,
        message=f"Tack! Vi återkommer inom kort till {email}.",
    )


# ---------------------------------------------------------------------------
# Admin endpoints — kräver admin-behörighet
# ---------------------------------------------------------------------------


@router.get("", response_model=list[AccessRequestListItem])
def list_access_requests(
    status_filter: str = "pending",
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(require_admin),
):
    """Lista åtkomstförfrågningar — admin only.

    Filtrerar på status (pending | approved | rejected). Default: pending.
    """
    if status_filter not in ("pending", "approved", "rejected", "all"):
        raise HTTPException(422, f"Ogiltig status: {status_filter}")

    query = db.query(models.AccessRequest)
    if status_filter != "all":
        query = query.filter(models.AccessRequest.status == status_filter)
    rows = query.order_by(models.AccessRequest.created_at.desc()).all()

    return [
        AccessRequestListItem(
            id=r.id,
            name=r.name,
            school=r.school,
            email=r.email,
            message=r.message,
            status=r.status,
            created_at=r.created_at.isoformat(),
            reviewed_at=r.reviewed_at.isoformat() if r.reviewed_at else None,
            reviewed_by=r.reviewed_by,
        )
        for r in rows
    ]


@router.patch("/{request_id}", response_model=AccessRequestListItem)
def update_access_request(
    request_id: str,
    body: AccessRequestAdminUpdate,
    db: Session = Depends(get_db),
    user: SupabaseUser = Depends(require_admin),
):
    """Godkänn eller avslå en åtkomstförfrågan — admin only."""
    record = (
        db.query(models.AccessRequest)
        .filter(models.AccessRequest.id == request_id)
        .first()
    )
    if not record:
        raise HTTPException(404, "Förfrågan hittades inte")

    record.status = body.status
    record.reviewed_at = __import__("datetime").datetime.utcnow()
    record.reviewed_by = user.id
    db.commit()
    db.refresh(record)

    return AccessRequestListItem(
        id=record.id,
        name=record.name,
        school=record.school,
        email=record.email,
        message=record.message,
        status=record.status,
        created_at=record.created_at.isoformat(),
        reviewed_at=record.reviewed_at.isoformat() if record.reviewed_at else None,
        reviewed_by=record.reviewed_by,
    )
