import { FastifyReply, FastifyRequest } from "fastify";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "./auth.constants";
import { verifyCredentials } from "./auth.service";

export async function loginController(
  request: FastifyRequest<{ Body: { username?: string; password?: string } }>,
  reply: FastifyReply,
) {
  const { username, password } = request.body ?? {};

  if (!username || !password) {
    return reply.status(400).send({ error: "Informe usuário e senha." });
  }

  const valid = await verifyCredentials(username, password);
  if (!valid) {
    return reply.status(401).send({ error: "Usuário ou senha inválidos." });
  }

  const token = await reply.jwtSign({ username }, { expiresIn: `${SESSION_MAX_AGE_SECONDS}s` });

  return reply
    .setCookie(SESSION_COOKIE_NAME, token, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: SESSION_MAX_AGE_SECONDS,
    })
    .send({ username });
}

export async function logoutController(_request: FastifyRequest, reply: FastifyReply) {
  return reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" }).status(204).send();
}

export async function meController(request: FastifyRequest, reply: FastifyReply) {
  const { username } = request.user as { username: string };
  return reply.send({ username });
}
