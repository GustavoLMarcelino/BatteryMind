import { Router } from "express";
import { analiseController } from "../controllers/analise.controller.js";

export const analiseRoutes = Router();

analiseRoutes.post("/analisar-sentimento", analiseController.analisarSentimento);
analiseRoutes.post("/calcular-fuzzy", analiseController.calcularFuzzy);
