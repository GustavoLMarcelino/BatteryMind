import { Request, Response } from "express";
import { recomendacaoService } from "../services/recomendacao.service.js";
import { ClienteRequest } from "../types/clienteRequest.types.js";

export class RecomendacaoController {
  recomendar(request: Request<object, object, ClienteRequest>, response: Response): Response {
    const resultado = recomendacaoService.recomendar(request.body);
    return response.status(200).json(resultado);
  }
}

export const recomendacaoController = new RecomendacaoController();
