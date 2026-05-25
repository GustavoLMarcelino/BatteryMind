import { ClienteRequest } from "./clienteRequest.types.js";
import { ConversationContext } from "./conversationContext.types.js";
import { FuzzyResultado } from "./fuzzy.types.js";
import { InputExtraction, InputValidationErrorType } from "./inputValidation.types.js";
import { Produto } from "./produto.types.js";
import { AnaliseSentimentoResultado } from "./sentimento.types.js";
import { MessageIntent } from "../services/intentDetection.service.js";
import { SymptomAnalysis } from "./symptomTriage.types.js";
import type { SemanticProblemAnalysis } from "../services/semanticProblemInterpreter.service.js";

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
  semanticAnalysis: SemanticProblemAnalysis;
  symptomAnalysis: SymptomAnalysis;
  recomendacao: {
    produto: Pick<
      Produto,
      "id" | "nome" | "marca" | "amperagem" | "modelo" | "precoVenda" | "garantiaMeses" | "tipo"
    >;
    servicos: string[];
    veiculoResolvido: string;
    aplicacaoUsada: string;
    confidenceLabel: "opção recomendada" | "boa recomendação" | "recomendação com confirmação técnica";
    alerta?: string;
    justificativaCliente: string;
    justificativa: string;
  };
  academicDetails: {
    semanticProblemInterpreter: SemanticProblemAnalysis;
    naiveBayes: Omit<AnaliseSentimentoResultado, "tokensProcessados">;
    fuzzy: FuzzyResultado;
    geneticAlgorithm: {
      fitness: number;
      criterios: {
        compatibilidade: boolean;
        estoqueDisponivel: boolean;
        margemLucro: number;
        preferenciaCliente: ClienteRequest["preferencia"];
      };
    };
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
    semanticAnalysis?: SemanticProblemAnalysis;
  };
}

export interface RecomendacaoSucesso {
  success: true;
  type: "RECOMMENDATION";
  message: string;
  customerMessage: string;
  data: RecomendacaoResultado;
}

export interface SocialResponse {
  success: true;
  type: "SOCIAL_RESPONSE";
  intent: Exclude<MessageIntent, "automotive_request" | "unknown">;
  message: string;
}

export type RecomendacaoServiceResponse = RecomendacaoFalha | RecomendacaoSucesso | SocialResponse;
