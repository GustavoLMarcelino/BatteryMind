import { ConversationContext } from "../types/conversationContext.types.js";
import { SymptomAnalysis } from "../types/symptomTriage.types.js";
import { includesNormalized } from "../utils/textPreprocessing.js";

export class SymptomTriageService {
  analyzeSymptoms(message: string, context: ConversationContext): SymptomAnalysis {
    const combinedText = `${context.mensagens.join(" ")} ${message}`;

    if (this.hasAny(combinedText, ["não acende nada", "nao acende nada", "painel não acende", "painel nao acende", "não liga nada", "nao liga nada", "morreu tudo", "sem energia"])) {
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

    if (this.hasAny(combinedText, ["painel pisca", "painel fica piscando", "luz do painel pisca", "arrasta para ligar", "partida pesada", "partida fraca", "motor gira fraco"])) {
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

    if (this.hasAny(combinedText, ["não liga", "nao liga", "não está ligando", "nao esta ligando", "não quer ligar", "nao quer ligar", "não pega", "nao pega"])) {
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
}

export const symptomTriageService = new SymptomTriageService();
