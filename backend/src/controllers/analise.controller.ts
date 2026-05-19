import { Request, Response } from "express";
import { fuzzyService } from "../services/fuzzy.service.js";
import { naiveBayesService } from "../services/naiveBayes.service.js";
import { FuzzyInput } from "../types/fuzzy.types.js";
import { successResponse } from "../utils/response.js";

export class AnaliseController {
  analisarSentimento(
    request: Request<object, object, { mensagem: string }>,
    response: Response
  ): Response {
    const resultado = naiveBayesService.analisar(request.body.mensagem);
    return successResponse(response, "Sentimento analisado com sucesso", resultado);
  }

  calcularFuzzy(request: Request<object, object, FuzzyInput>, response: Response): Response {
    const resultado = fuzzyService.calcular(request.body);
    return successResponse(response, "Score fuzzy calculado com sucesso", resultado);
  }
}

export const analiseController = new AnaliseController();
