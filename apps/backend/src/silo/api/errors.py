from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class ApiError(Exception):
    status_code: int
    error: str
    data: object | None = None
    field: str | None = None
    retry_after_seconds: int | None = None
    reset_flow: bool | None = None


class ApiValidationError(ApiError):
    def __init__(
        self,
        error: str = "Dados inválidos.",
        *,
        field: str | None = None,
        data: object | None = None,
    ) -> None:
        super().__init__(status_code=400, error=error, data=data, field=field)


class UnauthenticatedError(ApiError):
    def __init__(
        self, error: str = "Usuário não autenticado.", *, data: object | None = None
    ) -> None:
        super().__init__(status_code=401, error=error, data=data)


class ForbiddenError(ApiError):
    def __init__(self, error: str = "Permissão negada.", *, data: object | None = None) -> None:
        super().__init__(status_code=403, error=error, data=data)


class NotFoundError(ApiError):
    def __init__(
        self,
        error: str = "Recurso não encontrado.",
        *,
        data: object | None = None,
    ) -> None:
        super().__init__(status_code=404, error=error, data=data)


class ConflictError(ApiError):
    def __init__(
        self,
        error: str = "Conflito ao processar requisição.",
        *,
        data: object | None = None,
    ) -> None:
        super().__init__(status_code=409, error=error, data=data)


class RateLimitedError(ApiError):
    def __init__(
        self,
        error: str = "Muitas requisições. Tente novamente em breve.",
        *,
        retry_after_seconds: int = 60,
        data: object | None = None,
    ) -> None:
        super().__init__(
            status_code=429,
            error=error,
            data=data,
            retry_after_seconds=retry_after_seconds,
        )


class InfrastructureUnavailableError(ApiError):
    def __init__(
        self,
        error: str = "Serviço temporariamente indisponível.",
        *,
        data: object | None = None,
    ) -> None:
        super().__init__(status_code=503, error=error, data=data)


class InternalApiError(ApiError):
    def __init__(
        self,
        error: str = "Erro interno do servidor",
        *,
        data: object | None = None,
    ) -> None:
        super().__init__(status_code=500, error=error, data=data)
