from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.engine import Connection

from silo.api.dependencies import get_db
from silo.api.errors import ApiValidationError, InfrastructureUnavailableError, UnauthenticatedError
from silo.api.responses import build_success_payload
from silo.auth.email import SmtpOtpEmailSender
from silo.auth.oauth import (
    app_redirect_url,
    build_google_login_start,
    complete_google_callback,
    consume_google_state,
    google_credentials_configured,
    should_use_legacy_contract_google_response,
)
from silo.auth.service import AuthService
from silo.auth.sessions import (
    clear_auth_cookies,
    clear_session_token,
    extract_session_token,
    get_session_by_token,
    request_ip,
    request_user_agent,
    set_session_cookie,
)
from silo.auth.validation import AuthInputError, AuthSchemaName, parse_auth_payload
from silo.config import Settings, load_settings
from silo.db.serialization import serialize_legacy_timestamp

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login/password")
async def login_password(
    request: Request,
    response: Response,
    db: Annotated[Connection, Depends(get_db)],
) -> dict[str, object]:
    payload = _parse("login_password", await _json_payload(request))
    settings = load_settings()
    service = _auth_service(db, settings)
    session = service.login_with_password(
        email=str(payload["email"]),
        password=str(payload["password"]),
        ip_address=request_ip(request),
        user_agent=request_user_agent(request),
    )
    set_session_cookie(response, session.token, settings)
    return build_success_payload({"signedIn": True}, message="Login realizado com sucesso!")


@router.post("/sign-in/email")
async def sign_in_email_compat(
    request: Request,
    response: Response,
    db: Annotated[Connection, Depends(get_db)],
) -> dict[str, object]:
    payload = _parse("login_password", await _json_payload(request))
    settings = load_settings()
    service = _auth_service(db, settings)
    session = service.login_with_password(
        email=str(payload["email"]),
        password=str(payload["password"]),
        ip_address=request_ip(request),
        user_agent=request_user_agent(request),
    )
    set_session_cookie(response, session.token, settings)
    return {
        "redirect": False,
        "token": session.session_id,
        "user": {
            "name": session.user_name,
            "email": session.user_email,
            "emailVerified": session.user_email_verified,
            "image": session.user_image,
            "createdAt": serialize_legacy_timestamp(session.user_created_at),
            "updatedAt": serialize_legacy_timestamp(session.user_updated_at),
            "id": session.user_id,
        },
    }


@router.post("/login-email/send-otp")
async def login_email_send_otp(
    request: Request,
    db: Annotated[Connection, Depends(get_db)],
) -> dict[str, object]:
    payload = _parse("login_email_send_otp", await _json_payload(request))
    service = _auth_service(db, load_settings())
    data = service.send_login_email_otp(
        email=str(payload["email"]),
        ip_address=request_ip(request),
    )
    return build_success_payload(data, message="Código enviado para seu e-mail.")


@router.post("/login-email/verify-otp")
async def login_email_verify_otp(
    request: Request,
    response: Response,
    db: Annotated[Connection, Depends(get_db)],
) -> dict[str, object]:
    payload = _parse("login_email_verify_otp", await _json_payload(request))
    settings = load_settings()
    service = _auth_service(db, settings)
    session = service.verify_login_email_otp(
        email=str(payload["email"]),
        code=str(payload["code"]),
        ip_address=request_ip(request),
        user_agent=request_user_agent(request),
    )
    set_session_cookie(response, session.token, settings)
    return build_success_payload({"signedIn": True}, message="Login realizado com sucesso!")


@router.post("/sign-up/email", status_code=201)
async def sign_up_email(
    request: Request,
    db: Annotated[Connection, Depends(get_db)],
) -> dict[str, object]:
    payload = _parse("sign_up_email", await _json_payload(request))
    service = _auth_service(db, load_settings())
    data = service.create_sign_up_email(
        name=str(payload["name"]),
        email=str(payload["email"]),
        password=str(payload["password"]),
        ip_address=request_ip(request),
    )
    return build_success_payload(data, message="Conta criada com sucesso. Verifique seu e-mail.")


@router.post("/sign-up/email/send-otp")
async def sign_up_email_send_otp(
    request: Request,
    db: Annotated[Connection, Depends(get_db)],
) -> dict[str, object]:
    payload = _parse("sign_up_email_send_otp", await _json_payload(request))
    service = _auth_service(db, load_settings())
    data = service.send_sign_up_email_otp(
        email=str(payload["email"]),
        ip_address=request_ip(request),
    )
    return build_success_payload(data, message="Código enviado para seu e-mail.")


@router.post("/sign-up/email/verify-otp")
async def sign_up_email_verify_otp(
    request: Request,
    response: Response,
    db: Annotated[Connection, Depends(get_db)],
) -> dict[str, object]:
    payload = _parse("sign_up_email_verify_otp", await _json_payload(request))
    settings = load_settings()
    service = _auth_service(db, settings)
    session = service.verify_sign_up_email_otp(
        email=str(payload["email"]),
        code=str(payload["code"]),
        password=_optional_str(payload.get("password")),
        auto_sign_in=bool(payload.get("auto_sign_in", False)),
        ip_address=request_ip(request),
        user_agent=request_user_agent(request),
    )
    signed_in = session is not None
    if session is not None:
        set_session_cookie(response, session.token, settings)
    return build_success_payload(
        {"success": True, "signedIn": signed_in},
        message="Conta verificada com sucesso.",
    )


