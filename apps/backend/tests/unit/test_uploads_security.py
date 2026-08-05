from __future__ import annotations

import base64
import io
import json
import os
from pathlib import Path
from types import SimpleNamespace

import pytest
from PIL import Image

from silo.api.dependencies import CurrentUser
from silo.api.routers import upload as upload_router
from silo.storage import uploads


@pytest.mark.parametrize(
    "filename",
    [
        "",
        "../evil.pdf",
        "..\\evil.pdf",
        "nested/evil.pdf",
        "nested\\evil.pdf",
        "evil:pdf",
        " evil.pdf",
        "evil.pdf ",
    ],
)
def test_is_safe_filename_rejects_path_traversal(filename: str) -> None:
    assert uploads.is_safe_filename(filename) is False


def test_resolve_upload_path_rejects_path_traversal(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    uploads_root = tmp_path / "uploads"
    uploads_root.mkdir()
    (uploads_root / "reports").mkdir()
    monkeypatch.setattr(
        uploads,
        "load_settings",
        lambda: SimpleNamespace(uploads_dir=uploads_root),
    )

    safe_path = uploads.resolve_upload_path("reports", "safe-report.pdf")
    assert safe_path == (uploads_root / "reports" / "safe-report.pdf").resolve()
    assert uploads.resolve_upload_path("reports", "../safe-report.pdf") is None
    assert uploads.resolve_upload_path("reports", "..\\safe-report.pdf") is None
    assert uploads.resolve_upload_path("reports", "nested/safe-report.pdf") is None
    assert uploads.resolve_upload_path("reports", "nested\\safe-report.pdf") is None
    assert uploads.resolve_upload_path("reports", "safe-report.pdf:evil") is None


@pytest.mark.asyncio
async def test_upload_serve_route_rejects_path_traversal_filename() -> None:
    response = await upload_router.serve_upload(
        kind="avatars",
        filename="../evil.pdf",
        _current_user=CurrentUser(id="user-1", email=None, name=None),
    )

    payload = json.loads(response.body)
    assert response.status_code == 404
    assert payload == {"success": False, "error": "Arquivo não encontrado."}


def test_upload_storage_helpers_cover_real_file_and_image_paths(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    uploads_root = tmp_path / "uploads"
    uploads_root.mkdir()
    monkeypatch.setattr(
        uploads,
        "load_settings",
        lambda: SimpleNamespace(uploads_dir=uploads_root),
    )

    assert uploads.is_upload_kind("avatars")
    assert not uploads.is_upload_kind("unknown")
    assert uploads.get_uploads_root() == uploads_root.resolve()

    avatars_dir = uploads.ensure_upload_dir("avatars")
    assert avatars_dir == (uploads_root / "avatars").resolve()

    first_file = avatars_dir / "first.txt"
    second_file = avatars_dir / "second.txt"
    first_file.write_bytes(b"first")
    second_file.write_bytes(b"second")
    os.utime(first_file, (1_700_000_000, 1_700_000_000))
    os.utime(second_file, (1_700_000_100, 1_700_000_100))

    items = uploads.list_upload_files("avatars")
    assert [item["filename"] for item in items] == ["second.txt", "first.txt"]
    assert uploads.get_content_type_from_filename("picture.webp") == "image/webp"
    assert uploads.get_content_type_from_filename("picture.jpeg") == "image/jpeg"
    assert uploads.get_content_type_from_filename("file.bin") == "application/octet-stream"

    assert uploads.decode_base64_data_uri("data:text/plain;base64,SGVsbG8=") == b"Hello"
    assert uploads.decode_base64_data_uri(base64.b64encode(b"World").decode("ascii")) == b"World"

    stored_bytes = uploads.write_upload_bytes("avatars", "plain.txt", b"abc123")
    assert stored_bytes.filename == "plain.txt"
    assert (avatars_dir / "plain.txt").read_bytes() == b"abc123"

    filename = uploads.create_webp_filename("My avatar.png")
    assert filename.endswith(".webp")
    assert " " not in filename

    image = Image.new("RGB", (8, 4), color=(255, 0, 0))
    image_buffer = io.BytesIO()
    image.save(image_buffer, format="PNG")

    result = uploads.store_image_as_webp(
        "avatars",
        "avatar.png",
        image_buffer.getvalue(),
        mode="square",
        size=4,
    )

    assert isinstance(result, uploads.StoredUpload)
    assert result.original_name == "avatar.png"
    assert result.url.startswith("/uploads/avatars/")
    assert (avatars_dir / result.filename).exists()

    delegated = uploads.store_buffer_as_webp(
        "avatars",
        "avatar.png",
        image_buffer.getvalue(),
        mode="inside",
        max_width=4,
        max_height=4,
    )
    assert isinstance(delegated, uploads.StoredUpload)


def test_upload_storage_helpers_cover_delete_and_content_types(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    uploads_root = tmp_path / "uploads"
    uploads_root.mkdir()
    monkeypatch.setattr(
        uploads,
        "load_settings",
        lambda: SimpleNamespace(uploads_dir=uploads_root),
    )

    reports_dir = uploads.ensure_upload_dir("reports")
    keep_file = reports_dir / "keep.pdf"
    skip_dir = reports_dir / "nested"
    keep_file.write_bytes(b"keep")
    skip_dir.mkdir()
    os.utime(keep_file, (1_700_000_200, 1_700_000_200))

    items = uploads.list_upload_files("reports")
    assert [item["filename"] for item in items] == ["keep.pdf"]
    assert uploads.get_content_type_from_filename("file.jpg") == "image/jpeg"
    assert uploads.get_content_type_from_filename("file.gif") == "image/gif"
    assert uploads.get_content_type_from_filename("file.pdf") == "application/pdf"

    assert uploads.delete_upload_file("reports", "keep.pdf") is True
    assert not keep_file.exists()
    assert uploads.delete_upload_file("reports", "../keep.pdf") is False
    assert uploads.resolve_upload_path("reports", "keep.pdf") == (reports_dir / "keep.pdf").resolve()


def test_upload_storage_helpers_reject_large_or_unsupported_images(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    uploads_root = tmp_path / "uploads"
    uploads_root.mkdir()
    monkeypatch.setattr(
        uploads,
        "load_settings",
        lambda: SimpleNamespace(uploads_dir=uploads_root),
    )

    class _FakeImage:
        width = uploads.MAX_IMAGE_PIXELS + 1
        height = 1
        format = "png"

        def __enter__(self) -> _FakeImage:
            return self

        def __exit__(self, exc_type, exc, tb) -> bool:
            return False

        def load(self) -> None:
            return None

    class _FakeUnsupportedImage(_FakeImage):
        width = 10
        height = 10
        format = "bmp"

    monkeypatch.setattr(uploads.Image, "open", lambda _buffer: _FakeImage())
    assert uploads.store_image_as_webp("avatars", "avatar.png", b"fake") == {
        "error": "Arquivo de imagem muito grande."
    }

    monkeypatch.setattr(uploads.Image, "open", lambda _buffer: _FakeUnsupportedImage())
    assert uploads.store_image_as_webp("avatars", "avatar.bmp", b"fake") == {
        "error": "Tipo de arquivo não permitido."
    }

    monkeypatch.setattr(uploads.os, "open", lambda *_args, **_kwargs: (_ for _ in ()).throw(OSError("boom")))
    uploads._fsync_directory(tmp_path)


def test_upload_storage_helpers_reject_invalid_image_payloads(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    uploads_root = tmp_path / "uploads"
    uploads_root.mkdir()
    monkeypatch.setattr(
        uploads,
        "load_settings",
        lambda: SimpleNamespace(uploads_dir=uploads_root),
    )

    too_large = b"x" * (uploads.MAX_FILE_SIZE_BYTES + 1)
    assert uploads.store_image_as_webp("avatars", "avatar.png", too_large) == {
        "error": "Arquivo muito grande. Máximo 4MB."
    }
    assert uploads.store_image_as_webp("avatars", "avatar.txt", b"not-an-image") == {
        "error": "Erro ao processar imagem."
    }


def test_upload_storage_helpers_return_error_when_image_write_fails(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    uploads_root = tmp_path / "uploads"
    uploads_root.mkdir()
    monkeypatch.setattr(
        uploads,
        "load_settings",
        lambda: SimpleNamespace(uploads_dir=uploads_root),
    )

    image = Image.new("RGB", (8, 4), color=(255, 0, 0))
    image_buffer = io.BytesIO()
    image.save(image_buffer, format="PNG")

    def failing_save_image(*_args, **_kwargs) -> None:
        raise OSError("read only volume")

    monkeypatch.setattr(uploads, "_save_image_atomically", failing_save_image)

    assert uploads.store_image_as_webp("avatars", "avatar.png", image_buffer.getvalue()) == {
        "error": "Erro ao processar imagem."
    }


def test_upload_storage_helpers_cover_missing_directory_symlink_and_delete_errors(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    uploads_root = tmp_path / "uploads"
    uploads_root.mkdir()
    monkeypatch.setattr(
        uploads,
        "load_settings",
        lambda: SimpleNamespace(uploads_dir=uploads_root),
    )

    assert uploads.list_upload_files("missing-kind") == []

    reports_dir = uploads.ensure_upload_dir("reports")
    safe_file = reports_dir / "safe.pdf"
    safe_file.write_bytes(b"safe")
    symlink_file = reports_dir / "linked.pdf"
    symlink_file.write_text("linked")

    monkeypatch.setattr(
        uploads.Path,
        "is_symlink",
        lambda self: self.name == "linked.pdf",
    )
    assert uploads.resolve_upload_path("reports", "linked.pdf") is None

    monkeypatch.setattr(
        uploads.Path,
        "unlink",
        lambda self, missing_ok=True: (_ for _ in ()).throw(OSError("boom")),
    )
    assert uploads.delete_upload_file("reports", "safe.pdf") is False


def test_upload_storage_helpers_convert_grayscale_images(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    uploads_root = tmp_path / "uploads"
    uploads_root.mkdir()
    monkeypatch.setattr(
        uploads,
        "load_settings",
        lambda: SimpleNamespace(uploads_dir=uploads_root),
    )

    image = Image.new("L", (8, 8), color=128)
    image_buffer = io.BytesIO()
    image.save(image_buffer, format="PNG")

    result = uploads.store_image_as_webp(
        "avatars",
        "avatar-gray.png",
        image_buffer.getvalue(),
        mode="inside",
    )

    assert isinstance(result, uploads.StoredUpload)
    assert result.filename.endswith(".webp")


def test_upload_storage_helpers_cover_stat_resolve_and_unlink_error_branches(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    uploads_root = tmp_path / "uploads"
    uploads_root.mkdir()
    monkeypatch.setattr(
        uploads,
        "load_settings",
        lambda: SimpleNamespace(uploads_dir=uploads_root),
    )

    reports_dir = uploads.ensure_upload_dir("reports")

    class _FakeEntry:
        def __init__(
            self,
            name: str,
            *,
            is_symlink: bool = False,
            is_file: bool = True,
            raise_stat: bool = False,
            size: int = 1,
            mtime: float = 1_700_000_000,
        ) -> None:
            self.name = name
            self._is_symlink = is_symlink
            self._is_file = is_file
            self._raise_stat = raise_stat
            self._size = size
            self._mtime = mtime

        def is_symlink(self) -> bool:
            return self._is_symlink

        def is_file(self) -> bool:
            return self._is_file

        def stat(self):  # type: ignore[no-untyped-def]
            if self._raise_stat:
                raise OSError("stat failed")
            return SimpleNamespace(st_size=self._size, st_mtime=self._mtime)

    monkeypatch.setattr(
        uploads.Path,
        "iterdir",
        lambda self: iter(
            [
                _FakeEntry("skip-link", is_symlink=True),
                _FakeEntry("skip-dir", is_file=False),
                _FakeEntry("broken.txt", raise_stat=True),
                _FakeEntry("keep.txt", size=3, mtime=1_700_000_123),
            ]
        ),
    )
    items = uploads.list_upload_files("reports")
    assert [item["filename"] for item in items] == ["keep.txt"]

    class _FakeRawPath:
        def __init__(self, resolved: Path) -> None:
            self._resolved = resolved

        def is_symlink(self) -> bool:
            return False

        def resolve(self) -> Path:
            return self._resolved

    monkeypatch.setattr(
        uploads,
        "get_upload_file_path",
        lambda kind, filename: _FakeRawPath((uploads_root.parent / "escape.pdf").resolve()),
    )
    monkeypatch.setattr(uploads, "is_safe_filename", lambda filename: True)
    assert uploads.resolve_upload_path("reports", "escape.pdf") is None

    class _UnlinkPath:
        def unlink(self, missing_ok: bool = True) -> None:
            del missing_ok
            raise OSError("boom")

    monkeypatch.setattr(uploads, "resolve_upload_path", lambda kind, filename: _UnlinkPath())
    assert uploads.delete_upload_file("reports", "keep.txt") is False

    assert uploads.get_content_type_from_filename("picture.png") == "image/png"


def test_upload_storage_helpers_cover_atomic_write_and_image_save(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    uploads_root = tmp_path / "uploads"
    uploads_root.mkdir()
    monkeypatch.setattr(
        uploads,
        "load_settings",
        lambda: SimpleNamespace(uploads_dir=uploads_root),
    )

    atomic_path = uploads_root / "avatars" / "atomic.bin"
    uploads._atomic_write_bytes(atomic_path, b"atomic-bytes")  # noqa: SLF001
    assert atomic_path.read_bytes() == b"atomic-bytes"

    image = Image.new("RGB", (8, 4), color=(10, 20, 30))
    image_path = uploads_root / "avatars" / "avatar.webp"
    uploads._save_image_atomically(image, image_path, quality=80)  # noqa: SLF001
    assert image_path.exists()
    with Image.open(image_path) as saved_image:
        saved_image.load()
        assert saved_image.format == "WEBP"
