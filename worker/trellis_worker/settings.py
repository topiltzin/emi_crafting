"""Validates a job's generation settings against stable-fast-3d's allowed ranges.

The settings themselves come from the job row (model_conversion_default_settings() in the
migration is the single source of truth); this only guards against sending out-of-range values.
Ranges: https://platform.stability.ai/docs/api-reference (POST /v2beta/3d/stable-fast-3d).
"""

from __future__ import annotations

from .errors import ConversionError

TEXTURE_RESOLUTIONS = {512, 1024, 2048}
REMESH_OPTIONS = {"none", "triangle"}
VERTEX_COUNT_RANGE = (-1, 20_000)

ALLOWED_KEYS = {"texture_resolution", "foreground_ratio", "remesh", "vertex_count"}


def _invalid(reason: str) -> ConversionError:
    err = ConversionError("INTERNAL")
    err.args = (f"Invalid generation settings: {reason}",)
    return err


def _is_number(value: object) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool)


def validate_settings(settings: dict[str, object]) -> dict[str, object]:
    unknown = set(settings) - ALLOWED_KEYS
    if unknown:
        raise _invalid(f"unknown keys {sorted(unknown)}")
    missing = ALLOWED_KEYS - set(settings)
    if missing:
        raise _invalid(f"missing keys {sorted(missing)}")

    if settings["texture_resolution"] not in TEXTURE_RESOLUTIONS:
        raise _invalid(f"texture_resolution {settings['texture_resolution']!r}")

    foreground_ratio = settings["foreground_ratio"]
    if not _is_number(foreground_ratio) or not (0.1 <= foreground_ratio <= 1.0):  # type: ignore[operator]
        raise _invalid(f"foreground_ratio {foreground_ratio!r}")

    if settings["remesh"] not in REMESH_OPTIONS:
        raise _invalid(f"remesh {settings['remesh']!r}")

    vertex_count = settings["vertex_count"]
    if not isinstance(vertex_count, int) or isinstance(vertex_count, bool):
        raise _invalid(f"vertex_count {vertex_count!r}")
    if vertex_count != -1 and not (VERTEX_COUNT_RANGE[0] <= vertex_count <= VERTEX_COUNT_RANGE[1]):
        raise _invalid(f"vertex_count {vertex_count!r}")

    return settings
