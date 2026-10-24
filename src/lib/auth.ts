import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

function getAuthToken(): string {
  return process.env["API_TOKEN"] ?? "";
}

/**
 * Cek Bearer token. Return true jika valid.
 */
export function checkAuth(req: FastifyRequest): boolean {
  const authHeader = req.headers.authorization;
  const authToken = getAuthToken();
  return Boolean(authHeader) && authHeader === `Bearer ${authToken}`;
}

export function unauthorized(reply: FastifyReply) {
  return reply.status(401).send({
    error: "unauthorized",
    message: "Token tidak valid atau tidak ada.",
  });
}

/** Hook auth untuk route yang butuh proteksi. */
export function authHook(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    if (!checkAuth(req)) {
      await unauthorized(reply);
      return reply;
    }
  });
}
