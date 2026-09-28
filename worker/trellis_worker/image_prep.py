"""Prepares the stored original for upload to the Space (research.md R9)."""

from __future__ import annotations

import io
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from .errors import ConversionError

MAX_SIDE = 1024


def prepare_image(raw: bytes, workdir: Path) -> Path:
    try:
        with Image.open(io.BytesIO(raw)) as opened:
            image = ImageOps.exif_transpose(opened)
            image.load()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ConversionError("INVALID_IMAGE") from exc

    # thumbnail() only ever shrinks, so small photos are left as-is.
    image.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA" if "A" in image.getbands() else "RGB")

    out = workdir / "input.png"
    image.save(out, format="PNG")
    return out
