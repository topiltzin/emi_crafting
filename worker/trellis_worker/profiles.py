"""Queue profiles: which table, RPCs and Storage bucket one worker process serves.

`emi` (default) serves emi_crafting's photo conversions, exactly as before. `sketch` serves
your-game's model_jobs queue: the input is a Storage key on the job row (no photo lookup), and the
model is written to the sketch-runner bucket. Both profiles share the same 3D call and the same
RPC parameter names (p_job_id, p_path, p_size, p_code, p_message).
"""

from __future__ import annotations

from dataclasses import dataclass

EMI_PROFILE = "emi"
SKETCH_PROFILE = "sketch"


@dataclass(frozen=True)
class Profile:
    name: str
    claim_rpc: str
    stale_rpc: str
    complete_rpc: str
    fail_rpc: str
    input_bucket: str
    model_bucket: str
    # emi: the job points at a photos row, which holds the original's storage_path.
    # sketch: the job row carries input_key directly.
    photo_linked: bool


PROFILES: dict[str, Profile] = {
    EMI_PROFILE: Profile(
        name=EMI_PROFILE,
        claim_rpc="claim_model_conversion",
        stale_rpc="fail_stale_model_conversions",
        complete_rpc="complete_model_conversion",
        fail_rpc="fail_model_conversion",
        input_bucket="photos",
        model_bucket="photos",
        photo_linked=True,
    ),
    SKETCH_PROFILE: Profile(
        name=SKETCH_PROFILE,
        claim_rpc="claim_model_job",
        stale_rpc="fail_stale_model_jobs",
        complete_rpc="complete_model_job",
        fail_rpc="fail_model_job",
        input_bucket="sketch-runner",
        model_bucket="sketch-runner",
        photo_linked=False,
    ),
}


def get_profile(name: str) -> Profile:
    profile = PROFILES.get(name)
    if profile is None:
        known = ", ".join(sorted(PROFILES))
        raise ValueError(f"QUEUE_MODE must be one of: {known} (got {name!r})")
    return profile