@router.post("/forget-password")
async def forget_password(
    request: Request,
    db: Annotated[Connection, Depends(get_db)],
) -> dict[str, object]:
    payload = _parse("forget_password", await _json_payload(request))
    service = _auth_service(db, load_settings())
    data = service.send_forget_password_otp(
        email=str(payload["email"]),
        ip_address=request_ip(request),
    )
    return build_success_payload(data, message="Código enviado para seu e-mail.")


@router.post("/forget-password/verify-otp")
async def forget_password_verify_otp(
    request: Request,
    db: Annotated[Connection, Depends(get_db)],
) -> dict[str, object]:
    payload = _parse("verify_forget_password_otp", await _json_payload(request))
    service = _auth_service(db, load_settings())
    service.verify_forget_password_otp(
        email=str(payload["email"]),
        code=str(payload["code"]),
        ip_address=request_ip(request),
    )
    return build_success_payload({"step": 3}, message="Código verificado com sucesso.")


@router.post("/setup-password")
async def setup_password(
    request: Request,
    response: Response,
    db: Annotated[Connection, Depends(get_db)],
) -> dict[str, object]:
    payload = _parse("setup_password", await _json_payload(request))
    settings = load_settings()
    service = _auth_service(db, settings)
    session = service.setup_password(
        email=str(payload["email"]),
        code=str(payload["code"]),
        password=str(payload["password"]),
        auto_sign_in=bool(payload.get("auto_sign_in", False)),
        ip_address=request_ip(request),
        user_agent=request_user_agent(request),
    )
    signed_in = session is not None
    if session is not None:
        set_session_cookie(response, session.token, settings)
    return build_success_payload({"signedIn": signed_in}, message="Senha definida com sucesso.")


@router.get("/get-session")
async def get_session(
    request: Request,
    db: Annotated[Connection, Depends(get_db)],
) -> dict[str, object]:
    token = extract_session_token(request)
    if token is None:
        raise UnauthenticatedError()
    session = get_session_by_token(db, token)
    if session is None:
        raise UnauthenticatedError()
    request.state.current_user_id = session.user_id
    request.state.current_user = {
        "id": session.user_id,
        "email": session.user_email,
        "name": session.user_name,
        "is_active": True,
    }
    return session.to_get_session_payload()


@router.post("/sign-out")
async def sign_out(
    request: Request,
    response: Response,
    db: Annotated[Connection, Depends(get_db)],
) -> dict[str, object]:
    settings = load_settings()
    clear_session_token(db, extract_session_token(request))
    clear_auth_cookies(response, settings)
    return {"success": True}


@router.get("/login-google")
async def login_google(
    request: Request,
    response: Response,
    db: Annotated[Connection, Depends(get_db)],
) -> Response:
    settings = load_settings()
    if should_use_legacy_contract_google_response(settings):
        return JSONResponse(
            status_code=404,
            content={"code": "PROVIDER_NOT_FOUND", "message": "Provider not found"},
        )
    if not google_credentials_configured(settings):
        raise InfrastructureUnavailableError("Login com Google indisponível neste ambiente.")

    start = build_google_login_start(
        db,
        settings=settings,
        request=request,
        response=response,
        from_page=request.query_params.get("from"),
    )
    redirect = RedirectResponse(start.authorization_url, status_code=302)
    _copy_set_cookie_headers(source=response, target=redirect)
    return redirect


@router.get("/callback/google", name="google_callback")
async def google_callback(
    request: Request,
    db: Annotated[Connection, Depends(get_db)],
) -> Response:
    settings = load_settings()
    state = request.query_params.get("state", "")
    google_state = consume_google_state(db, state=state) if state else None
    if google_state is None:
        return RedirectResponse(
            "http://localhost:4000/api/auth/error?error=please_restart_the_process",
            status_code=302,
            headers={"Content-Type": "application/json"},
        )

    code = request.query_params.get("code", "")
    if not code:
        return RedirectResponse(app_redirect_url(settings, "/login?error=google"), status_code=302)

    try:
        session = complete_google_callback(
            db,
            settings=settings,
            code=code,
            state=google_state,
            callback_url=str(request.url_for("google_callback")),
            ip_address=request_ip(request),
            user_agent=request_user_agent(request),
        )
    except Exception:
        return RedirectResponse(app_redirect_url(settings, "/login?error=google"), status_code=302)

    redirect = RedirectResponse(app_redirect_url(settings), status_code=302)
    set_session_cookie(redirect, session.token, settings)
    return redirect


def _copy_set_cookie_headers(*, source: Response, target: Response) -> None:
    for name, value in source.raw_headers:
        if name.lower() == b"set-cookie":
            target.raw_headers.append((name, value))


async def _json_payload(request: Request) -> object:
    try:
        return await request.json()
    except ValueError as exc:
        raise ApiValidationError("Dados inválidos.") from exc


def _parse(schema_name: AuthSchemaName, payload: object) -> dict[str, Any]:
    try:
        return parse_auth_payload(schema_name, payload)
    except AuthInputError as exc:
        raise ApiValidationError(exc.message, field=exc.field) from exc


def _auth_service(connection: Connection, settings: Settings) -> AuthService:
    return AuthService(
        connection=connection,
        settings=settings,
        email_sender=SmtpOtpEmailSender(settings),
    )


def _optional_str(value: object) -> str | None:
    return value if isinstance(value, str) else None
