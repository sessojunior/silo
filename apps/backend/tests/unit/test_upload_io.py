from __future__ import annotations

import io

import pytest
from fastapi import UploadFile
from starlette.datastructures import FormData

from silo.api.upload_io import (
    is_multipart_content_type,
    parse_multipart_form,
    read_upload_bytes,
    select_upload_from_form,
)


def test_is_multipart_content_type_matches_legacy_contract() -> None:
    assert is_multipart_content_type("multipart/form-data") is True
    assert is_multipart_content_type("multipart/related; boundary=abc") is True
    assert is_multipart_content_type("application/json") is False
    assert is_multipart_content_type(None) is False


@pytest.mark.asyncio
async def test_parse_multipart_form_delegates_request_form_arguments() -> None:
    calls: list[dict[str, object]] = []

    class _Request:
        async def form(self, **kwargs):
            calls.append(kwargs)
            return FormData()

    form = await parse_multipart_form(
        _Request(),
        max_files=2,
        max_fields=4,
        max_part_size=1234,
    )

    assert isinstance(form, FormData)
    assert calls == [
        {"max_files": 2, "max_fields": 4, "max_part_size": 1234},
    ]


def test_select_upload_from_form_prefers_first_matching_upload_field() -> None:
    upload = UploadFile(filename="example.txt", file=io.BytesIO(b"hello"))
    form = FormData(
        [
            ("other", "value"),
            ("fileToUpload", upload),
        ]
    )

    assert select_upload_from_form(form, ("file", "fileToUpload")) is upload
    assert select_upload_from_form(form, ("file",)) is None


@pytest.mark.asyncio
async def test_read_upload_bytes_returns_content_and_closes_upload() -> None:
    closed = False

    class _Upload:
        def __init__(self) -> None:
            self.chunks = [b"hel", b"lo", b""]

        async def read(self, _size: int) -> bytes:
            return self.chunks.pop(0)

        async def close(self) -> None:
            nonlocal closed
            closed = True

    buffer = await read_upload_bytes(_Upload(), max_bytes=10, chunk_size=2)

    assert buffer == b"hello"
    assert closed is True


@pytest.mark.asyncio
async def test_read_upload_bytes_returns_none_when_max_bytes_is_exceeded() -> None:
    closed = False

    class _Upload:
        async def read(self, _size: int) -> bytes:
            return b"abcdef"

        async def close(self) -> None:
            nonlocal closed
            closed = True

    buffer = await read_upload_bytes(_Upload(), max_bytes=4, chunk_size=4)

    assert buffer is None
    assert closed is True
