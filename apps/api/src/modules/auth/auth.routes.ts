import { FastifyInstance } from "fastify";
import { loginController, logoutController, meController } from "./auth.controller";

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", loginController);
  app.post("/logout", logoutController);
  app.get("/me", meController);
}
