from __future__ import annotations

import hashlib
import math
import time
from collections import OrderedDict, deque
from collections.abc import Callable
from threading import Lock

from fastapi import Depends, HTTPException

from .supabase_auth import SupabaseUser, get_current_supabase_user


class UserRateLimiter:
    def __init__(
        self,
        *,
        limit: int = 10,
        window_seconds: float = 60.0,
        max_users: int = 10_000,
        clock: Callable[[], float] = time.monotonic,
    ):
        if limit < 1 or max_users < 1 or not math.isfinite(window_seconds) or window_seconds <= 0:
            raise ValueError("Rate limit, window and capacity must be positive")
        self.limit = limit
        self.window_seconds = window_seconds
        self.max_users = max_users
        self._clock = clock
        self._lock = Lock()
        self._requests: OrderedDict[bytes, deque[float]] = OrderedDict()

    def check(self, user_id: str) -> None:
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


batch_grade_limiter = UserRateLimiter()
answer_key_generate_limiter = UserRateLimiter()


async def limit_batch_grade(user: SupabaseUser = Depends(get_current_supabase_user)) -> None:
    batch_grade_limiter.check(user.id)


async def limit_answer_key_generate(user: SupabaseUser = Depends(get_current_supabase_user)) -> None:
    answer_key_generate_limiter.check(user.id)
