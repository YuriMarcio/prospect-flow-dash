import { FastifyInstance } from "fastify";
import {
  listBoardsController,
  createBoardController,
  getBoardController,
  saveGraphController,
  renameBoardController,
  deleteBoardController,
} from "./mind-maps.controller";

export async function mindMapsRoutes(app: FastifyInstance) {
  app.get("/", listBoardsController);
  app.post("/", createBoardController);
  app.get("/:id", getBoardController);
  app.put("/:id", saveGraphController);
  app.patch("/:id", renameBoardController);
  app.delete("/:id", deleteBoardController);
}
