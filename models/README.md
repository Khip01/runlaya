# models/ - Laya model directory

Each subfolder in this directory is one registered model.
The folder name becomes the `model_id` sent in requests.

## Model folder structure

```
models/
  <model-id>/
    manifest.json        <- metadata (optional, for documentation)
    rl_agent_config.json <- required
    tokenizer.json       <- required (or tokenizer/tokenizer.json)
    encoder.onnx         <- required
    encoder.onnx.data    <- when present (separate weights)
    head.onnx            <- required
    head.onnx.data       <- when present (separate weights)
```

## manifest.json (optional)

The folder name is the `model_id`, not the manifest. The manifest only adds
human-readable metadata shown in `GET /v1/models`:

```json
{
  "id": "laya-base",
  "name": "Laya Base",
  "description": "Base Laya model without fine-tuning.",
  "created": "2026-10-24",
  "notes": "Baseline kept for comparison."
}
```

Without a manifest the model is still registered with `name` = folder name.
The `id` field inside the manifest is documentation only; requests always use
the folder name.

## How to install a model

1. Create a new folder, for example `models/laya-finetuned-a/`.
2. Copy the ONNX model files into it.
3. (Optional) write a `manifest.json`.
4. The model shows up in `GET /v1/models` immediately, no restart needed.

## Notes

- The contents of this directory are NOT committed to git (too large).
- `GET /v1/models` always rescans the directory, so new models are detected instantly.
- After replacing the files of a model that was already used,
  call `POST /v1/models/<id>/unload` so the model is reloaded from disk.
