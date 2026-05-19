import { ClienteRequest, PreferenciaCliente, UrgenciaInformada } from "../types/clienteRequest.types.js";
import { ConversationContext, TensaoVeiculo, TipoVeiculoContexto } from "../types/conversationContext.types.js";
import { includesNormalized, normalizeText } from "../utils/textPreprocessing.js";

const contexts = new Map<string, ConversationContext>();

const carModels = [
  "gol",
  "onix",
  "hb20",
  "uno",
  "palio",
  "celta",
  "corolla",
  "civic",
  "hilux",
  "virtus",
  "polo",
  "saveiro",
  "voyage",
  "fox",
  "ka",
  "fiesta",
  "ecosport",
  "strada",
  "toro",
  "s10",
  "ranger",
  "amarok"
];

const motoModels = [
  "cg 125",
  "cg 150",
  "cg 160",
  "fan 125",
  "fan 150",
  "fan 160",
  "start 160",
  "biz 100",
  "biz 110",
  "biz 125",
  "pop 100",
  "pop 110",
  "fazer 150",
  "fazer 250",
  "factor 125",
  "factor 150",
  "lander 250",
  "xre 190",
  "xre 300",
  "twister 250",
  "bros 150",
  "bros 160",
  "titan 150",
  "titan 160"
];

const aliasesModelos: Record<string, string> = {
  onxi: "onix"
};

const problemasConhecidos = [
  "nao acende nada",
  "painel nao acende",
  "nao liga nada",
  "morreu tudo",
  "sem energia",
  "painel pisca",
  "arrasta para ligar",
  "partida pesada",
  "partida fraca",
  "motor gira fraco",
  "vive descarregando",
  "sempre descarrega",
  "descarrega todo dia",
  "troquei e descarregou",
  "descarregando direto",
  "nao esta ligando",
  "nao liga",
  "nao quer ligar",
  "descarregou",
  "descarregando",
  "bateria arriou",
  "bateria morreu",
  "sem partida",
  "falha na partida",
  "nao pega",
  "problema na bateria",
  "problema"
];

type MessageExtraction = {
  tipoVeiculo?: TipoVeiculoContexto;
  modelo?: string;
  ano?: string;
  tensao?: TensaoVeiculo;
  problema?: string;
  orcamentoMaximo?: number;
  preferencia?: PreferenciaCliente;
  urgencia?: UrgenciaInformada;
};

export class ConversationContextService {
  getContext(conversationId: string): ConversationContext {
    const existingContext = contexts.get(conversationId);

    if (existingContext) return existingContext;

    const newContext: ConversationContext = {
      conversationId,
      mensagens: [],
      tipoVeiculo: "desconhecido",
      lastQuestionType: "unknown",
      updatedAt: new Date()
    };

    contexts.set(conversationId, newContext);
    return newContext;
  }

  updateContextFromMessage(
    conversationId: string,
    message: string,
    currentBody: ClienteRequest
  ): ConversationContext {
    let context = this.getContext(conversationId);
    const normalizedMessage = normalizeText(message);
    const extraction = this.extractFromMessage(normalizedMessage, currentBody, context);

    if (this.detectContextSwitch(context, extraction)) {
      context = this.resetVehicleContext(context, extraction.tipoVeiculo);
    }

    context.nomeCliente = currentBody.nomeCliente || context.nomeCliente;
    context.mensagens.push(message);

    if (extraction.tipoVeiculo) context.tipoVeiculo = extraction.tipoVeiculo;
    if (extraction.modelo) context.modelo = extraction.modelo;
    if (extraction.ano) context.ano = extraction.ano;
    if (extraction.tensao) context.tensao = extraction.tensao;
    if (extraction.problema) context.problema = extraction.problema;
    if (extraction.orcamentoMaximo) context.orcamentoMaximo = extraction.orcamentoMaximo;
    if (extraction.preferencia) context.preferencia = extraction.preferencia;
    if (extraction.urgencia) context.urgencia = extraction.urgencia;

    const bodyVehicle = currentBody.veiculo?.trim();
    context.veiculo = bodyVehicle || this.buildVehicleFromContext(context);
    context.updatedAt = new Date();
    contexts.set(conversationId, context);

    return context;
  }

