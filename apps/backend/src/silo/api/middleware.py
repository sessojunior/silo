from __future__ import annotations

import json
import inspect
import ipaddress
import logging
import re
import time
from collections.abc import Awaitable, Callable, Sequence
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response
from starlette.types import ASGIApp, Message

from silo.api.rate_limit import GlobalRateLimiter, RateLimitDecision
from silo.api.responses import json_error_response
from silo.logging import reset_request_id, set_request_id

logger = logging.getLogger(__name__)

REQUEST_ID_HEADER = "X-Request-Id"
RESPONSE_TIME_HEADER = "X-Response-Time-Ms"
REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9_.:/=-]{1,128}$")

RateLimitIdentityResolver = Callable[[Request], str | Awaitable[str | None] | None]


class TrustedProxyMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, *, trusted_proxy_cidrs: Sequence[str] = ()) -> None:
        super().__init__(app)
        self._trusted_networks = tuple(
            ipaddress.ip_network(value, strict=False) for value in trusted_proxy_cidrs
        )

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        request.state.client_ip = self._effective_client_ip(request)
        return await call_next(request)

    def _effective_client_ip(self, request: Request) -> str:
        direct_ip = request.client.host if request.client else ""
        if not direct_ip or not self._is_trusted_proxy(direct_ip):
            return direct_ip

        forwarded_for = request.headers.get("x-forwarded-for", "")
        forwarded_ip = forwarded_for.split(",", maxsplit=1)[0].strip()
        if _is_ip_address(forwarded_ip):
            return forwarded_ip

        real_ip = request.headers.get("x-real-ip", "").strip()
        if _is_ip_address(real_ip):
            return real_ip

        return direct_ip

    def _is_trusted_proxy(self, value: str) -> bool:
        try:
            ip_address = ipaddress.ip_address(value)
        except ValueError:
            return False
        return any(ip_address in network for network in self._trusted_networks)


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        request_id = _request_id_from_headers(request) or str(uuid4())
        request.state.request_id = request_id
        token = set_request_id(request_id)
        started_at = time.perf_counter()

        try:
            response = await call_next(request)
        finally:
            reset_request_id(token)

        duration_ms = (time.perf_counter() - started_at) * 1000
        response.headers[REQUEST_ID_HEADER] = request_id
        response.headers[RESPONSE_TIME_HEADER] = f"{duration_ms:.2f}"
        logger.info(
            "HTTP request completed",
            extra={
                "context": {
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": round(duration_ms, 2),
                    "client_ip": getattr(request.state, "client_ip", None),
                }
            },
        )
        return response


class JsonBodyLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, *, max_body_bytes: int, max_json_depth: int = 64) -> None:
        super().__init__(app)
        if max_body_bytes < 1:
            raise ValueError("max_body_bytes must be >= 1")
        if max_json_depth < 1:
            raise ValueError("max_json_depth must be >= 1")
        self._max_body_bytes = max_body_bytes
        self._max_json_depth = max_json_depth

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        if not _should_limit_json_body(request):
            return await call_next(request)

        content_length = request.headers.get("content-length")
        if content_length is not None and _content_length_exceeds_limit(
            content_length,
            self._max_body_bytes,
        ):
            return _body_too_large_response()

        body = await request.body()
        if len(body) > self._max_body_bytes:
            return _body_too_large_response()
        if _json_depth_exceeds_limit(body, self._max_json_depth):
            return _json_too_deep_response()

        request_receive = _single_body_receive(body)
        request._receive = request_receive
        return await call_next(request)


class GlobalRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: ASGIApp,
        *,
        limiter: GlobalRateLimiter,
        identity_resolver: RateLimitIdentityResolver | None = None,
        api_prefix: str = "/api",
        skip_prefixes: Sequence[str] = ("/api/auth",),
    ) -> None:
        super().__init__(app)
        self._limiter = limiter
        self._identity_resolver = identity_resolver or _default_identity_resolver
        self._api_prefix = api_prefix
        self._skip_prefixes = tuple(skip_prefixes)

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        path = request.url.path
        if not path.startswith(self._api_prefix) or path.startswith(self._skip_prefixes):
            return await call_next(request)

        identity = await _resolve_identity(self._identity_resolver, request)
        key = f"api:{identity or _fallback_client_ip(request)}"
        decision = self._limiter.check(key)
        headers = _rate_limit_headers(decision)

        if not decision.allowed:
            return json_error_response(
                429,
                "Muitas requisições. Tente novamente em breve.",
                headers={**headers, "Retry-After": str(decision.retry_after_seconds)},
            )

        response = await call_next(request)
        response.headers.update(headers)
        return response


class CsrfProtectionMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: ASGIApp,
        *,
        trusted_origins: Sequence[str],
        session_cookie_names: Sequence[str] = (
            "silo_session",
            "better-auth.session_token",
            "__Secure-better-auth.session_token",
        ),
    ) -> None:
        super().__init__(app)
        self._trusted_origins = frozenset(_normalize_origin(origin) for origin in trusted_origins)
        self._session_cookie_names = tuple(session_cookie_names)

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        if request.method.upper() in {"GET", "HEAD", "OPTIONS"}:
            return await call_next(request)
        if not _has_session_cookie(request, self._session_cookie_names):
            return await call_next(request)

        origin = request.headers.get("origin")
        if origin and _normalize_origin(origin) not in self._trusted_origins:
            return json_error_response(403, "Origem não autorizada.")

        referer = request.headers.get("referer")
        if referer and _normalize_origin(referer) not in self._trusted_origins:
            return json_error_response(403, "Origem não autorizada.")

        return await call_next(request)


def _request_id_from_headers(request: Request) -> str | None:
    candidate = request.headers.get("x-request-id", "").strip()
    if not candidate or REQUEST_ID_PATTERN.fullmatch(candidate) is None:
        return None
    return candidate


def _should_limit_json_body(request: Request) -> bool:
    if request.method.upper() in {"GET", "HEAD", "OPTIONS"}:
        return False

    media_type = request.headers.get("content-type", "").split(";", maxsplit=1)[0].lower()
    return media_type == "application/json" or media_type.endswith("+json")


def _content_length_exceeds_limit(content_length: str, limit: int) -> bool:
    try:
        return int(content_length) > limit
    except ValueError:
        return False


def _body_too_large_response() -> Response:
    return json_error_response(413, "Requisição muito grande.")


def _json_too_deep_response() -> Response:
    return json_error_response(413, "JSON muito profundo.")


def _json_depth_exceeds_limit(body: bytes, max_depth: int) -> bool:
    try:
        payload = json.loads(body)
    except Exception:
        return False

    return _json_value_depth(payload, max_depth) > max_depth


def _json_value_depth(value: object, max_depth: int) -> int:
    max_seen = 1
    stack: list[tuple[object, int]] = [(value, 1)]

    while stack:
        current, depth = stack.pop()
        if depth > max_seen:
            max_seen = depth
        if max_seen > max_depth:
            return max_seen

        if isinstance(current, dict):
            for child in current.values():
                if isinstance(child, (dict, list)):
                    stack.append((child, depth + 1))
        elif isinstance(current, list):
            for child in current:
                if isinstance(child, (dict, list)):
                    stack.append((child, depth + 1))

    return max_seen


def _single_body_receive(body: bytes) -> Callable[[], Awaitable[Message]]:
    body_sent = False

    async def receive() -> Message:
        nonlocal body_sent
        if body_sent:
            return {"type": "http.request", "body": b"", "more_body": False}
        body_sent = True
        return {"type": "http.request", "body": body, "more_body": False}

    return receive


def _fallback_client_ip(request: Request) -> str:
    state_ip = getattr(request.state, "client_ip", None)
    if isinstance(state_ip, str) and state_ip:
        return f"ip:{state_ip}"
    if request.client and request.client.host:
        return f"ip:{request.client.host}"
    return "ip:unknown"


async def _resolve_identity(
    resolver: RateLimitIdentityResolver,
    request: Request,
) -> str | None:
    result = resolver(request)
    if inspect.isawaitable(result):
        resolved = await result
    else:
        resolved = result
    return resolved.strip() if isinstance(resolved, str) and resolved.strip() else None


def _default_identity_resolver(request: Request) -> str | None:
    current_user_id = getattr(request.state, "current_user_id", None)
    if isinstance(current_user_id, str) and current_user_id.strip():
        return f"user:{current_user_id.strip()}"
    return None


def _rate_limit_headers(decision: RateLimitDecision) -> dict[str, str]:
    return {
        "RateLimit-Limit": str(decision.limit),
        "RateLimit-Remaining": str(decision.remaining),
        "RateLimit-Reset": str(decision.reset_epoch_seconds),
    }


def _is_ip_address(value: str) -> bool:
    try:
        ipaddress.ip_address(value)
    except ValueError:
        return False
    return True


def _has_session_cookie(request: Request, cookie_names: Sequence[str]) -> bool:
    return any(bool(request.cookies.get(name)) for name in cookie_names)


def _normalize_origin(value: str) -> str:
    parsed = urlparse(value)
    if not parsed.scheme or not parsed.netloc:
        return value.rstrip("/")

    scheme = parsed.scheme.lower()
    host = parsed.hostname.lower() if parsed.hostname else ""
    port = f":{parsed.port}" if parsed.port is not None else ""
    return f"{scheme}://{host}{port}"
