import { FastifyInstance } from "fastify";
import {
  listColumnsController,
  createColumnController,
  updateColumnController,
  reorderColumnsController,
  deleteColumnController,
  listObjectivesController,
  createObjectiveController,
  updateObjectiveController,
  deleteObjectiveController,
  listSprintsController,
  createSprintController,
  deleteSprintController,
} from "./objectives.controller";

export async function objectivesRoutes(app: FastifyInstance) {
  app.get("/columns", listColumnsController);
  app.post("/columns", createColumnController);
  app.patch("/columns/reorder", reorderColumnsController);
  app.patch("/columns/:id", updateColumnController);
  app.delete("/columns/:id", deleteColumnController);

  app.get("/sprints", listSprintsController);
  app.post("/sprints", createSprintController);
  app.delete("/sprints/:id", deleteSprintController);

  app.get("/", listObjectivesController);
  app.post("/", createObjectiveController);
  app.patch("/:id", updateObjectiveController);
  app.delete("/:id", deleteObjectiveController);
}