  clearContext(conversationId: string): void {
    contexts.delete(conversationId);
  }

  setLastQuestionType(conversationId: string, lastQuestionType: ConversationContext["lastQuestionType"]): void {
    const context = this.getContext(conversationId);
    context.lastQuestionType = lastQuestionType;
    context.updatedAt = new Date();
    contexts.set(conversationId, context);
  }

  mergeContextWithRequest(context: ConversationContext, request: ClienteRequest): ClienteRequest {
    return {
      ...request,
      conversationId: context.conversationId,
      nomeCliente: request.nomeCliente || context.nomeCliente || "Cliente",
      veiculo: request.veiculo?.trim() || context.veiculo || "",
      orcamentoMaximo: request.orcamentoMaximo > 0 ? request.orcamentoMaximo : context.orcamentoMaximo ?? 0,
      preferencia: context.preferencia ?? request.preferencia,
      urgenciaInformada: this.chooseStrongestUrgency(request.urgenciaInformada, context.urgencia ?? "baixa")
    };
  }

  detectContextSwitch(previousContext: ConversationContext, newExtraction: MessageExtraction): boolean {
    if (!previousContext.tipoVeiculo || previousContext.tipoVeiculo === "desconhecido") return false;

    if (
      newExtraction.tipoVeiculo &&
      newExtraction.tipoVeiculo !== "desconhecido" &&
      newExtraction.tipoVeiculo !== previousContext.tipoVeiculo
    ) {
      return true;
    }

    if (
      newExtraction.modelo &&
      previousContext.modelo &&
      normalizeText(newExtraction.modelo) !== normalizeText(previousContext.modelo)
    ) {
      return true;
    }

    return false;
  }

  private extractFromMessage(
    text: string,
    currentBody: ClienteRequest,
    context: ConversationContext
  ): MessageExtraction {
    const tipoVeiculo = this.extractVehicleType(text, context);
    const modelo = this.extractModel(text);
    const ano = this.extractYear(text);
    const tensao = this.extractVoltage(text, context);
    const problema = this.extractProblem(text);
    const orcamentoMaximo = this.extractBudget(text);
    const preferencia = this.extractPreference(text, currentBody.preferencia);
    const urgencia = this.extractUrgency(text, currentBody.urgenciaInformada, problema);

    return { tipoVeiculo, modelo, ano, tensao, problema, orcamentoMaximo, preferencia, urgencia };
  }

  private resetVehicleContext(context: ConversationContext, nextType?: TipoVeiculoContexto): ConversationContext {
    return {
      conversationId: context.conversationId,
      nomeCliente: context.nomeCliente,
      mensagens: context.mensagens,
      tipoVeiculo: nextType ?? "desconhecido",
      preferencia: context.preferencia,
      urgencia: context.urgencia,
      lastQuestionType: "unknown",
      updatedAt: new Date()
    };
  }

  private extractVoltage(text: string, context: ConversationContext): TensaoVeiculo | undefined {
    if (
      /\b24\s*v\b/.test(text) ||
      /\b24\s*volts?\b/.test(text) ||
      /\bsistema\s*24\b/.test(text) ||
      (context.tipoVeiculo === "caminhao" && context.lastQuestionType === "truck_voltage" && text === "24")
    ) {
      return "24V";
    }

    if (
      /\b12\s*v\b/.test(text) ||
      /\b12\s*volts?\b/.test(text) ||
      /\bsistema\s*12\b/.test(text) ||
      (context.tipoVeiculo === "caminhao" && context.lastQuestionType === "truck_voltage" && text === "12")
    ) {
      return "12V";
    }

    return undefined;
  }

  private extractVehicleType(text: string, context: ConversationContext): TipoVeiculoContexto | undefined {
    if (includesNormalized(text, "caminhao")) return "caminhao";
    if (includesNormalized(text, "moto") || motoModels.some((model) => includesNormalized(text, model))) return "moto";
    if (carModels.some((model) => new RegExp(`\\b${model}\\b`).test(text))) return "carro";
    if (includesNormalized(text, "carro") || includesNormalized(text, "veiculo")) return "carro";
    if (context.tipoVeiculo === "caminhao" && /\b(ele|ela|e|usa|sistema)\b/.test(text)) return "caminhao";

    return undefined;
  }

