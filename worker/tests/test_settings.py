import pytest

from trellis_worker.errors import ConversionError
from trellis_worker.settings import validate_settings


def test_defaults_are_valid(default_settings):
    assert validate_settings(default_settings) == default_settings


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("texture_resolution", 2000),
        ("texture_resolution", "1024"),
        ("foreground_ratio", 0.0),
        ("foreground_ratio", 1.1),
        ("foreground_ratio", "0.85"),
        ("remesh", "quad"),
        ("remesh", 1),
        ("vertex_count", -2),
        ("vertex_count", 20_001),
        ("vertex_count", 12.5),
        ("vertex_count", True),
    ],
)
def test_out_of_range_rejected(default_settings, key, value):
    default_settings[key] = value
    with pytest.raises(ConversionError) as info:
        validate_settings(default_settings)
    assert info.value.code == "INTERNAL"


def test_missing_key_rejected(default_settings):
    del default_settings["texture_resolution"]
    with pytest.raises(ConversionError):
        validate_settings(default_settings)


def test_unknown_key_rejected(default_settings):
    default_settings["seed"] = 1
    with pytest.raises(ConversionError):
        validate_settings(default_settings)
