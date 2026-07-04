import { FastifyInstance } from "fastify";
import {
  googleLoginController,
  listUsersController,
  loginController,
  logoutController,
  meController,
} from "./auth.controller";

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", loginController);
  app.post("/google", googleLoginController);
  app.post("/logout", logoutController);
  app.get("/me", meController);
  app.get("/users", listUsersController);
}
