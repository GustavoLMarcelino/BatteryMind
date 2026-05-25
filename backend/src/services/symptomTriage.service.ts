import { ConversationContext } from "../types/conversationContext.types.js";
import { SymptomAnalysis } from "../types/symptomTriage.types.js";
import { includesNormalized } from "../utils/textPreprocessing.js";

const unansweredSymptomQuestions = [
  "O painel acende?",
  "Ao dar partida o painel pisca ou apaga?",
  "Faz barulho tipo 'tec tec'?",
  "A partida está fraca?",
  "Não acende nada?"
];

const specificSymptomExpressions = [
  "nao acende nada",
  "painel nao acende",
  "nao liga nada",
  "morreu tudo",
  "sem energia",
  "luz do painel fica fraca",
  "luz do painel fica mais fraca",
  "painel fica mais fraco",
  "painel enfraquece",
  "luz fica fraca",
  "luz do painel apaga",
  "painel apaga ao virar a chave",
  "painel pisca",
  "painel pisca ao dar partida",
  "painel fica piscando",
  "luz do painel pisca",
  "quando viro a chave fica fraco",
  "ao virar a chave fica fraco",
  "arrasta para ligar",
  "partida pesada",
  "partida fraca",
  "motor gira fraco",
  "faz tec tec",
  "tec tec",
  "vive descarregando",
  "sempre descarrega",
  "descarrega todo dia",
  "troquei e descarregou",
  "descarregando direto",
  "descarregou",
  "bateria arriou",
  "bateria morreu",
  "nao liga",
  "nao esta ligando",
  "nao quer ligar",
  "nao pega"
];

export class SymptomTriageService {
  analyzeSymptoms(message: string, context: ConversationContext): SymptomAnalysis {
    const combinedText = `${context.mensagens.join(" ")} ${message}`;

    if (this.hasGenericProblemMention(combinedText) && !this.hasAny(combinedText, specificSymptomExpressions)) {
      return {
        symptomCategory: "sintoma_nao_informado",
        confidence: 20,
        possibleCauses: [],
        recommendedQuestions: unansweredSymptomQuestions,
        recommendedServices: ["Teste elétrico"],
        canRecommendBatteryDirectly: false
      };
    }

    if (this.hasAny(combinedText, ["nao acende nada", "painel nao acende", "nao liga nada", "morreu tudo", "sem energia", "descarregou", "bateria arriou", "bateria morreu"])) {
      return {
        symptomCategory: "sem_energia",
        confidence: 85,
        possibleCauses: ["bateria descarregada", "mau contato nos terminais", "cabo solto", "bateria danificada"],
        recommendedQuestions: [],
        recommendedServices: ["Teste de bateria", "Teste dos terminais", "Instalação se confirmado defeito"],
        canRecommendBatteryDirectly: true,
        warning: "Há forte indício de bateria descarregada ou mau contato, mas é recomendado confirmar com teste de bateria e terminais antes da troca."
      };
    }

    if (
      this.hasAny(combinedText, [
        "luz do painel fica mais fraca",
        "luz do painel fica fraca",
        "painel fica mais fraco",
        "painel enfraquece",
        "luz fica fraca",
        "luz do painel apaga",
        "painel apaga ao virar a chave",
        "painel pisca ao dar partida",
        "painel pisca",
        "painel fica piscando",
        "luz do painel pisca",
        "quando viro a chave fica fraco",
        "ao virar a chave fica fraco"
      ])
    ) {
      return {
        symptomCategory: "bateria_fraca",
        confidence: 80,
        possibleCauses: ["bateria fraca", "baixa carga", "mau contato nos terminais"],
        recommendedQuestions: [],
        recommendedServices: ["Teste de bateria", "Teste elétrico", "Verificação dos terminais"],
        canRecommendBatteryDirectly: true,
        warning:
          "Como a luz do painel fica fraca ao virar a chave, pode haver queda de tensão na partida. Recomendo realizar teste de bateria e verificação dos terminais antes da troca."
      };
    }

    if (this.hasAny(combinedText, ["arrasta para ligar", "partida pesada", "partida fraca", "motor gira fraco", "faz tec tec", "tec tec"])) {
      return {
        symptomCategory: "bateria_fraca",
        confidence: 75,
        possibleCauses: ["bateria fraca", "bateria com baixa carga", "mau contato", "motor de arranque exigindo demais"],
        recommendedQuestions: [],
        recommendedServices: ["Teste de bateria", "Teste de alternador", "Teste de partida"],
        canRecommendBatteryDirectly: true,
        warning: "O sintoma sugere bateria fraca, mas o ideal é confirmar com teste antes da troca."
      };
    }

    if (this.hasAny(combinedText, ["vive descarregando", "sempre descarrega", "descarrega todo dia", "troquei e descarregou", "descarregando direto"])) {
      return {
        symptomCategory: "problema_recorrente",
        confidence: 80,
        possibleCauses: ["fuga de corrente", "alternador não carregando", "bateria no fim da vida útil"],
        recommendedQuestions: ["A bateria descarrega mesmo com o veículo parado?", "O alternador já foi testado?"],
        recommendedServices: ["Teste de alternador", "Teste de fuga de corrente", "Teste de bateria"],
        canRecommendBatteryDirectly: false,
        warning: "Como o problema é recorrente, é recomendado diagnóstico elétrico antes de vender uma bateria."
      };
    }

    if (this.hasAny(combinedText, ["nao liga", "nao esta ligando", "nao quer ligar", "nao pega"])) {
      return {
        symptomCategory: "generico_nao_liga",
        confidence: 50,
        possibleCauses: ["bateria fraca", "mau contato", "motor de arranque", "alternador", "sistema elétrico"],
        recommendedQuestions: [
          "O painel acende normalmente?",
          "Ao tentar dar partida o painel pisca ou apaga?",
          "Faz algum barulho tipo 'tec tec'?",
          "Aconteceu depois de ficar parado?"
        ],
        recommendedServices: ["Teste elétrico", "Teste de bateria", "Verificação dos terminais"],
        canRecommendBatteryDirectly: true,
        warning: "O sintoma informado é genérico. A recomendação considera uma possível falha de bateria, mas o ideal é realizar teste elétrico para confirmar antes da troca."
      };
    }

    return {
      symptomCategory: "desconhecido",
      confidence: 20,
      possibleCauses: [],
      recommendedQuestions: ["O que acontece ao tentar ligar o veículo?"],
      recommendedServices: ["Teste elétrico"],
      canRecommendBatteryDirectly: false
    };
  }

  private hasAny(text: string, expressions: string[]): boolean {
    return expressions.some((expression) => includesNormalized(text, expression));
  }

  private hasGenericProblemMention(text: string): boolean {
    return this.hasAny(text, [
      "estou com problema",
      "estou com um problema",
      "meu carro esta com problema",
      "minha moto esta com problema",
      "tenho um problema",
      "tenho problema",
      "deu problema",
      "esta com problema",
      "ta com problema",
      "com problema",
      "com problema no",
      "com problema na",
      "problema no veiculo",
      "problema no carro",
      "problema na moto",
      "problema no caminhao"
    ]);
  }
}

export const symptomTriageService = new SymptomTriageService();
