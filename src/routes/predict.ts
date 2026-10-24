import type { FastifyInstance, FastifyReply } from "fastify";
import type { QuestionDef } from "laya-ts";
import { checkQuestion } from "laya-ts";
import { getModel } from "../lib/registry.ts";
import { loadedModelIds, predict, predictBatch } from "../lib/engine.ts";
import { checkAuth, unauthorized } from "../lib/auth.ts";
import type { ErrorResponse } from "../types.ts";

const ERROR_SCHEMA = {
  type: "object",
  properties: {
    error: { type: "string" },
    message: { type: "string" },
  },
} as const;

/**
 * Generic Laya question schema:
 *   { type: "choice" | "score" | "noul", instructions: string, criteria: ... }
 * `criteria` is free-form (label -> description map, label array, or
 * true/false map) because its shape depends on the question type.
 */
const QUESTIONS_SCHEMA = {
  type: "object",
  minProperties: 1,
  maxProperties: 32,
  additionalProperties: {
    type: "object",
    required: ["type"],
    properties: {
      type: {
        type: "string",
        enum: ["choice", "score", "noul"],
        description:
          "Question type: choice (pick one label), " +
          "score (value 0..n), noul (probability 0..1).",
      },
      instructions: {
        type: "string",
        description: "Instruction/question for the model.",
      },
      criteria: {
        description:
          "Choice criteria. choice: label -> description map or label array. " +
          "score: level array (optional). noul: true/false -> description map (optional).",
      },
    },
  },
} as const;

const ANSWERS_SCHEMA = {
  type: "object",
  additionalProperties: true,
  description:
    "Raw answer per question. choice -> choice + probabilities + confidence. " +
    "noul -> number 0..1. score -> number. No threshold applied: the decision belongs to the caller.",
} as const;

const USAGE_SCHEMA = {
  type: "object",
  additionalProperties: true,
  description: "Token usage and truncation info from Laya.",
} as const;

function validateQuestions(questions: Record<string, unknown>): string | null {
  for (const [qid, qdef] of Object.entries(questions)) {
    try {
      checkQuestion(qid, qdef);
    } catch (err) {
      return err instanceof Error ? err.message : `Question "${qid}" is invalid.`;
    }
  }
  return null;
}

async function ensureModelReady(modelId: string, reply: FastifyReply): Promise<boolean> {
  const info = await getModel(modelId, loadedModelIds());
  if (!info) {
    await reply.status(404).send({
      error: "model_not_found",
      message: `Model "${modelId}" was not found in the model directory.`,
    });
    return false;
  }
  if (!info.ready) {
    await reply.status(422).send({
      error: "model_not_ready",
      message: `Model "${modelId}" is not ready. Missing files: ${info.missingFiles.join(", ")}.`,
    });
    return false;
  }
  return true;
}

export async function predictRoutes(app: FastifyInstance) {
  app.post(
    "/v1/predict",
    {
      schema: {
        body: {
          type: "object",
          required: ["model", "text", "questions"],
          properties: {
            model: {
              type: "string",
              minLength: 1,
              description: "Model ID to use (folder name in the model directory).",
            },
            text: {
              type: "string",
              minLength: 1,
              maxLength: 4000,
              description: "Input text to predict on.",
            },
            questions: QUESTIONS_SCHEMA,
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              model: { type: "string" },
              answers: ANSWERS_SCHEMA,
              usage: USAGE_SCHEMA,
            },
          },
          401: ERROR_SCHEMA,
          404: ERROR_SCHEMA,
          422: ERROR_SCHEMA,
          500: ERROR_SCHEMA,
        },
        security: [{ bearerAuth: [] }],
        tags: ["predict"],
        summary: "Predict a single text",
        description:
          "Run Laya inference on a single text with arbitrary question configuration. " +
          "All parameters (type, instructions, criteria) are sent per request, " +
          "keeping the codebase untouched across experiments.",
      },
    },
    async (req, reply) => {
      if (!checkAuth(req)) return unauthorized(reply);
      const { model, text, questions } = req.body as {
        model: string;
        text: string;
        questions: Record<string, unknown>;
      };

      const invalid = validateQuestions(questions);
      if (invalid) {
        return reply.status(422).send({ error: "invalid_questions", message: invalid });
      }

      if (!(await ensureModelReady(model, reply))) return reply;

      try {
        const result = await predict(model, text, questions as Record<string, QuestionDef>);
        return reply.send(result);
      } catch (err) {
        req.log.error(err);
        return reply.status(500).send({
          error: "inference_failed",
          message: err instanceof Error ? err.message : "Inference failed.",
        });
      }
    },
  );

  app.post(
    "/v1/predict/batch",
    {
      schema: {
        body: {
          type: "object",
          required: ["model", "texts", "questions"],
          properties: {
            model: {
              type: "string",
              minLength: 1,
              description: "Model ID to use (folder name in the model directory).",
            },
            texts: {
              type: "array",
              minItems: 1,
              maxItems: 256,
              items: { type: "string", minLength: 1, maxLength: 4000 },
              description: "Input texts.",
            },
            questions: QUESTIONS_SCHEMA,
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              model: { type: "string" },
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    model: { type: "string" },
                    answers: ANSWERS_SCHEMA,
                    usage: USAGE_SCHEMA,
                  },
                },
              },
            },
          },
          401: ERROR_SCHEMA,
          404: ERROR_SCHEMA,
          422: ERROR_SCHEMA,
          500: ERROR_SCHEMA,
        },
        security: [{ bearerAuth: [] }],
        tags: ["predict"],
        summary: "Batch predict (multiple texts)",
        description:
          "Run inference for many texts at once with the same question configuration. " +
          "Useful for dataset evaluation.",
      },
    },
    async (req, reply) => {
      if (!checkAuth(req)) return unauthorized(reply);
      const { model, texts, questions } = req.body as {
        model: string;
        texts: string[];
        questions: Record<string, unknown>;
      };

      const invalid = validateQuestions(questions);
      if (invalid) {
        return reply.status(422).send({ error: "invalid_questions", message: invalid });
      }

      if (!(await ensureModelReady(model, reply))) return reply;

      try {
        const results = await predictBatch(model, texts, questions as Record<string, QuestionDef>);
        return reply.send({ model, results });
      } catch (err) {
        req.log.error(err);
        return reply.status(500).send({
          error: "inference_failed",
          message: err instanceof Error ? err.message : "Inference failed.",
        });
      }
    },
  );
}
