"""Meal image storage.

Uses Firebase Storage when FIREBASE_STORAGE_BUCKET is configured;
falls back to local disk otherwise (dev without Firebase).
"""
from __future__ import annotations
import os
import uuid

from fastapi import HTTPException, status

from app.core.config import get_settings
from app.core.firebase import _init_firebase

_MAGIC: list[tuple[bytes, str]] = [
    (b"\xff\xd8\xff", ".jpg"),
    (b"\x89PNG", ".png"),
    (b"GIF8", ".gif"),
]


def _validated_ext(contents: bytes) -> str:
    """Return a safe extension based on magic bytes; raise 415 for unknown types."""
    for magic, ext in _MAGIC:
        if contents[: len(magic)] == magic:
            return ext
    # WebP: RIFF container with WEBP fourcc at bytes 8-12
    if contents[:4] == b"RIFF" and contents[8:12] == b"WEBP":
        return ".webp"
    raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Only JPEG/PNG/GIF/WebP allowed")


def save_meal_image(contents: bytes) -> str:
    """Persist image bytes; return the URL to store in the DB."""
    settings = get_settings()

    ext = _validated_ext(contents)

    if settings.firebase_storage_bucket and not settings.auth_dev_bypass:
        return _upload_to_firebase(contents, ext)

    return _save_to_disk(contents, ext, settings.meal_image_dir)


def _upload_to_firebase(contents: bytes, ext: str) -> str:
    from firebase_admin import storage as fb_storage

    _init_firebase()
    bucket = fb_storage.bucket()
    mime = "image/jpeg" if ext == ".jpg" else f"image/{ext.lstrip('.')}"
    filename = f"meals/{uuid.uuid4().hex}{ext}"
    blob = bucket.blob(filename)
    blob.upload_from_string(contents, content_type=mime)
    blob.make_public()
    return blob.public_url


def _save_to_disk(contents: bytes, ext: str, image_dir: str) -> str:
    os.makedirs(image_dir, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(image_dir, safe_name)
    with open(path, "wb") as fh:
        fh.write(contents)
    settings = get_settings()
    base = f"http://{settings.app_host}:{settings.app_port}"
    if settings.app_host == "0.0.0.0":
        base = f"http://localhost:{settings.app_port}"
    return f"{base}/static/meals/{safe_name}"
