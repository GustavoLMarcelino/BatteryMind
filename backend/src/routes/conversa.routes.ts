import { Router } from "express";
import { conversaController } from "../controllers/conversa.controller.js";

export const conversaRoutes = Router();

conversaRoutes.get("/:conversationId", conversaController.buscarContexto);
conversaRoutes.delete("/:conversationId", conversaController.limparContexto);
