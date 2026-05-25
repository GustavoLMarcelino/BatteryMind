import { includesNormalized, normalizeText } from "../utils/textPreprocessing.js";

export type SemanticProblemAnalysis = {
  category:
    | "bateria_ausente"
    | "bateria_explodiu"
    | "vazamento_acido"
    | "bateria_inchada"
    | "polo_danificado"
    | "sem_carga"
    | "bateria_fraca"
    | "problema_eletrico"
    | "sintoma_generico"
    | "intencao_compra_bateria"
    | "desconhecido";
  severity: "baixa" | "media" | "alta" | "critica";
  interpretedProblem: string;
  canRecommendBattery: boolean;
  requiresSymptom: boolean;
  isPurchaseIntent: boolean;
  requiresSafetyWarning: boolean;
  recommendedServices: string[];
  customerMessage: string;
  technicalNotes: string[];
};

const defaultAnalysis: SemanticProblemAnalysis = {
  category: "desconhecido",
  severity: "baixa",
  interpretedProblem: "Problema não identificado semanticamente",
  canRecommendBattery: false,
  requiresSymptom: true,
  isPurchaseIntent: false,
  requiresSafetyWarning: false,
  recommendedServices: ["Teste elétrico"],
  customerMessage:
    "Preciso entender melhor o que está acontecendo com o veículo para orientar a escolha da bateria com segurança.",
  technicalNotes: ["Sem categoria semântica reconhecida no domínio de baterias automotivas."]
};

