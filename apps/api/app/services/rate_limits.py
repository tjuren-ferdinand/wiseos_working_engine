from __future__ import annotations

import hashlib
import logging
import math
import time
import uuid
from collections import OrderedDict, deque
from collections.abc import Callable
from threading import Lock

from fastapi import Depends, HTTPException

from ..config import settings
from .supabase_auth import SupabaseUser, get_current_supabase_user

logger = logging.getLogger(__name__)

# Atomiskt sliding window i Redis: samma semantik som den processlokala
# räknaren (N anrop / användare / rullande fönster). Returnerar
# {1, 0} vid tillåtet, {0, sekunder-till-nästa-slot} vid spärr.
_REDIS_SLIDING_WINDOW = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry = 0
  if oldest[2] then
    retry = tonumber(oldest[2]) + window - now
  end
  return {0, retry}
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, math.ceil(window * 1000))
return {1, 0}
"""


class UserRateLimiter:
    def __init__(
        self,
        *,
        limit: int = 10,
        window_seconds: float = 60.0,
        max_users: int = 10_000,
        clock: Callable[[], float] = time.monotonic,
        namespace: str = "default",
    ):
        if limit < 1 or max_users < 1 or not math.isfinite(window_seconds) or window_seconds <= 0:
            raise ValueError("Rate limit, window and capacity must be positive")
        self.limit = limit
        self.window_seconds = window_seconds
        self.max_users = max_users
        self._clock = clock
        self._namespace = namespace
        self._lock = Lock()
        self._requests: OrderedDict[bytes, deque[float]] = OrderedDict()
        self._redis = None

    def _redis_client(self):
        """Lazy connect — None om REDIS_URL saknas eller anslutningen misslyckas."""
        if self._redis is None:
            url = settings.REDIS_URL
            if not url:
                return None
            try:
                import redis
                self._redis = redis.Redis.from_url(
                    url, socket_timeout=1.0, socket_connect_timeout=1.0
                )
            except Exception:
                logger.warning("rate_limiter_redis_unavailable", exc_info=True)
                return None
        return self._redis

    def check(self, user_id: str) -> None:
        client = self._redis_client()
        if client is not None:
            try:
                self._check_redis(client, user_id)
                return
            except HTTPException:
                raise
            except Exception:
                # Redis-blipp → fall tillbaka på processlokal räknare så att
                # endpointen inte går ner för en infrastrukturhicka.
                logger.warning(
                    "rate_limiter_redis_error_fallback_memory", exc_info=True
                )
        self._check_memory(user_id)

    def _check_redis(self, client, user_id: str) -> None:
        # Väggklocka — fönstret måste vara delat över replicas.
        now = time.time()
        key = hashlib.sha256(user_id.encode("utf-8")).hexdigest()
        member = f"{now}:{uuid.uuid4().hex[:8]}"
        allowed, retry = client.eval(
            _REDIS_SLIDING_WINDOW,
            1,
            f"rl:{self._namespace}:{key}",
            now,
            self.window_seconds,
            self.limit,
            member,
        )
        if not int(allowed):
            self._reject(float(retry))

    def _check_memory(self, user_id: str) -> None:
        key = hashlib.sha256(user_id.encode("utf-8")).digest()
        with self._lock:
            now = self._clock()
            cutoff = now - self.window_seconds
            while self._requests:
                oldest = next(iter(self._requests.values()))
                if oldest[-1] > cutoff:
                    break
                self._requests.popitem(last=False)
            requests = self._requests.get(key)
            if requests is None:
                if len(self._requests) >= self.max_users:
                    oldest = next(iter(self._requests.values()))
                    self._reject(oldest[-1] + self.window_seconds - now)
                requests = deque()
                self._requests[key] = requests
            while requests and requests[0] <= cutoff:
                requests.popleft()
            if len(requests) >= self.limit:
                self._reject(requests[0] + self.window_seconds - now)
            requests.append(now)
            self._requests.move_to_end(key)

    @staticmethod
    def _reject(wait: float) -> None:
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please retry later.",
            headers={"Retry-After": str(max(1, math.ceil(wait)))},
        )


batch_grade_limiter = UserRateLimiter(namespace="batch-grade")
answer_key_generate_limiter = UserRateLimiter(namespace="answer-key-generate")


async def limit_batch_grade(user: SupabaseUser = Depends(get_current_supabase_user)) -> None:
    batch_grade_limiter.check(user.id)


async def limit_answer_key_generate(user: SupabaseUser = Depends(get_current_supabase_user)) -> None:
    answer_key_generate_limiter.check(user.id)
