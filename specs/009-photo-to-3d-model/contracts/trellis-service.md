# Contract: TRELLIS.2 External Service (worker → Hugging Face Space)

**Feature**: 009-photo-to-3d-model
**Service**: Hugging Face Space `microsoft/TRELLIS.2` (Gradio 6.1.0, `sse_v3`), verified 2026-09-27 against `/gradio_api/info`.
**Client**: Python `gradio_client`. A single `Client` instance is used **per job**. See research R1 for why.

## Call sequence (one job)

```text
client = Client(TRELLIS_SPACE, token=HF_TOKEN)                    # new session per job

1. prepped  = client.predict(input=handle_file(local_png),
                             api_name="/preprocess_image")         # → image filepath (bg removed, cropped)
2.            client.predict(image=handle_file(prepped),
                             seed=job.seed, resolution=s.resolution,
                             ss_* / shape_slat_* / tex_slat_* = s.*,
                             api_name="/image_to_3d")               # → Html preview (ignored); latents kept in session state
3. glb_path, _ = client.predict(decimation_target=s.decimation_target,
                                texture_size=s.texture_size,
                                api_name="/extract_glb")            # → (glb filepath, download filepath)
4. read glb_path bytes immediately (Space deletes session files after ~10 min)
```

`s` is the job's `settings` jsonb. Default values (from the feature request):

| Key | Value | Valid range (Space) |
|---|---|---|
| `resolution` | `"1024"` | `"512" \| "1024" \| "1536"` |
| `ss_guidance_strength` / `_rescale` / `_sampling_steps` / `_rescale_t` | 7.5 / 0.0 / 12 / 1.0 | sliders |
| `shape_slat_guidance_strength` / `_rescale` / `_sampling_steps` / `_rescale_t` | 7.5 / 0.0 / 12 / 1.0 | sliders |
| `tex_slat_guidance_strength` / `_rescale` / `_sampling_steps` / `_rescale_t` | 7.5 / 0.0 / 12 / 1.0 | sliders |
| `decimation_target` | 100000 | 100000–500000 |
| `texture_size` | 1024 | 1024–4096, step 1024 |

**Important**: Do **not** pass a `state` argument to `/extract_glb`. The state stays in the server-side session (unlike the feature request's snippet). Steps 2 and 3 **must** use the same `client`.

## Timing

- Overall job deadline: 10 minutes from `requested_at` (FR-006). Before each step, the worker computes `remaining = deadline - now` and runs the step via `client.submit(...)` with `job.result(timeout=remaining)`. When the deadline is hit, it cancels the Gradio job and fails with `TIMEOUT`.
- Each GPU step can use up to 120 s of GPU time, plus queue wait.

## Error mapping (worker → `error_code`)

| Observed | `error_code` |
|---|---|
| Deadline reached | `TIMEOUT` |
| `AppError`/exception message matches `/GPU quota|ZeroGPU.*quota|exceeded your/i` | `SERVICE_QUOTA` |
| Connection error, HTTP 5xx, Space sleeping/building, queue full | `SERVICE_BUSY` |
| `/preprocess_image` raises an error (e.g. empty alpha bbox on a blank image), or Pillow can't decode the original | `INVALID_IMAGE` |
| GLB bytes > 52 428 800 | `RESULT_TOO_LARGE` |
| Anything else | `INTERNAL` (full traceback goes to the worker log only, never to `error_message`) |

## Retries

The worker does **not** retry automatically. A retry costs GPU quota, and the user decides whether to retry (FR-012). One exception: a single immediate reconnect on the `Client(...)` constructor if the Space returns a transient 503 while waking up.

## Privacy note

The Space's own notice says uploaded images are cached temporarily and deleted after the session. Craft photos are sent to a third-party service **only** when the user explicitly asks for a conversion (FR-002).
