import { Router } from "express";
import { produtoController } from "../controllers/produto.controller.js";

export const produtoRoutes = Router();

produtoRoutes.get("/", produtoController.listar);
produtoRoutes.get("/:id", produtoController.buscarPorId);
produtoRoutes.post("/", produtoController.criar);
produtoRoutes.put("/:id", produtoController.atualizar);
produtoRoutes.delete("/:id", produtoController.remover);
