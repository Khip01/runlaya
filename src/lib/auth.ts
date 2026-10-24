import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

function getAuthToken(): string {
  return process.env["API_TOKEN"] ?? "";
}

/**
 * Check the Bearer token. Returns true when valid.
 */
export function checkAuth(req: FastifyRequest): boolean {
  const authHeader = req.headers.authorization;
  const authToken = getAuthToken();
  return Boolean(authHeader) && authHeader === `Bearer ${authToken}`;
}

export function unauthorized(reply: FastifyReply) {
  return reply.status(401).send({
    error: "unauthorized",
    message: "Invalid or missing token.",
  });
}

/** Auth hook for routes that need protection. */
export function authHook(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    if (!checkAuth(req)) {
      await unauthorized(reply);
      return reply;
    }
  });
}
