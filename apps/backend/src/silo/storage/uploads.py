from __future__ import annotations

import base64
import io
import os
import re
import tempfile
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Final, Literal, TypeGuard

from PIL import Image, ImageOps

from silo.config import load_settings

UploadKind = Literal[
    "general",
    "avatars",
    "contacts",
    "incidents",
    "problems",
    "solutions",
    "manual",
    "help",
    "projects",
    "reports",
]

UPLOAD_KINDS: Final[tuple[UploadKind, ...]] = (
    "general",
    "avatars",
    "contacts",
    "incidents",
    "problems",
    "solutions",
    "manual",
    "help",
    "projects",
    "reports",
)

MAX_FILE_SIZE_BYTES: Final[int] = 4 * 1024 * 1024
MAX_IMAGE_PIXELS: Final[int] = 24_000_000


@dataclass(frozen=True, slots=True)
class StoredUpload:
    filename: str
    original_name: str
    size: int
    url: str


def is_upload_kind(value: str) -> TypeGuard[UploadKind]:
    return value in UPLOAD_KINDS


def get_uploads_root() -> Path:
    return Path(load_settings().uploads_dir).resolve()


def ensure_upload_dir(kind: UploadKind) -> Path:
    directory = get_uploads_root() / kind
    directory.mkdir(parents=True, exist_ok=True)
    return directory.resolve()


def list_upload_files(kind: UploadKind) -> list[dict[str, object]]:
    directory = get_uploads_root() / kind
    if not directory.exists():
        return []

    items: list[dict[str, object]] = []
    for entry in directory.iterdir():
        if entry.is_symlink() or not entry.is_file():
            continue
        try:
            stat = entry.stat()
        except OSError:
            continue
        items.append(
            {
                "filename": entry.name,
                "url": f"/uploads/{kind}/{entry.name}",
                "size": stat.st_size,
                "mtime": stat.st_mtime * 1000,
            }
        )

    items.sort(key=lambda item: (-float(item["mtime"]), str(item["filename"])))
    return items


def get_upload_file_path(kind: UploadKind, filename: str) -> Path:
    return get_uploads_root() / kind / filename


def resolve_upload_path(kind: UploadKind, filename: str) -> Path | None:
    if not is_safe_filename(filename):
        return None

    raw_path = get_upload_file_path(kind, filename)
    if raw_path.is_symlink():
        return None

    uploads_root = get_uploads_root().resolve()
    file_path = raw_path.resolve()
    try:
        file_path.relative_to(uploads_root)
    except ValueError:
        return None
    return file_path


def delete_upload_file(kind: UploadKind, filename: str) -> bool:
    file_path = resolve_upload_path(kind, filename)
    if file_path is None:
        return False
    try:
        file_path.unlink(missing_ok=True)
        return True
    except OSError:
        return False


def write_upload_bytes(kind: UploadKind, filename: str, buffer: bytes) -> StoredUpload:
    directory = ensure_upload_dir(kind)
    file_path = directory / filename
    _atomic_write_bytes(file_path, buffer)
    return StoredUpload(
        filename=filename,
        original_name=filename,
        size=len(buffer),
        url=f"/uploads/{kind}/{filename}",
    )


def is_safe_filename(filename: str) -> bool:
    if not filename:
        return False
    if filename != filename.strip():
        return False
    if ".." in filename:
        return False
    if "/" in filename or "\\" in filename or ":" in filename:
        return False
    return Path(filename).name == filename


