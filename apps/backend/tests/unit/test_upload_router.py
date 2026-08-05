from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import UploadFile
from starlette.datastructures import FormData
from starlette.formparsers import MultiPartException

from silo.api.routers import upload as upload_router


class _DummyRequest:
    def __init__(self, content_type: str) -> None:
        self.headers = {"content-type": content_type}


def _payload(response) -> dict[str, object]:
    return json.loads(response.body)


def _fake_upload(filename: str = "avatar.png") -> UploadFile:
    return UploadFile(filename=filename, file=SimpleNamespace(close=lambda: None))


@pytest.mark.asyncio
async def test_upload_router_rejects_invalid_kind_and_content_type() -> None:
    invalid_kind = await upload_router.upload_file(
        kind="invalid",
        request=_DummyRequest("multipart/form-data"),
        _current_user=object(),
    )
    invalid_type = await upload_router.upload_file(
        kind="avatars",
        request=_DummyRequest("application/json"),
        _current_user=object(),
    )

    assert invalid_kind.status_code == 400
    assert "Tipo de upload" in _payload(invalid_kind)["error"]
    assert invalid_type.status_code == 400
    assert "multipart/form-data" in _payload(invalid_type)["error"]


@pytest.mark.asyncio
async def test_upload_router_covers_multipart_errors_and_success(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    request = _DummyRequest("multipart/form-data")

    async def _noop_read_upload_bytes(*args: object, **kwargs: object) -> bytes | None:
        del args, kwargs
        return b"fake"

    async def _raise_multipart_error(*args: object, **kwargs: object) -> FormData:
        del args, kwargs
        raise MultiPartException("boom")

    async def _return_form_without_file(*args: object, **kwargs: object) -> FormData:
        del args, kwargs
        return FormData([("other", "value")])

    async def _return_form_with_upload(*args: object, **kwargs: object) -> FormData:
        del args, kwargs
        return FormData([("file", _fake_upload())])

    monkeypatch.setattr(
        upload_router,
        "parse_multipart_form",
        _raise_multipart_error,
    )
    multipart_error = await upload_router.upload_file(
        kind="avatars",
        request=request,
        _current_user=object(),
    )
    assert multipart_error.status_code == 400
    assert "Envie apenas um arquivo" in _payload(multipart_error)["error"]

    monkeypatch.setattr(
        upload_router,
        "parse_multipart_form",
        _return_form_without_file,
    )
    missing_file = await upload_router.upload_file(
        kind="avatars",
        request=request,
        _current_user=object(),
    )
    assert missing_file.status_code == 400
    assert "Nenhum arquivo enviado" in _payload(missing_file)["error"]

    monkeypatch.setattr(
        upload_router,
        "parse_multipart_form",
        _return_form_with_upload,
    )
    async def _read_too_large(*args: object, **kwargs: object) -> bytes | None:
        del args, kwargs
        return None

    monkeypatch.setattr(upload_router, "read_upload_bytes", _read_too_large)
    too_large = await upload_router.upload_file(
        kind="avatars",
        request=request,
        _current_user=object(),
    )
    assert too_large.status_code == 400
    assert "Arquivo muito grande" in _payload(too_large)["error"]

    monkeypatch.setattr(upload_router, "read_upload_bytes", _noop_read_upload_bytes)
    monkeypatch.setattr(upload_router, "store_buffer_as_webp", lambda *_args, **_kwargs: {"error": "boom"})
    storage_error = await upload_router.upload_file(
        kind="avatars",
        request=request,
        _current_user=object(),
    )
    assert storage_error.status_code == 400
    assert _payload(storage_error)["error"] == "boom"

    monkeypatch.setattr(
        upload_router,
        "store_buffer_as_webp",
        lambda *_args, **_kwargs: SimpleNamespace(
            url="/uploads/avatars/avatar.webp",
            filename="avatar.webp",
        ),
    )
    success = await upload_router.upload_file(
        kind="avatars",
        request=request,
        _current_user=object(),
    )
    assert success.status_code == 201
    assert _payload(success)["success"] is True
    assert _payload(success)["data"]["filename"] == "avatar.webp"


@pytest.mark.asyncio
async def test_upload_router_serve_and_delete_routes_cover_success_and_not_found(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    file_path = tmp_path / "avatar.webp"
    file_path.write_bytes(b"data")

    monkeypatch.setattr(upload_router, "is_upload_kind", lambda kind: kind == "avatars")
    monkeypatch.setattr(upload_router, "is_safe_filename", lambda filename: filename == "avatar.webp")
    monkeypatch.setattr(
        upload_router,
        "resolve_upload_path",
        lambda kind, filename: file_path if (kind, filename) == ("avatars", "avatar.webp") else None,
    )
    monkeypatch.setattr(upload_router, "get_content_type_from_filename", lambda _filename: "image/webp")
    monkeypatch.setattr(upload_router, "delete_upload_file", lambda *_args, **_kwargs: True)

    served = await upload_router.serve_upload(
        kind="avatars",
        filename="avatar.webp",
        _current_user=object(),
    )
    assert served.status_code == 200

    missing_path = tmp_path / "missing.webp"
    monkeypatch.setattr(
        upload_router,
        "resolve_upload_path",
        lambda kind, filename: missing_path if (kind, filename) == ("avatars", "missing.webp") else None,
    )
    served_missing = await upload_router.serve_upload(
        kind="avatars",
        filename="missing.webp",
        _current_user=object(),
    )
    assert served_missing.status_code == 404
    assert "Arquivo não encontrado" in _payload(served_missing)["error"]

    monkeypatch.setattr(
        upload_router,
        "resolve_upload_path",
        lambda kind, filename: file_path
        if (kind, filename) == ("avatars", "avatar.webp")
        else (missing_path if (kind, filename) == ("avatars", "missing.webp") else None),
    )

    deleted = await upload_router.delete_upload(
        kind="avatars",
        filename="avatar.webp",
        _current_user=object(),
    )
    assert deleted["success"] is True

    monkeypatch.setattr(upload_router, "delete_upload_file", lambda *_args, **_kwargs: False)
    not_found = await upload_router.delete_upload(
        kind="avatars",
        filename="avatar.webp",
        _current_user=object(),
    )
    assert not_found.status_code == 404
    assert "Arquivo não encontrado" in _payload(not_found)["error"]

    invalid_delete = await upload_router.delete_upload(
        kind="invalid",
        filename="avatar.webp",
        _current_user=object(),
    )
    assert invalid_delete.status_code == 404
