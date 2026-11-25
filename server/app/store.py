from __future__ import annotations

import threading
import time
from typing import Any, Protocol

import redis


class EphemeralStore(Protocol):
    """O(1) store for multi-device presence, active call state, OTPs, and rate limits."""

    def add_device_sid(self, uid: str, sid: str, ttl_seconds: int = 120) -> None: ...

    def remove_device_sid(self, uid: str, sid: str) -> int: ...

    def get_device_sids(self, uid: str) -> set[str]: ...

    def is_uid_online(self, uid: str) -> bool: ...

    def online_uids(self) -> set[str]: ...

    def set_ringing_call(self, callee_uid: str, caller_uid: str, ttl_seconds: int = 60) -> None: ...

    def get_ringing_caller(self, callee_uid: str) -> str | None: ...

    def clear_ringing_call(self, callee_uid: str) -> None: ...

    def set_otp(self, key: str, otp_hash: str, ttl_seconds: int = 300) -> None: ...

    def get_otp(self, key: str) -> dict[str, Any] | None: ...

    def increment_otp_attempts(self, key: str) -> int: ...

    def delete_otp(self, key: str) -> None: ...

    def check_rate_limit(self, key: str, max_requests: int, window_seconds: int) -> bool: ...

    def clear_all(self) -> None: ...


class RedisStore:
    """Redis-backed ephemeral store for production multi-device presence and OTPs."""

    def __init__(self, redis_url: str) -> None:
        self._client = redis.Redis.from_url(redis_url, decode_responses=True)

    def add_device_sid(self, uid: str, sid: str, ttl_seconds: int = 120) -> None:
        key = f"presence:uid:{uid}"
        pipe = self._client.pipeline()
        pipe.sadd(key, sid)
        pipe.expire(key, ttl_seconds)
        pipe.execute()

    def remove_device_sid(self, uid: str, sid: str) -> int:
        key = f"presence:uid:{uid}"
        self._client.srem(key, sid)
        return int(self._client.scard(key))

    def get_device_sids(self, uid: str) -> set[str]:
        return set(self._client.smembers(f"presence:uid:{uid}"))

    def is_uid_online(self, uid: str) -> bool:
        return int(self._client.scard(f"presence:uid:{uid}")) > 0

    def online_uids(self) -> set[str]:
        result: set[str] = set()
        for key in self._client.scan_iter(match="presence:uid:*", count=100):
            if int(self._client.scard(key)) > 0:
                result.add(key.removeprefix("presence:uid:"))
        return result

    def set_ringing_call(self, callee_uid: str, caller_uid: str, ttl_seconds: int = 60) -> None:
        key = f"call:ringing:{callee_uid}"
        self._client.set(key, caller_uid, ex=ttl_seconds)

    def get_ringing_caller(self, callee_uid: str) -> str | None:
        val = self._client.get(f"call:ringing:{callee_uid}")
        return str(val) if val else None

    def clear_ringing_call(self, callee_uid: str) -> None:
        self._client.delete(f"call:ringing:{callee_uid}")

    def set_otp(self, key: str, otp_hash: str, ttl_seconds: int = 300) -> None:
        rkey = f"otp:{key}"
        pipe = self._client.pipeline()
        pipe.hset(rkey, mapping={"hash": otp_hash, "attempts": "0"})
        pipe.expire(rkey, ttl_seconds)
        pipe.execute()

    def get_otp(self, key: str) -> dict[str, Any] | None:
        data = self._client.hgetall(f"otp:{key}")
        if not data:
            return None
        return {"hash": data["hash"], "attempts": int(data.get("attempts", 0))}

    def increment_otp_attempts(self, key: str) -> int:
        return int(self._client.hincrby(f"otp:{key}", "attempts", 1))

    def delete_otp(self, key: str) -> None:
        self._client.delete(f"otp:{key}")

    def check_rate_limit(self, key: str, max_requests: int, window_seconds: int) -> bool:
        rkey = f"ratelimit:{key}"
        count = int(self._client.incr(rkey))
        if count == 1:
            self._client.expire(rkey, window_seconds)
        return count <= max_requests

    def clear_all(self) -> None:
        for prefix in ("presence:uid:*", "call:ringing:*", "otp:*", "ratelimit:*"):
            keys = list(self._client.scan_iter(match=prefix, count=200))
            if keys:
                self._client.delete(*keys)


