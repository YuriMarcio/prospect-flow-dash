import { FastifyInstance } from "fastify";
import { scrapeInstagramController } from "./instagram.controller";

export async function instagramRoutes(app: FastifyInstance) {
  // Rota: POST /instagram/search
  app.post(
    "/search",
    scrapeInstagramController
  );
}