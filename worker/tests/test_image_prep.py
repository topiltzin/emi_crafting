import io

import pytest
from PIL import Image

from trellis_worker.errors import ConversionError
from trellis_worker.image_prep import prepare_image


def encode(image: Image.Image, fmt: str = "JPEG", **kwargs) -> bytes:
    buf = io.BytesIO()
    image.save(buf, format=fmt, **kwargs)
    return buf.getvalue()


def test_downsizes_longest_side_keeping_aspect(tmp_path):
    out = prepare_image(encode(Image.new("RGB", (3000, 1500), "red")), tmp_path)
    with Image.open(out) as result:
        assert result.format == "PNG"
        assert result.size == (1024, 512)


def test_never_upscales(tmp_path):
    out = prepare_image(encode(Image.new("RGB", (300, 200), "blue")), tmp_path)
    with Image.open(out) as result:
        assert result.size == (300, 200)


def test_applies_exif_orientation(tmp_path):
    exif = Image.Exif()
    exif[0x0112] = 6  # rotate 90° CW on display
    raw = encode(Image.new("RGB", (400, 200), "green"), exif=exif.tobytes())
    out = prepare_image(raw, tmp_path)
    with Image.open(out) as result:
        assert result.size == (200, 400)


def test_keeps_alpha(tmp_path):
    out = prepare_image(encode(Image.new("RGBA", (50, 50), (0, 0, 0, 0)), "PNG"), tmp_path)
    with Image.open(out) as result:
        assert result.mode == "RGBA"


def test_palette_image_converted(tmp_path):
    out = prepare_image(encode(Image.new("P", (20, 20)), "PNG"), tmp_path)
    with Image.open(out) as result:
        assert result.mode in ("RGB", "RGBA")


def test_undecodable_bytes(tmp_path):
    with pytest.raises(ConversionError) as info:
        prepare_image(b"not an image", tmp_path)
    assert info.value.code == "INVALID_IMAGE"
