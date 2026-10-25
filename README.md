# runlaya

Plug-and-play inference API for Laya ONNX models.
Register your models (fine-tuned or not) in the `models/` directory, then run
`choice` / `score` / `noul` predictions with per-request parameters.
Models and question parameters are configured entirely at request time.

## Features

- Plug and play: copy an ONNX model folder in, it is registered instantly without restart.
- Multi-model: run many models side by side, pick one via the `model` field per request.
- Per-request parameters: question type, instructions, and `criteria` are sent
  in the request body, keeping the codebase untouched across use cases.
- Raw output without thresholds: `choice` (label + probabilities + confidence),
  `noul` (number 0..1), `score` (number). Threshold decisions belong to the caller.
- Batch: predict many texts at once for dataset evaluation.
- Interactive API documentation at `/docs` (Scalar).

## Quick start

Requirements: Node.js >= 20, git.

```bash
git clone --recurse-submodules https://github.com/Khip01/runlaya.git
cd runlaya
./run        # Linux / macOS
run.cmd      # Windows (cmd)
```

That is all. On the first run the launcher performs the full setup
automatically, and starts the server when it is done:

- Checks Node.js >= 20.
- Creates `.env` from `.env.example` with a generated `API_TOKEN` when missing.
- Installs dependencies (`npm install --ignore-scripts`) when `node_modules/` is missing.
- Initializes the `laya-ts` submodule and builds it when needed.
- Finds a free port (3000 -> 3001 -> ... when occupied).
- Warns when the `models/` directory is still empty.
- Stops cleanly on Ctrl+C.

Every step is skipped automatically when it is already done, so later runs
go straight to starting the server.

The server runs at `http://localhost:3000`, documentation at `http://localhost:3000/docs`.

## Manual installation (alternative)

Only needed when you prefer not to use the launcher, or want to prepare
the setup separately:

```bash
npm install --ignore-scripts
npm run setup:laya    # build laya-ts from the vendor/ submodule
```

If you cloned without `--recurse-submodules`:

```bash
git submodule update --init
npm run setup:laya
```

Then start the server directly with `npm start`.

## Configuration

```bash
cp .env.example .env
```

This step is optional: the launcher creates `.env` for you when it is missing.

| Variable | Required | Default | Description |
|---|---|---|---|
| `API_TOKEN` | yes | - | Bearer token for API authentication |
| `PORT` | no | 3000 | Server port |
| `MODELS_DIR` | no | `./models/` | Directory containing model subfolders |

## Installing models

One folder = one model. The folder name becomes the `model_id`.

```
models/
  my-model/
    manifest.json        (optional)
    rl_agent_config.json
    tokenizer.json
    encoder.onnx (+ .onnx.data when weights are separate)
    head.onnx (+ .onnx.data when weights are separate)
  my-other-model/
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
    "model": "support-classifier",
    "text": "How do I get a refund for my order?",
    "questions": {
      "intent": {
        "type": "choice",
        "instructions": "What does the customer want?",
        "criteria": {
          "refund": "The customer wants their money back.",
          "shipping": "The customer asks about delivery or shipping.",
          "technical": "The customer has a technical problem.",
          "other": "Anything else."
        }
      }
    }
  }'
```

Response:

```json
{
  "model": "support-classifier",
  "answers": {
    "intent": {
      "type": "choice",
      "choice": "refund",
      "probabilities": {
        "refund": 0.9989,
        "shipping": 0.001,
        "technical": 0,
        "other": 0.0001
      },
      "confidence": 0.9932,
      "answer_confidence": 0.9989,
      "action": { "act_probability": 1 }
    }
  },
  "usage": { "input_tokens": 60, "output_tokens": 0 }
}
```

More examples (`noul` and `score` types, batch, error handling) are in [API.md](API.md).
For more request examples across all question types (3 per type), see
[EXAMPLES.md](EXAMPLES.md).

## Endpoints

| Method | Path | Function |
|---|---|---|
| GET | `/v1/models` | List installed models |
| GET | `/v1/models/:id` | Model details |
| POST | `/v1/models/:id/unload` | Unload a model from memory |
| POST | `/v1/predict` | Predict a single text |
| POST | `/v1/predict/batch` | Predict many texts |

Details in [API.md](API.md). More request examples in [EXAMPLES.md](EXAMPLES.md).

## Development

```bash
npm run typecheck
```

The agent guide is in [AGENTS.md](AGENTS.md).

## License

Apache-2.0
