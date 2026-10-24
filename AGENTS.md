# AGENTS.md - runlaya

Plug-and-play inference API for Laya ONNX models.
This project is a shell: Laya models (fine-tuned or not) can be mounted and
swapped without code changes. Inference parameters are sent per-request.

## Language policy (strict)

Everything in this repository is English only: docs, comments, strings,
error messages, and commit messages. Never use Indonesian in this repo.

## Locked stack

- TypeScript strict ESM (tsconfig: ES2022, NodeNext, `strict`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noEmit`).
- Fastify + TypeBox (JSON schema) + Scalar (`@scalar/fastify-api-reference`).
- `laya-ts` via the `vendor/laya` submodule (sparse checkout `laya-ts/`).
- Node.js >= 20 (developed on Node 24).

## Important commands

| Command | Function |
|---|---|
| `npm install --ignore-scripts` | Install dependencies (MUST use `--ignore-scripts`) |
| `npm run setup:laya` | Build `laya-ts` from the submodule (once after clone) |
| `npm start` | Run the server |
| `npm run typecheck` | Type check, run before committing |

Submodule:

```bash
git submodule update --init   # when cloned without --recurse-submodules
```

## Layout

```
runlaya/
  models/            <- model directory (per subfolder), CONTENTS NOT COMMITTED
  src/
    server.ts        <- Fastify bootstrap + swagger + Scalar
    types.ts         <- shared types
    lib/
      registry.ts    <- scan models/, read manifest, check required files
      engine.ts      <- agent cache, predict/predictBatch
      auth.ts        <- Bearer token check
    routes/
      models.ts      <- GET /v1/models, GET /v1/models/:id, POST /v1/models/:id/unload
      predict.ts     <- POST /v1/predict, POST /v1/predict/batch
  vendor/laya/       <- submodule (do not edit directly)
  API.md             <- API reference with real captured responses
  README.md          <- usage guide
  LICENSE            <- Apache License 2.0
```

## Design principles (MUST be preserved)

1. Neutral engine: NO threshold, NO knowledge base, NO LLM.
   Raw Laya output is returned; threshold decisions belong to the caller.
2. All `questions` parameters (type, instructions, criteria) are sent
   per-request. Never hardcode criteria in the code.
3. Multi-model: `models/<model-id>/`, selected via the `model` field in the
   request. Lazy load + cache in memory (`src/lib/engine.ts`).
4. `manifest.json` is optional; a folder without one is still registered.
5. Bearer token auth (`API_TOKEN`), same pattern as `hello-polinema`.
6. API style: custom REST `/v1/*`. Not OpenAI-compatible.

## Laya models

Required files in a model folder (defined by `laya-ts`):
- `rl_agent_config.json`
- `tokenizer.json` (or `tokenizer/tokenizer.json`)
- `encoder.onnx` (+ `encoder.onnx.data` when weights are separate)
- `head.onnx` (+ `head.onnx.data` when weights are separate)

Laya question types:
- `choice` -> pick one label from `criteria` (classification)
- `noul` -> probability 0..1 that the statement holds
- `score` -> value 0..n with `legend`

## Conventions

- English everywhere (see language policy above).
- NO em dash (U+2014) and NO emoji in output, code, or commits.
- Commits: Conventional Commits, GPG-signed, ask user approval before committing.
- Secrets in `.env` (git-ignored). `.env.example` stays empty with no secrets.
- New `.sh` files or scripts must be registered with `git update-index --chmod=+x`.
- Never edit `vendor/laya/` directly; it is an upstream submodule.

## Research context

This project supports the A-B-C-D thesis experiments: whether fine-tuning
Laya reduces its dependency on `criteria`. Experiments only need to change
the model (`model`) and `criteria` in the request, never the code.
Datasets and research notes live in the `Khip01/private_thesis_needs` repo.

## Related projects

| Location | Content |
|---|---|
| `../hello-polinema/` | Chatbot API that will be refactored to use this engine |