export class SemanticProblemInterpreterService {
  interpretProblemSemantically(message: string): SemanticProblemAnalysis {
    const text = message ?? "";

    // Pré-processamento de domínio: transforma linguagem natural em categorias técnicas
    // antes das camadas acadêmicas de Naive Bayes, Fuzzy e Algoritmo Genético.
    if (
      this.hasAny(text, ["a bateria explodiu", "bateria explodiu", "a bateria estourou", "bateria estourada", "estourou a bateria", "a bateria abriu", "a bateria rachou", "a bateria rompeu"]) ||
      this.hasBatteryWithAny(text, ["explodiu", "estourou", "estourada", "abriu", "rachou", "rompeu"])
    ) {
      return {
        category: "bateria_explodiu",
        severity: "critica",
        interpretedProblem: "Possível ruptura ou explosão da bateria",
        canRecommendBattery: true,
        requiresSymptom: false,
        isPurchaseIntent: false,
        requiresSafetyWarning: true,
        recommendedServices: [
          "Atendimento técnico com segurança",
          "Substituição da bateria danificada",
          "Verificação dos terminais",
          "Teste do alternador",
          "Verificação do sistema de carga"
        ],
        customerMessage:
          "Isso indica um problema grave na bateria. Por segurança, não tente ligar o veículo e evite contato com qualquer líquido da bateria. Recomendo substituição da bateria com verificação dos terminais e teste do sistema de carga.",
        technicalNotes: [
          "Evento crítico de segurança.",
          "Pode indicar ruptura interna, sobrecarga, curto, falha no regulador de tensão ou dano físico."
        ]
      };
    }

    if (this.hasAny(text, ["vazou ácido", "vazando ácido", "ácido da bateria", "liquido saindo da bateria", "líquido saindo da bateria", "bateria vazando", "bateria melada", "tem líquido na bateria"])) {
      return {
        category: "vazamento_acido",
        severity: "critica",
        interpretedProblem: "Possível vazamento de ácido da bateria",
        canRecommendBattery: true,
        requiresSymptom: false,
        isPurchaseIntent: false,
        requiresSafetyWarning: true,
        recommendedServices: [
          "Atendimento com equipamento de proteção",
          "Substituição da bateria",
          "Limpeza segura da área afetada",
          "Verificação dos terminais",
          "Teste do alternador"
        ],
        customerMessage:
          "Pode ser vazamento de ácido da bateria. Evite contato com o líquido e não tente manusear a bateria sem proteção. Recomendo atendimento técnico para substituição e verificação do sistema elétrico.",
        technicalNotes: [
          "Evento crítico por risco químico.",
          "Requer inspeção segura antes de qualquer tentativa de partida."
        ]
      };
    }

    if (this.hasAny(text, ["bateria inchada", "a bateria inchou", "bateria estufada", "bateria deformada", "bateria cresceu", "bateria empenou"])) {
      return {
        category: "bateria_inchada",
        severity: "alta",
        interpretedProblem: "Bateria deformada ou inchada",
        canRecommendBattery: true,
        requiresSymptom: false,
        isPurchaseIntent: false,
        requiresSafetyWarning: true,
        recommendedServices: [
          "Substituição da bateria",
          "Teste do alternador",
          "Teste do sistema de carga",
          "Verificação dos terminais"
        ],
        customerMessage:
          "A bateria pode estar danificada ou sobrecarregada. Recomendo não forçar o uso e realizar a substituição com teste do alternador e sistema de carga.",
        technicalNotes: [
          "Deformação pode indicar sobrecarga, aquecimento ou falha interna.",
          "Recomendação exige teste do sistema de carga."
        ]
      };
    }

    if (this.hasAny(text, ["não tem bateria", "nao tem bateria", "está sem bateria", "esta sem bateria", "o carro está sem bateria", "o carro esta sem bateria", "roubaram a bateria", "bateria foi roubada", "tiraram a bateria", "a bateria sumiu", "preciso colocar uma bateria", "comprei sem bateria", "fiquei sem bateria", "carro está sem bateria", "carro esta sem bateria"])) {
      return {
        category: "bateria_ausente",
        severity: "media",
        interpretedProblem: "Veículo sem bateria instalada",
        canRecommendBattery: true,
        requiresSymptom: false,
        isPurchaseIntent: false,
        requiresSafetyWarning: false,
        recommendedServices: [
          "Instalação de bateria",
          "Verificação dos terminais",
          "Teste do sistema de carga após instalação"
        ],
        customerMessage:
          "Entendi que o veículo está sem bateria instalada. Nesse caso, posso indicar uma bateria compatível com o modelo do veículo e recomendar a instalação com verificação dos terminais.",
        technicalNotes: [
          "Sem bateria instalada é problema suficiente para recomendação.",
          "Ainda é necessário identificar o modelo do veículo para compatibilidade."
        ]
      };
    }

    if (this.hasAny(text, ["precisa de uma bateria", "preciso de uma bateria", "quero uma bateria", "quero comprar uma bateria", "preciso trocar a bateria", "qual bateria para", "bateria para meu", "quanto fica uma bateria", "orçamento de bateria", "orcamento de bateria", "precisa de bateria", "preciso de bateria"])) {
      return {
        category: "intencao_compra_bateria",
        severity: "baixa",
        interpretedProblem: "Cliente procura uma bateria compatível",
        canRecommendBattery: true,
        requiresSymptom: false,
        isPurchaseIntent: true,
        requiresSafetyWarning: false,
        recommendedServices: ["Instalação da bateria", "Verificação dos terminais"],
        customerMessage:
          "Separei uma opção compatível para o veículo informado. Como você não informou nenhum sintoma, estou considerando que é uma solicitação de orçamento/troca de bateria. Se o veículo estiver apresentando problema, me diga o que acontece, por exemplo: não liga, partida fraca ou painel apagando.",
        technicalNotes: [
          "Intenção de compra/orçamento sem relato de sintoma técnico.",
          "Quando há modelo do veículo, a recomendação pode seguir como orçamento de aplicação."
        ]
      };
    }

    if (this.hasAny(text, ["polo derreteu", "polo queimou", "terminal derreteu", "terminal queimou"])) {
      return this.createTerminalAnalysis("alta", true, "Terminais ou polos com sinal de aquecimento severo");
    }

    if (this.hasAny(text, ["terminal oxidado", "zinabre", "cabo solto", "mau contato", "terminal quebrado", "polo oxidado", "polo com zinabre"])) {
      return this.createTerminalAnalysis("media", false, "Possível mau contato, oxidação ou terminal danificado");
    }

    if (this.hasAny(text, ["vive descarregando", "sempre descarrega", "descarrega todo dia", "descarregando direto", "troquei e descarregou", "bateria descarregou", "sem carga", "arriou", "bateria arriou", "ficou sem carga", "acabou a bateria"])) {
      return {
        category: "sem_carga",
        severity: "media",
        interpretedProblem: "Bateria descarregada ou perdendo carga",
        canRecommendBattery: true,
        requiresSymptom: false,
        isPurchaseIntent: false,
        requiresSafetyWarning: false,
        recommendedServices: [
          "Teste de bateria",
          "Teste do alternador",
          "Teste de fuga de corrente"
        ],
        customerMessage:
          "A bateria pode estar descarregada ou no fim da vida útil. Recomendo fazer um teste de bateria e verificar se o alternador está carregando corretamente.",
        technicalNotes: [
          "Descarga pode ser sintoma de bateria no fim da vida útil, alternador ou fuga de corrente.",
          "Teste elétrico deve anteceder a substituição."
        ]
      };
    }

    if (this.hasAny(text, ["luz do painel fica fraca", "luz do painel fica mais fraca", "painel fica mais fraco", "painel enfraquece", "painel pisca", "partida fraca", "motor gira fraco", "faz tec tec", "tec tec"])) {
      return {
        category: "bateria_fraca",
        severity: "media",
        interpretedProblem: "Indício de bateria fraca ou queda de tensão na partida",
        canRecommendBattery: true,
        requiresSymptom: false,
        isPurchaseIntent: false,
        requiresSafetyWarning: false,
        recommendedServices: ["Teste de bateria", "Teste elétrico", "Verificação dos terminais"],
        customerMessage:
          "Como a luz do painel fica fraca ao virar a chave, pode haver queda de tensão na partida. Recomendo realizar teste de bateria e verificação dos terminais antes da troca.",
        technicalNotes: ["Sintoma compatível com bateria fraca, baixa carga ou mau contato nos terminais."]
      };
    }

    if (this.hasAny(text, ["não liga", "nao liga", "não está ligando", "nao esta ligando", "não pega", "nao pega", "sem partida"])) {
      return {
        category: "sintoma_generico",
        severity: "media",
        interpretedProblem: "Veículo não liga, causa ainda não confirmada",
        canRecommendBattery: true,
        requiresSymptom: false,
        isPurchaseIntent: false,
        requiresSafetyWarning: false,
        recommendedServices: ["Teste elétrico", "Teste de bateria", "Verificação dos terminais"],
        customerMessage:
          "Quando o veículo não liga, pode ser bateria fraca, baixa carga, mau contato nos terminais ou outra falha elétrica. Recomendo fazer um teste elétrico antes da troca para confirmar a causa.",
        technicalNotes: ["Sintoma genérico com múltiplas causas possíveis."]
      };
    }

    return defaultAnalysis;
  }

