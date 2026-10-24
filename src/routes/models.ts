import type { FastifyInstance } from "fastify";
import { scanModels, getModel } from "../lib/registry.ts";
import { loadedModelIds, unloadModel } from "../lib/engine.ts";
import { checkAuth, unauthorized } from "../lib/auth.ts";
import type { ErrorResponse } from "../types.ts";

const MODEL_SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    created: { type: "string" },
    notes: { type: "string" },
    ready: { type: "boolean" },
    missingFiles: { type: "array", items: { type: "string" } },
    loaded: { type: "boolean" },
  },
} as const;

const ERROR_SCHEMA = {
  type: "object",
  properties: {
    error: { type: "string" },
    message: { type: "string" },
  },
} as const;

export async function modelRoutes(app: FastifyInstance) {
  app.get(
    "/v1/models",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              models: {
                type: "array",
                items: MODEL_SUMMARY_SCHEMA,
              },
            },
          },
          401: ERROR_SCHEMA,
        },
        security: [{ bearerAuth: [] }],
        tags: ["models"],
        summary: "Daftar model terpasang",
        description:
          "Scan direktori model dan tampilkan semua model yang terdaftar, " +
          "beserta status kesiapan file dan status loaded di memori.",
      },
    },
    async (req, reply) => {
      if (!checkAuth(req)) return unauthorized(reply);
      const models = await scanModels(loadedModelIds());
      return reply.send({ models });
    },
  );

  app.get<{ Params: { id: string }; Reply: unknown | ErrorResponse }>(
    "/v1/models/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "ID model (nama folder)." },
          },
        },
        response: {
          200: MODEL_SUMMARY_SCHEMA,
          401: ERROR_SCHEMA,
          404: ERROR_SCHEMA,
        },
        security: [{ bearerAuth: [] }],
        tags: ["models"],
        summary: "Detail satu model",
        description: "Ambil manifest dan status satu model berdasarkan ID.",
      },
    },
    async (req, reply) => {
      if (!checkAuth(req)) return unauthorized(reply);
      const info = await getModel(req.params.id, loadedModelIds());
      if (!info) {
        return reply.status(404).send({
          error: "model_not_found",
          message: `Model "${req.params.id}" tidak ditemukan di direktori model.`,
        });
      }
      return reply.send(info);
    },
  );

  app.post<{ Params: { id: string }; Reply: unknown | ErrorResponse }>(
    "/v1/models/:id/unload",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "ID model (nama folder)." },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              unloaded: { type: "boolean" },
            },
          },
          401: ERROR_SCHEMA,
        },
        security: [{ bearerAuth: [] }],
        tags: ["models"],
        summary: "Keluarkan model dari memori",
        description:
          "Hapus model dari cache. Model akan dimuat ulang otomatis saat dipakai berikutnya. " +
          "Gunakan setelah file model diganti di disk.",
      },
    },
    async (req, reply) => {
      if (!checkAuth(req)) return unauthorized(reply);
      const unloaded = unloadModel(req.params.id);
      return reply.send({ id: req.params.id, unloaded });
    },
  );
}
