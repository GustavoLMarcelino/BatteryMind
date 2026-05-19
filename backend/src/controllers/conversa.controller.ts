import { Request, Response } from "express";
import { conversationContextService } from "../services/conversationContext.service.js";
import { successResponse } from "../utils/response.js";

export class ConversaController {
  buscarContexto(request: Request<{ conversationId: string }>, response: Response): Response {
    const contexto = conversationContextService.getContext(request.params.conversationId);
    return successResponse(response, "Contexto da conversa retornado com sucesso", contexto);
  }

  limparContexto(request: Request<{ conversationId: string }>, response: Response): Response {
    conversationContextService.clearContext(request.params.conversationId);
    return successResponse(response, "Contexto da conversa limpo com sucesso");
  }
}

export const conversaController = new ConversaController();
