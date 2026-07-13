import type { FastifyJwtNamespace } from "@fastify/jwt";

declare module "fastify" {
  interface FastifyRequest extends FastifyJwtNamespace<{ namespace: "vault" }> {}
  interface FastifyReply extends FastifyJwtNamespace<{ namespace: "vault" }> {}
}
