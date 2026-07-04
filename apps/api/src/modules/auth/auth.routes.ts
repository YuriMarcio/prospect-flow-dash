import { FastifyInstance } from "fastify";
import { googleLoginController, loginController, logoutController, meController } from "./auth.controller";

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", loginController);
  app.post("/google", googleLoginController);
  app.post("/logout", logoutController);
  app.get("/me", meController);
}
