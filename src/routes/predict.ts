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
 * Skema pertanyaan Laya generik:
 *   { type: "choice" | "score" | "noul", instructions: string, criteria: ... }
 * `criteria` bebas (map label -> deskripsi, array label, atau map true/false)
 * karena bentuknya bergantung pada tipe pertanyaan.
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
          "Tipe pertanyaan: choice (pilih satu label), " +
          "score (nilai 0..n), noul (probabilitas 0..1).",
      },
      instructions: {
        type: "string",
        description: "Instruksi/pertanyaan untuk model.",
      },
      criteria: {
        description:
          "Kriteria pilihan. choice: map label -> deskripsi atau array label. " +
          "score: array level (opsional). noul: map true/false -> deskripsi (opsional).",
      },
    },
  },
} as const;

const ANSWERS_SCHEMA = {
  type: "object",
  additionalProperties: true,
  description:
    "Jawaban mentah per pertanyaan. choice -> choice + probabilities + confidence. " +
    "noul -> angka 0..1. score -> angka. Tanpa threshold: keputusan ada di pemanggil.",
} as const;

const USAGE_SCHEMA = {
  type: "object",
  additionalProperties: true,
  description: "Pemakaian token dan info truncation dari Laya.",
} as const;

function validateQuestions(questions: Record<string, unknown>): string | null {
  for (const [qid, qdef] of Object.entries(questions)) {
    try {
      checkQuestion(qid, qdef);
    } catch (err) {
      return err instanceof Error ? err.message : `Pertanyaan "${qid}" tidak valid.`;
    }
  }
  return null;
}

async function ensureModelReady(modelId: string, reply: FastifyReply): Promise<boolean> {
  const info = await getModel(modelId, loadedModelIds());
  if (!info) {
    await reply.status(404).send({
      error: "model_not_found",
      message: `Model "${modelId}" tidak ditemukan di direktori model.`,
    });
    return false;
  }
  if (!info.ready) {
    await reply.status(422).send({
      error: "model_not_ready",
      message: `Model "${modelId}" belum siap. File hilang: ${info.missingFiles.join(", ")}.`,
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
              description: "ID model yang dipakai (nama folder di direktori model).",
            },
            text: {
              type: "string",
              minLength: 1,
              maxLength: 4000,
              description: "Teks masukan untuk diprediksi.",
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
        summary: "Prediksi satu teks",
        description:
          "Jalankan inferensi Laya pada satu teks dengan konfigurasi pertanyaan apa pun. " +
          "Semua parameter (tipe, instruksi, criteria) dikirim per-request, " +
          "sehingga tidak perlu ubah kode untuk eksperimen berbeda.",
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
          message: err instanceof Error ? err.message : "Inferensi gagal.",
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
              description: "ID model yang dipakai (nama folder di direktori model).",
            },
            texts: {
              type: "array",
              minItems: 1,
              maxItems: 256,
              items: { type: "string", minLength: 1, maxLength: 4000 },
              description: "Daftar teks masukan.",
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
        summary: "Prediksi batch (banyak teks)",
        description:
          "Jalankan inferensi untuk banyak teks sekaligus dengan pertanyaan yang sama. " +
          "Berguna untuk evaluasi dataset.",
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
          message: err instanceof Error ? err.message : "Inferensi gagal.",
        });
      }
    },
  );
}
