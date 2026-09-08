import { FastifyInstance } from "fastify";
import fastifyMultipart from "@fastify/multipart";
import {
  listPagesController,
  createPageController,
  duplicatePageController,
  updateMetaController,
  updateBlocksController,
  setFavoriteController,
  movePageController,
  reorderSiblingsController,
  deletePageController,
  uploadFileController,
} from "./workspace.controller";

export async function workspaceRoutes(app: FastifyInstance) {
  await app.register(fastifyMultipart, {
    limits: { fileSize: 15 * 1024 * 1024 },
  });

  app.get("/pages", listPagesController);
  app.post("/pages", createPageController);
  app.patch("/pages/reorder", reorderSiblingsController);
  app.post("/pages/:id/duplicate", duplicatePageController);
  app.patch("/pages/:id/meta", updateMetaController);
  app.put("/pages/:id/blocks", updateBlocksController);
  app.post("/pages/:id/favorite", setFavoriteController);
  app.patch("/pages/:id/move", movePageController);
  app.delete("/pages/:id", deletePageController);
  app.post("/files/upload", uploadFileController);
}
