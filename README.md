# runlaya

Plug-and-play inference API for Laya ONNX models.
Register your models (fine-tuned or not) in the `models/` directory, then run
`choice` / `score` / `noul` predictions with per-request parameters.
No code changes needed.

## Features

- Plug and play: copy an ONNX model folder in, it is registered instantly without restart.
- Multi-model: run many models side by side, pick one via the `model` field per request.
- Per-request parameters: question type, instructions, and `criteria` are sent
  in the request body, perfect for experiments (full vs minimal criteria).
- Raw output without thresholds: `choice` (label + probabilities + confidence),
  `noul` (number 0..1), `score` (number). Threshold decisions belong to the caller.
- Batch: predict many texts at once for dataset evaluation.
- Interactive API documentation at `/docs` (Scalar).

## Installation

Requirements: Node.js >= 20, git.

```bash
git clone --recurse-submodules https://github.com/Khip01/runlaya.git
cd runlaya
npm install --ignore-scripts
npm run setup:laya    # build laya-ts from the vendor/ submodule
```

If you forgot `--recurse-submodules`:

```bash
git submodule update --init
npm run setup:laya
```

## Configuration

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `API_TOKEN` | yes | - | Bearer token for API authentication |
| `PORT` | no | 3000 | Server port |
| `MODELS_DIR` | no | `./models/` | Directory containing model subfolders |

## Running

```bash
npm start
```

The server runs at `http://localhost:3000`, documentation at `http://localhost:3000/docs`.

## Installing models

One folder = one model. The folder name becomes the `model_id`.

```
models/
  laya-base/
    manifest.json        (optional)
    rl_agent_config.json
    tokenizer.json
    encoder.onnx (+ .onnx.data when weights are separate)
    head.onnx (+ .onnx.data when weights are separate)
  laya-finetuned-a/
    ...
```

See [models/README.md](models/README.md) for full details.

## Usage examples

List models:

```bash
curl -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/v1/models
```

Predict (all parameters sent per request):

```bash
curl -X POST http://localhost:3000/v1/predict \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "laya-base",
    "text": "What is the registration fee at Polinema?",
    "questions": {
      "topik": {
        "type": "choice",
        "instructions": "Which category does the user message belong to?",
        "criteria": {
          "pendaftaran": "Questions about university admission.",
          "luar-topik": "Not about Polinema."
        }
      }
    }
  }'
```

Response:

```json
{
  "model": "laya-base",
  "answers": {
    "topik": {
      "type": "choice",
      "choice": "pendaftaran",
      "probabilities": { "pendaftaran": 0.9984, "luar-topik": 0.0016 },
      "confidence": 0.9911,
      "answer_confidence": 0.9984,
      "action": { "act_probability": 1 }
    }
  },
  "usage": { "input_tokens": 105, "output_tokens": 0 }
}
```

More examples (`noul` and `score` types, batch, error handling) are in [API.md](API.md).

## Endpoints

| Method | Path | Function |
|---|---|---|
| GET | `/v1/models` | List installed models |
| GET | `/v1/models/:id` | Model details |
| POST | `/v1/models/:id/unload` | Unload a model from memory |
| POST | `/v1/predict` | Predict a single text |
| POST | `/v1/predict/batch` | Predict many texts |

Details in [API.md](API.md).

## Development

```bash
npm run typecheck
```

The agent guide is in [AGENTS.md](AGENTS.md).

## License

Apache-2.0
