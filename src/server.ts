import "dotenv/config";
import Fastify from "fastify";
import swagger from "@fastify/swagger";
import scalarApiReference from "@scalar/fastify-api-reference";
import { modelRoutes } from "./routes/models.ts";
import { predictRoutes } from "./routes/predict.ts";

const PORT = parseInt(process.env["PORT"] ?? "3000", 10);

async function main() {
  const app = Fastify({
    logger: {
      level: "info",
    },
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
