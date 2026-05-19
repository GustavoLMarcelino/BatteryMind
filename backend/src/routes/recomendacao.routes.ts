import { Router } from "express";
import { recomendacaoController } from "../controllers/recomendacao.controller.js";

export const recomendacaoRoutes = Router();

recomendacaoRoutes.post("/recomendar", recomendacaoController.recomendar);
