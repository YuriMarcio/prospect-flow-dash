import { FastifyInstance } from "fastify";
import {
  listTemplatesController,
  createTemplateController,
  deleteTemplateController,
} from "./flow-templates.controller";

export async function flowTemplatesRoutes(app: FastifyInstance) {
  app.get("/", listTemplatesController);
  app.post("/", createTemplateController);
  app.delete("/:id", deleteTemplateController);
}
