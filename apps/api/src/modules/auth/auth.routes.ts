import { FastifyInstance } from "fastify";
import {
  googleLoginController,
  listUsersController,
  loginController,
  logoutController,
  meController,
  updateProfileController,
} from "./auth.controller";

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", loginController);
  app.post("/google", googleLoginController);
  app.post("/logout", logoutController);
  app.get("/me", meController);
  app.patch("/me", updateProfileController);
  app.get("/users", listUsersController);
}
