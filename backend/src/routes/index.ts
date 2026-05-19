import { Router } from "express";
import { successResponse } from "../utils/response.js";
import { analiseRoutes } from "./analise.routes.js";
import { conversaRoutes } from "./conversa.routes.js";
import { produtoRoutes } from "./produto.routes.js";
import { recomendacaoRoutes } from "./recomendacao.routes.js";

export const routes = Router();

routes.get("/health", (_request, response) =>
  successResponse(response, "API BatteryMind rodando com sucesso")
);

routes.use("/produtos", produtoRoutes);
routes.use("/conversas", conversaRoutes);
routes.use(analiseRoutes);
routes.use(recomendacaoRoutes);
