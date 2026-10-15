"""Slow down password guessing.

After several failed logins for one email address, further attempts are refused
for a while. State is kept in memory, which is enough for a single server
process. A production system with several servers would share it through a
database or Redis.
"""

import threading
import time
from collections import deque

from app.errors import ApiError

_MAX_TRACKED_KEYS = 10_000


class LoginLimiter:
    def __init__(self) -> None:
        self._failures: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def reset(self) -> None:
        with self._lock:
            self._failures.clear()

    def _recent(self, key: str, window: int, now: float) -> deque[float]:
        attempts = self._failures.setdefault(key, deque())
        while attempts and now - attempts[0] > window:
            attempts.popleft()
        return attempts

    def check(self, key: str, max_attempts: int, window: int) -> None:
        """Raise a 429 error if this key has failed too many times recently."""
        now = time.monotonic()
        with self._lock:
            attempts = self._recent(key, window, now)
            if len(attempts) >= max_attempts:
                wait = max(1, int(window - (now - attempts[0])))
                minutes = max(1, round(wait / 60))
                raise ApiError(
                    429,
                    f"Too many failed attempts. Please try again in about {minutes} minute(s).",
                    headers={"Retry-After": str(wait)},
                )

    def record_failure(self, key: str, window: int) -> None:
        now = time.monotonic()
        with self._lock:
            if len(self._failures) > _MAX_TRACKED_KEYS:  # never let this grow without limit
                self._failures.clear()
            self._recent(key, window, now).append(now)

    def clear(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)


login_limiter = LoginLimiter()