class InMemoryStore:
    """Thread-safe in-memory store with TTL semantics for tests and single-node dev."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._presence: dict[str, tuple[set[str], float]] = {}
        self._ringing: dict[str, tuple[str, float]] = {}
        self._otps: dict[str, tuple[str, int, float]] = {}
        self._rates: dict[str, tuple[int, float]] = {}

    def _prune_presence(self, uid: str) -> set[str]:
        entry = self._presence.get(uid)
        if not entry:
            return set()
        sids, exp = entry
        if time.monotonic() > exp:
            self._presence.pop(uid, None)
            return set()
        return sids

    def add_device_sid(self, uid: str, sid: str, ttl_seconds: int = 120) -> None:
        with self._lock:
            sids = self._prune_presence(uid)
            sids.add(sid)
            self._presence[uid] = (sids, time.monotonic() + ttl_seconds)

    def remove_device_sid(self, uid: str, sid: str) -> int:
        with self._lock:
            sids = self._prune_presence(uid)
            sids.discard(sid)
            if not sids:
                self._presence.pop(uid, None)
                return 0
            return len(sids)

    def get_device_sids(self, uid: str) -> set[str]:
        with self._lock:
            return set(self._prune_presence(uid))

    def is_uid_online(self, uid: str) -> bool:
        with self._lock:
            return len(self._prune_presence(uid)) > 0

    def online_uids(self) -> set[str]:
        with self._lock:
            now = time.monotonic()
            active: set[str] = set()
            for uid in list(self._presence.keys()):
                sids, exp = self._presence[uid]
                if now <= exp and sids:
                    active.add(uid)
                else:
                    self._presence.pop(uid, None)
            return active

    def set_ringing_call(self, callee_uid: str, caller_uid: str, ttl_seconds: int = 60) -> None:
        with self._lock:
            self._ringing[callee_uid] = (caller_uid, time.monotonic() + ttl_seconds)

    def get_ringing_caller(self, callee_uid: str) -> str | None:
        with self._lock:
            entry = self._ringing.get(callee_uid)
            if not entry:
                return None
            caller, exp = entry
            if time.monotonic() > exp:
                self._ringing.pop(callee_uid, None)
                return None
            return caller

    def clear_ringing_call(self, callee_uid: str) -> None:
        with self._lock:
            self._ringing.pop(callee_uid, None)

    def set_otp(self, key: str, otp_hash: str, ttl_seconds: int = 300) -> None:
        with self._lock:
            self._otps[key] = (otp_hash, 0, time.monotonic() + ttl_seconds)

    def get_otp(self, key: str) -> dict[str, Any] | None:
        with self._lock:
            entry = self._otps.get(key)
            if not entry:
                return None
            otp_hash, attempts, exp = entry
            if time.monotonic() > exp:
                self._otps.pop(key, None)
                return None
            return {"hash": otp_hash, "attempts": attempts}

    def increment_otp_attempts(self, key: str) -> int:
        with self._lock:
            entry = self._otps.get(key)
            if not entry:
                return 0
            otp_hash, attempts, exp = entry
            attempts += 1
            self._otps[key] = (otp_hash, attempts, exp)
            return attempts

    def delete_otp(self, key: str) -> None:
        with self._lock:
            self._otps.pop(key, None)

    def check_rate_limit(self, key: str, max_requests: int, window_seconds: int) -> bool:
        with self._lock:
            now = time.monotonic()
            entry = self._rates.get(key)
            if not entry or now > entry[1]:
                self._rates[key] = (1, now + window_seconds)
                return True
            count, exp = entry
            count += 1
            self._rates[key] = (count, exp)
            return count <= max_requests

    def clear_all(self) -> None:
        with self._lock:
            self._presence.clear()
            self._ringing.clear()
            self._otps.clear()
            self._rates.clear()
