import { FastifyReply, FastifyRequest } from "fastify";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "./auth.constants";
import { AuthUser, listUsers, verifyCredentials, verifyGoogleLogin } from "./auth.service";

async function issueSession(user: AuthUser, reply: FastifyReply) {
  const token = await reply.jwtSign(
    { userId: user.id, username: user.username, email: user.email, name: user.name },
    { expiresIn: `${SESSION_MAX_AGE_SECONDS}s` },
  );

  return reply
    .setCookie(SESSION_COOKIE_NAME, token, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: SESSION_MAX_AGE_SECONDS,
    })
    .send(user);
}

export async function loginController(
  request: FastifyRequest<{ Body: { username?: string; password?: string } }>,
  reply: FastifyReply,
) {
  const { username, password } = request.body ?? {};

  if (!username || !password) {
    return reply.status(400).send({ error: "Informe usuário e senha." });
  }

  const user = await verifyCredentials(username, password);
  if (!user) {
    return reply.status(401).send({ error: "Usuário ou senha inválidos." });
  }

  return issueSession(user, reply);
}

export async function googleLoginController(
  request: FastifyRequest<{ Body: { credential?: string } }>,
  reply: FastifyReply,
) {
  const { credential } = request.body ?? {};
  if (!credential) {
    return reply.status(400).send({ error: "Token do Google ausente." });
  }

  const user = await verifyGoogleLogin(credential);
  if (!user) {
    return reply.status(401).send({ error: "Conta Google não autorizada." });
  }

  return issueSession(user, reply);
}

export async function logoutController(_request: FastifyRequest, reply: FastifyReply) {
  return reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" }).status(204).send();
}

export async function listUsersController(_request: FastifyRequest, reply: FastifyReply) {
  const users = await listUsers();
  return reply.send(users);
}

export async function meController(request: FastifyRequest, reply: FastifyReply) {
  const { userId, username, email, name } = request.user as {
    userId: string;
    username: string | null;
    email: string | null;
    name: string | null;
  };
  return reply.send({ id: userId, username, email, name });
}
