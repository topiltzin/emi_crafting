from unittest.mock import MagicMock

from trellis_worker.storage import download_original, model_path, remove_paths, upload_model


def test_model_path_matches_constraint():
    assert model_path("o", "p", "j") == "o/p/model-j.glb"


def test_upload_and_download(fake_supabase):
    bucket = fake_supabase.storage.from_.return_value
    bucket.download.return_value = b"abc"
    assert download_original(fake_supabase, "o/p/original") == b"abc"
    upload_model(fake_supabase, "o/p/model-j.glb", b"x")
    bucket.upload.assert_called_once_with(
        "o/p/model-j.glb", b"x", {"content-type": "model/gltf-binary", "upsert": "false"}
    )
    fake_supabase.storage.from_.assert_called_with("photos")


def test_remove_skips_empty_and_swallows_errors(fake_supabase):
    bucket = fake_supabase.storage.from_.return_value
    remove_paths(fake_supabase, [])
    remove_paths(fake_supabase, [""])
    bucket.remove.assert_not_called()
    bucket.remove.side_effect = MagicMock(side_effect=RuntimeError("boom"))
    remove_paths(fake_supabase, ["a"])  # logged, not raised