  private createTerminalAnalysis(
    severity: SemanticProblemAnalysis["severity"],
    requiresSafetyWarning: boolean,
    interpretedProblem: string
  ): SemanticProblemAnalysis {
    return {
      category: "polo_danificado",
      severity,
      interpretedProblem,
      canRecommendBattery: false,
      requiresSymptom: false,
      isPurchaseIntent: false,
      requiresSafetyWarning,
      recommendedServices: [
        "Verificação dos terminais",
        "Limpeza dos polos",
        "Teste de bateria",
        "Teste elétrico"
      ],
      customerMessage:
        "Esse sintoma pode indicar mau contato, aquecimento ou problema nos terminais. Recomendo verificar os cabos e terminais antes de trocar a bateria.",
      technicalNotes: [
        "Problema principal identificado nos polos, cabos ou terminais.",
        "Não recomenda troca direta de bateria sem inspeção dos terminais."
      ]
    };
  }

  private hasAny(text: string, expressions: string[]): boolean {
    return expressions.some((expression) => includesNormalized(text, expression));
  }

  private hasBatteryWithAny(text: string, expressions: string[]): boolean {
    const normalizedText = normalizeText(text);
    return normalizedText.includes("bateria") && expressions.some((expression) => normalizedText.includes(normalizeText(expression)));
  }
}

export const semanticProblemInterpreterService = new SemanticProblemInterpreterService();