def get_content_type_from_filename(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext == ".webp":
        return "image/webp"
    if ext in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if ext == ".png":
        return "image/png"
    if ext == ".gif":
        return "image/gif"
    if ext == ".pdf":
        return "application/pdf"
    return "application/octet-stream"


def decode_base64_data_uri(value: str) -> bytes:
    if "," in value and value.lstrip().startswith("data:"):
        value = value.split(",", maxsplit=1)[1]
    return base64.b64decode(value)


def create_webp_filename(original_name: str) -> str:
    base_name = Path(original_name).stem
    safe_base_name = re.sub(r"[^a-zA-Z0-9-_]", "", base_name)[:40]
    suffix = os.urandom(6).hex()
    prefix = str(int(datetime.now(UTC).timestamp() * 1000))
    name_part = f"{safe_base_name}-" if safe_base_name else ""
    return f"{prefix}-{name_part}{suffix}.webp"


def store_image_as_webp(
    kind: UploadKind,
    original_name: str,
    buffer: bytes,
    *,
    mode: Literal["square", "inside"] = "inside",
    size: int = 128,
    max_width: int = 1920,
    max_height: int = 1080,
    quality: int = 85,
) -> StoredUpload | dict[str, str]:
    if len(buffer) > MAX_FILE_SIZE_BYTES:
        return {"error": "Arquivo muito grande. Máximo 4MB."}

    try:
        with Image.open(io.BytesIO(buffer)) as image:
            image.load()
            if image.width * image.height > MAX_IMAGE_PIXELS:
                return {"error": "Arquivo de imagem muito grande."}
            if image.format is None or image.format.lower() not in {"jpeg", "jpg", "png", "webp", "gif"}:
                return {"error": "Tipo de arquivo não permitido."}
            processed_source = ImageOps.exif_transpose(image)

        if processed_source.mode not in {"RGB", "RGBA"}:
            processed_source = processed_source.convert("RGBA")

        if mode == "square":
            processed = ImageOps.fit(
                processed_source,
                (size, size),
                method=Image.Resampling.LANCZOS,
            )
        else:
            processed = processed_source.copy()
            processed.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)

        filename = create_webp_filename(original_name)
        directory = ensure_upload_dir(kind)
        file_path = directory / filename
        _save_image_atomically(processed, file_path, quality=quality)

        return StoredUpload(
            filename=filename,
            original_name=original_name,
            size=len(buffer),
            url=f"/uploads/{kind}/{filename}",
        )
    except (OSError, ValueError, Image.DecompressionBombError, Image.UnidentifiedImageError):
        return {"error": "Erro ao processar imagem."}


def store_buffer_as_webp(
    kind: UploadKind,
    original_name: str,
    buffer: bytes,
    *,
    mode: Literal["square", "inside"] = "inside",
    size: int = 128,
    max_width: int = 1920,
    max_height: int = 1080,
    quality: int = 85,
) -> StoredUpload | dict[str, str]:
    return store_image_as_webp(
        kind,
        original_name,
        buffer,
        mode=mode,
        size=size,
        max_width=max_width,
        max_height=max_height,
        quality=quality,
    )


def _atomic_write_bytes(file_path: Path, buffer: bytes) -> None:
    file_path.parent.mkdir(parents=True, exist_ok=True)
    directory = file_path.parent.resolve()
    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=directory,
            prefix=f".{file_path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temp_file:
            temp_path = Path(temp_file.name)
            temp_file.write(buffer)
            temp_file.flush()
            os.fsync(temp_file.fileno())
        os.replace(temp_path, file_path)
        _fsync_directory(directory)
    finally:
        if temp_path is not None:
            try:
                temp_path.unlink(missing_ok=True)
            except OSError:
                pass


def _save_image_atomically(image: Image.Image, file_path: Path, *, quality: int) -> None:
    file_path.parent.mkdir(parents=True, exist_ok=True)
    directory = file_path.parent.resolve()
    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=directory,
            prefix=f".{file_path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temp_file:
            temp_path = Path(temp_file.name)
            image.save(temp_file, format="WEBP", quality=quality, method=6)
            temp_file.flush()
            os.fsync(temp_file.fileno())
        os.replace(temp_path, file_path)
        _fsync_directory(directory)
    finally:
        if temp_path is not None:
            try:
                temp_path.unlink(missing_ok=True)
            except OSError:
                pass


def _fsync_directory(directory: Path) -> None:
    try:
        dir_fd = os.open(directory, os.O_RDONLY)
    except OSError:
        return

    try:
        os.fsync(dir_fd)
    except OSError:
        pass
    finally:
        os.close(dir_fd)