  private extractModel(text: string): string | undefined {
    const motoModel = motoModels.find((model) => includesNormalized(text, model));
    if (motoModel) return this.formatModel(motoModel);

    const carModel =
      carModels.find((model) => new RegExp(`\\b${model}\\b`).test(text)) ??
      this.extractModelAlias(text);

    if (!carModel) return undefined;

    const year = this.extractYear(text);
    const motorMatch = text.match(new RegExp(`\\b${carModel}\\b\\s*(\\d\\s\\d|\\d\\.\\d)?`));
    const motor = motorMatch?.[1]?.replace(/\s+/, ".");
    const formatted = this.formatModel(carModel);

    if (motor) return `${formatted} ${motor}`;
    if (year) return `${formatted} ${year}`;

    return formatted;
  }

  private extractModelAlias(text: string): string | undefined {
    const alias = text.split(" ").find((token) => aliasesModelos[token]);
    return alias ? aliasesModelos[alias] : undefined;
  }

  private extractYear(text: string): string | undefined {
    const match = text.match(/\b(19[8-9]\d|20[0-3]\d)\b/);
    return match?.[1];
  }

  private extractProblem(text: string): string | undefined {
    const problem = problemasConhecidos.find((item) => includesNormalized(text, item));
    if (problem === "problema") return "problema não especificado";
    return problem;
  }

  private extractBudget(text: string): number | undefined {
    const matches = [
      ...text.matchAll(/(?:ate|r\$|rs|orcamento|valor|preco)\s*(?:de|em|ate)?\s*(\d{2,5})(?:\s*reais)?/g),
      ...text.matchAll(/\b(\d{2,5})\s*reais\b/g)
    ];
    const match = matches.find((item) => {
      const value = Number(item[1]);
      return value < 1980 || value > 2035;
    });

    return match ? Number(match[1]) : undefined;
  }

  private extractPreference(text: string, fallback: PreferenciaCliente): PreferenciaCliente {
    if (includesNormalized(text, "bom e barato") || includesNormalized(text, "custo beneficio")) return "custo-beneficio";
    if (includesNormalized(text, "barato") || includesNormalized(text, "mais em conta") || includesNormalized(text, "economico")) return "economia";
    if (includesNormalized(text, "melhor") || includesNormalized(text, "premium") || includesNormalized(text, "qualidade") || includesNormalized(text, "top")) return "qualidade";
    return fallback;
  }

  private extractUrgency(text: string, fallback: UrgenciaInformada, problem?: string): UrgenciaInformada {
    if (includesNormalized(text, "urgente") || includesNormalized(text, "hoje") || includesNormalized(text, "agora") || includesNormalized(text, "parado") || includesNormalized(text, "socorro")) {
      return "alta";
    }
    if (problem) return fallback === "alta" ? "alta" : "media";
    return fallback;
  }

  private buildVehicleFromContext(context: ConversationContext): string | undefined {
    if (context.tipoVeiculo === "caminhao" && context.tensao) return `Caminhão ${context.tensao}`;
    if (context.tipoVeiculo === "moto" && context.modelo) return context.modelo;
    if (context.modelo) return context.modelo;
    if (context.tipoVeiculo === "caminhao") return "Caminhão";
    return undefined;
  }

  private chooseStrongestUrgency(requestUrgency: UrgenciaInformada, contextUrgency: UrgenciaInformada): UrgenciaInformada {
    const score = { baixa: 1, media: 2, alta: 3 } satisfies Record<UrgenciaInformada, number>;
    return score[contextUrgency] > score[requestUrgency] ? contextUrgency : requestUrgency;
  }

  private formatModel(model: string): string {
    const specialNames: Record<string, string> = {
      hb20: "HB20",
      s10: "S10",
      ka: "Ka",
      xre: "XRE",
      cg: "CG"
    };
    return model
      .split(" ")
      .map((part) => specialNames[part] ?? part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
}

export const conversationContextService = new ConversationContextService();
