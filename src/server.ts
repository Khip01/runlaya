import "dotenv/config";
import Fastify from "fastify";
import swagger from "@fastify/swagger";
import scalarApiReference from "@scalar/fastify-api-reference";
import { modelRoutes } from "./routes/models.ts";
import { predictRoutes } from "./routes/predict.ts";
import { logRequest, logResponse, logError } from "./lib/tui-log.ts";

const PORT = parseInt(process.env["PORT"] ?? "3000", 10);

declare module "fastify" {
  interface FastifyRequest {
    startTime: number;
  }
}

async function main() {
  const app = Fastify({
    logger: false,
  });

  app.decorateRequest("startTime", 0);

  app.addHook("onRequest", async (req) => {
    req.startTime = Date.now();
  });

  app.addHook("preHandler", async (req) => {
    // Docs and spec requests are noisy, skip them.
    if (req.url.startsWith("/docs") || req.url.startsWith("/openapi.json")) return;
    logRequest(req.method, req.url, req.body ?? {});
  });

  app.addHook("onSend", async (req, reply, payload) => {
    if (req.url.startsWith("/docs") || req.url.startsWith("/openapi.json")) return payload;
    const started = req.startTime;
    const durationMs = started ? Date.now() - started : 0;
    let body: unknown = payload;
    try {
      body = typeof payload === "string" ? JSON.parse(payload) : payload;
    } catch {
      // keep raw payload when it is not JSON
    }
    logResponse(req.method, req.url, reply.statusCode, durationMs, body);
    return payload;
  });

  app.addHook("onResponse", async (req, reply) => {
    if (reply.statusCode >= 400) {
      logError(`${req.method} ${req.url}`, `status ${reply.statusCode}`);
    }
  });

  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "Runlaya API",
        description:
          "Plug-and-play inference API for Laya ONNX models. " +
          "Register models in the models directory, pick one via the `model` field, " +
          "and send parameters (type, instructions, criteria) per request.",
        version: "0.1.0",
        license: { name: "Apache-2.0" },
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            description: "Enter the API token.",
          },
        },
      },
    },
  });

  app.get("/openapi.json", async () => app.swagger());

  await app.register(scalarApiReference, {
    routePrefix: "/docs",
    configuration: {
      title: "Runlaya API",
      hideClientButton: true,
    },
  });

  await app.register(modelRoutes);
  await app.register(predictRoutes);

  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`API documentation at http://localhost:${PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
