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
(or `MODELS_DIR`). The folder name is the `model_id`. See
[models/README.md](models/README.md) for the folder structure.

---

## GET /v1/models

List all installed models with their status.

**Response 200**

```json
{
  "models": [
    {
      "id": "laya-base",
      "name": "Laya Base",
      "description": "Base Laya model for testing.",
      "created": "2026-10-24",
      "notes": "Symlink to the hello-polinema model.",
      "ready": true,
      "missingFiles": [],
      "loaded": false
    },
    {
      "id": "laya-rusak",
      "name": "laya-rusak",
      "description": "",
      "created": "",
      "notes": "",
      "ready": false,
      "missingFiles": ["rl_agent_config.json", "encoder.onnx", "head.onnx", "tokenizer.json"],
      "loaded": false
    }
  ]
}
```

- `ready`: `true` when all required model files exist.
- `loaded`: `true` when the model is loaded into memory.

## GET /v1/models/:id

Details for a single model. Same shape as the `models` items above.

**Response 404** (model not registered)

```json
{ "error": "model_not_found", "message": "Model \"missing-model\" was not found in the model directory." }
```

## POST /v1/models/:id/unload

Remove the model from the memory cache. It is loaded again automatically on
the next use. Use this after replacing the model files on disk.

**Response 200**

```json
{ "id": "laya-base", "unloaded": true }
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
    "model": "laya-base",
    "text": "What is the new student registration fee at Polinema?",
    "questions": {
      "topic": {
        "type": "choice",
        "instructions": "Which topic category does the user message belong to in the context of Politeknik Negeri Malang (Polinema)?",
        "criteria": {
          "profile": "Questions about the profile or general information of Polinema.",
          "majors": "Questions about departments or study programs at Polinema.",
          "admission": "Questions about admission or how to enroll at Polinema.",
          "contact": "Questions about how to contact Polinema.",
          "off-topic": "Not a question about Polinema."
        }
      }
    }
  }'
```

**Response 200**

```json
{
  "model": "laya-base",
  "answers": {
    "topic": {
      "type": "choice",
      "choice": "admission",
      "probabilities": {
        "profile": 0.0203,
        "majors": 0.0043,
        "admission": 0.9682,
        "contact": 0.0008,
        "off-topic": 0.0064
      },
      "confidence": 0.8932,
      "answer_confidence": 0.9682,
      "action": { "act_probability": 1 }
    }
  },
  "usage": {
    "input_tokens": 104,
    "output_tokens": 0,
    "state_tokens": 11,
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
    "model": "laya-base",
    "text": "I am so angry with this service!",
    "questions": {
      "angry": {
        "type": "noul",
        "instructions": "Is the user angry?",
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
  "model": "laya-base",
  "answers": {
    "angry": {
      "type": "noul",
      "noul": 0.9653,
      "confidence": 0.9653,
      "answer_confidence": 0.9653,
      "action": { "act_probability": 1 }
    },
    "sentiment": {
      "type": "score",
      "score": 0.0021,
      "legend": { "0": "very negative", "1": "neutral", "2": "very positive" },
      "probabilities": { "0": 0.9981, "1": 0.0017, "2": 0.0002 },
      "confidence": 0.9869,
      "answer_confidence": 0.9981,
      "action": { "act_probability": 1 }
    }
  },
  "usage": { "input_tokens": 75, "output_tokens": 0, "state_tokens": 8 }
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
{ "error": "model_not_ready", "message": "Model \"laya-rusak\" is not ready. Missing files: rl_agent_config.json, encoder.onnx, head.onnx, tokenizer.json." }
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
  "model": "laya-base",
  "results": [
    {
      "model": "laya-base",
      "answers": {
        "topic": {
          "type": "choice",
          "choice": "location",
          "probabilities": { "location": 0.9917, "off-topic": 0.0083 },
          "confidence": 0.9308,
          "answer_confidence": 0.9917,
          "action": { "act_probability": 1 }
        }
      },
      "usage": { "input_tokens": 44, "output_tokens": 0 }
    },
    {
      "model": "laya-base",
      "answers": {
        "topic": {
          "type": "choice",
          "choice": "off-topic",
          "probabilities": { "location": 0.012, "off-topic": 0.988 },
          "confidence": 0.9061,
          "answer_confidence": 0.988,
          "action": { "act_probability": 1 }
        }
      },
      "usage": { "input_tokens": 43, "output_tokens": 0 }
    }
  ]
}
```

The order of `results` matches the order of `texts`.
