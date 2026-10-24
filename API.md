# API Reference

Base URL: `http://localhost:3000` (or whatever `PORT` is set to).

Interactive documentation: `http://localhost:3000/docs` (Scalar).
Raw OpenAPI spec: `http://localhost:3000/openapi.json`.

## Authentication

All `/v1/*` endpoints require a Bearer token:

```
Authorization: Bearer <API_TOKEN>
```

Without a valid token:

```json
{ "error": "unauthorized", "message": "Invalid or missing token." }
```

## Models

A model is registered by placing a folder in the `models/` directory
(or `MODELS_DIR`). The folder name IS the `model_id`, which is what the
`model` field in requests refers to. `manifest.json` is optional extra
metadata for humans (shown in `GET /v1/models`), it does NOT define the
model ID. See [models/README.md](models/README.md) for the folder structure.

---

## GET /v1/models

List all installed models with their status.

**Response 200**

```json
{
  "models": [
    {
      "id": "incomplete-model",
      "name": "incomplete-model",
      "description": "",
      "created": "",
      "notes": "",
      "ready": false,
      "missingFiles": ["rl_agent_config.json", "encoder.onnx", "head.onnx", "tokenizer.json"],
      "loaded": false
    },
    {
      "id": "support-classifier",
      "name": "Support Classifier",
      "description": "Example model for customer support routing.",
      "created": "2026-10-24",
      "notes": "Example manifest, this field is free text.",
      "ready": true,
      "missingFiles": [],
      "loaded": false
    }
  ]
}
```

- `ready`: `true` when all required model files exist.
- `loaded`: `true` when the model is loaded into memory.

## GET /v1/models/:id

Details for a single model. Same shape as the `models` items above.

**Response 200**

```json
{
  "id": "support-classifier",
  "name": "Support Classifier",
  "description": "Example model for customer support routing.",
  "created": "2026-10-24",
  "notes": "Example manifest, this field is free text.",
  "ready": true,
  "missingFiles": [],
  "loaded": true
}
```

**Response 404** (model not registered)

```json
{ "error": "model_not_found", "message": "Model \"missing-model\" was not found in the model directory." }
```

## POST /v1/models/:id/unload

Remove the model from the memory cache. It is loaded again automatically on
the next use. Use this after replacing the model files on disk.

**Response 200**

```json
{ "id": "support-classifier", "unloaded": true }
```

---

## POST /v1/predict

Inference on a single text.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `model` | string | yes | `model_id` (folder name) |
| `text` | string | yes | Input text, 1-4000 characters |
| `questions` | object | yes | 1-32 questions, key = answer field name |

One question looks like:

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | `"choice"` \| `"score"` \| `"noul"` | yes | Question type |
| `instructions` | string | no | Instruction/question for the model |
| `criteria` | object \| array | no | Depends on the type (see below) |

`criteria` per type:

- `choice`: `label -> description` map or label array.
- `score`: level array (for example `["low", "medium", "high"]`).
- `noul`: `true -> description`, `false -> description` map (optional).

**Example: `choice`**

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

**Response 200**

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
  "usage": {
    "input_tokens": 60,
    "output_tokens": 0,
    "state_tokens": 10,
    "state_tokens_dropped": 0,
    "truncated": false,
    "truncated_questions": []
  }
}
```

**Example: `noul` + `score` in one request**

```bash
curl -X POST http://localhost:3000/v1/predict \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "support-classifier",
    "text": "This product is terrible, it broke after one day!",
    "questions": {
      "angry": {
        "type": "noul",
        "instructions": "Is the customer angry?",
        "criteria": { "true": "yes, angry", "false": "no" }
      },
      "sentiment": {
        "type": "score",
        "instructions": "How positive is the tone of this message?",
        "criteria": ["very negative", "neutral", "very positive"]
      }
    }
  }'
```

**Response 200**

```json
{
  "model": "support-classifier",
  "answers": {
    "angry": {
      "type": "noul",
      "noul": 0.5547,
      "confidence": 0.5547,
      "answer_confidence": 0.5547,
      "action": { "act_probability": 1 }
    },
    "sentiment": {
      "type": "score",
      "score": 0.0005,
      "legend": { "0": "very negative", "1": "neutral", "2": "very positive" },
      "probabilities": { "0": 0.9997, "1": 0.0002, "2": 0.0002 },
      "confidence": 0.997,
      "answer_confidence": 0.9997,
      "action": { "act_probability": 1 }
    }
  },
  "usage": { "input_tokens": 81, "output_tokens": 0, "state_tokens": 11 }
}
```

**Answer shape per type**

- `choice`: `choice` (picked label), `probabilities`, `confidence`.
- `noul`: `noul` (number 0..1). The threshold (for example 0.5) is up to the caller.
- `score`: `score` (number), `legend` (level mapping), `probabilities`.

Every answer also carries `answer_confidence` and `action.act_probability`.
The engine applies NO threshold whatsoever.

**Errors**

| Status | `error` | Description |
|---|---|---|
| 400 | `FST_ERR_VALIDATION` | Body does not match the schema (for example unknown `type`) |
| 401 | `unauthorized` | Wrong or missing token |
| 404 | `model_not_found` | `model_id` is not registered |
| 422 | `model_not_ready` | Model files are incomplete (`missingFiles` in the message) |
| 422 | `invalid_questions` | Question definition rejected by Laya |
| 500 | `inference_failed` | Inference failed to run |

Example responses:

```json
{ "error": "model_not_found", "message": "Model \"missing-model\" was not found in the model directory." }
```

```json
{ "error": "model_not_ready", "message": "Model \"incomplete-model\" is not ready. Missing files: rl_agent_config.json, encoder.onnx, head.onnx, tokenizer.json." }
```

```json
{ "statusCode": 400, "code": "FST_ERR_VALIDATION", "error": "Bad Request", "message": "body/questions/q/type must be equal to one of the allowed values" }
```

---

## POST /v1/predict/batch

Inference on many texts with the same question configuration.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `model` | string | yes | `model_id` |
| `texts` | string[] | yes | 1-256 texts, each 1-4000 characters |
| `questions` | object | yes | Same as `/v1/predict` |

**Response 200**

```json
{
  "model": "support-classifier",
  "results": [
    {
      "model": "support-classifier",
      "answers": {
        "intent": {
          "type": "choice",
          "choice": "shipping",
          "probabilities": { "shipping": 0.9571, "other": 0.0429 },
          "confidence": 0.7443,
          "answer_confidence": 0.9571,
          "action": { "act_probability": 1 }
        }
      },
      "usage": { "input_tokens": 41, "output_tokens": 0 }
    },
    {
      "model": "support-classifier",
      "answers": {
        "intent": {
          "type": "choice",
          "choice": "other",
          "probabilities": { "shipping": 0.1736, "other": 0.8264 },
          "confidence": 0.3342,
          "answer_confidence": 0.8264,
          "action": { "act_probability": 1 }
        }
      },
      "usage": { "input_tokens": 36, "output_tokens": 0 }
    }
  ]
}
```

The order of `results` matches the order of `texts`.
