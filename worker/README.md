# 3D conversion worker

Turns craft photos into 3D models (spec `specs/009-photo-to-3d-model/`). The web app only
*queues* a conversion; this worker does the slow part:

1. Every `POLL_SECONDS` it times out stale jobs (`fail_stale_model_conversions`) and claims the
   oldest queued one (`claim_model_conversion`).
2. It downloads the original photo from the private `photos` bucket, fixes its orientation, and
   downsizes it to 1024 px.
3. It POSTs the prepared image to Stability AI's `stable-fast-3d` endpoint
   (`https://api.stability.ai/v2beta/3d/stable-fast-3d`). This is a single synchronous HTTP
   call — no session or polling — and the response body is the `.glb` itself.
4. It uploads the `.glb` to `photos/<owner>/<photo>/model-<job>.glb` and calls
   `complete_model_conversion`. That call swaps the photo's model pointer and returns the old
   file to delete. If the photo was deleted in the meantime, the worker discards its result.

Any failure is recorded with a friendly message the app shows as-is (`fail_model_conversion`).
Jobs never run longer than 10 minutes from the moment they were requested.

## Configuration

Copy `.env.example` to `.env` (git-ignored) and fill it in:

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | yes | Same project URL the web app uses. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | **Server-only.** Bypasses RLS. Never put it in the repo, `.env.local`, or `src/`. |
| `STABILITY_API_KEY` | yes | **Server-only.** From [platform.stability.ai](https://platform.stability.ai/account/keys). Never put it in the repo or `src/`. |
| `POLL_SECONDS` | no | Default `10`. |
| `WORKER_ID` | no | Default `<hostname>-<pid>`. Recorded on each job for debugging. |

**Cost:** stable-fast-3d spends Stability AI account credits per conversion — there is no free
daily quota (unlike the previous Hugging Face TRELLIS.2 backend). Keep an eye on
[your account balance](https://platform.stability.ai/account/credits); when it runs out, users
see "The 3D maker is out of energy for today — try again later."

## Run locally

```bash
cd worker
uv venv .venv && uv pip install -e ".[dev]"      # or: python -m venv .venv && pip install -e ".[dev]"
.venv/bin/python -m trellis_worker
```

## Run with Docker

```bash
docker build -t emi-3d-worker worker
docker run --restart unless-stopped --env-file worker/.env emi-3d-worker
```

Any always-on host works (a small VM, a container platform, or a home server). One instance is
plenty. The claim query uses `FOR UPDATE SKIP LOCKED`, so a second instance would also be safe.

## Logs to expect

```text
worker myhost-1234 polling every 10.0s
claimed job 6f1c… for photo 91ab…
job 6f1c… completed: <owner>/<photo>/model-6f1c….glb (2481532 bytes)
job 7d20… failed with SERVICE_QUOTA            # followed by the traceback
job 8e31… discarded: photo deleted or job no longer processing
marked 1 stale job(s) as timed out
```

At startup the worker checks that the configured Stability AI API key is valid. If it isn't, it
exits with a clear error instead of failing every job.

## Checks

```bash
.venv/bin/ruff check . && .venv/bin/ruff format --check . && .venv/bin/mypy
.venv/bin/pytest --cov=trellis_worker --cov-fail-under=80
```
