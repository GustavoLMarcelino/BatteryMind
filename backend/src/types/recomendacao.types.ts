import { ClienteRequest } from "./clienteRequest.types.js";
import { ConversationContext } from "./conversationContext.types.js";
import { FuzzyResultado } from "./fuzzy.types.js";
import { InputExtraction, InputValidationErrorType } from "./inputValidation.types.js";
import { Produto } from "./produto.types.js";
import { AnaliseSentimentoResultado } from "./sentimento.types.js";
import { MessageIntent } from "../services/intentDetection.service.js";
import { SymptomAnalysis } from "./symptomTriage.types.js";

export interface IndividuoRecomendacao {
  produto: Produto;
  servicos: string[];
  fitness: number;
}

export interface RecomendacaoResultado {
  cliente: string;
  entrada: ClienteRequest;
  inputConfidence: number;
  context: ConversationContext;
  extracted: InputExtraction;
  symptomAnalysis: SymptomAnalysis;
  analiseSentimento: Omit<AnaliseSentimentoResultado, "tokensProcessados">;
  analiseFuzzy: FuzzyResultado;
  recomendacao: {
    produto: Pick<
      Produto,
      "id" | "nome" | "marca" | "amperagem" | "modelo" | "precoVenda" | "garantiaMeses" | "tipo"
    >;
    servicos: string[];
    fitness: number;
    confidenceLabel: "baixa confiança" | "confiança moderada" | "boa recomendação" | "recomendação otimizada";
    alerta?: string;
    justificativa: string;
  };
}

export interface RecomendacaoFalha {
  success: false;
  type: InputValidationErrorType;
  message: string;
  data: {
    reason: string;
    missingFields: string[];
    suggestedQuestion: string;
    inputConfidence: number;
    context?: ConversationContext;
    extracted?: InputExtraction;
  };
}

export interface RecomendacaoSucesso {
  success: true;
  message: string;
  data: RecomendacaoResultado;
}

export interface SocialResponse {
  success: true;
  type: "SOCIAL_RESPONSE";
  intent: Exclude<MessageIntent, "automotive_request" | "unknown">;
  message: string;
}

export type RecomendacaoServiceResponse = RecomendacaoFalha | RecomendacaoSucesso | SocialResponse;
