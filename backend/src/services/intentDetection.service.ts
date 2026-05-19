import { includesNormalized, normalizeText } from "../utils/textPreprocessing.js";

export type MessageIntent =
  | "greeting"
  | "thanks"
  | "confirmation"
  | "farewell"
  | "automotive_request"
  | "unknown";

export interface MessageIntentResult {
  intent: MessageIntent;
  confidence: number;
}

const greetings = ["oi", "olá", "ola", "opa", "bom dia", "boa tarde", "boa noite", "e aí", "eai"];
const thanks = [
  "obrigado",
  "obrigada",
  "valeu",
  "brigado",
  "brigada",
  "muito obrigado",
  "muito obrigada",
  "agradeço",
  "grato"
];
const confirmations = [
  "ok",
  "certo",
  "beleza",
  "show",
  "tá bom",
  "ta bom",
  "entendi",
  "perfeito",
  "combinado",
  "sim"
];
const farewells = ["tchau", "até mais", "ate mais", "falou", "até", "ate", "bom trabalho"];
const automotiveHints = [
  "bateria",
  "carro",
  "veiculo",
  "moto",
  "caminhao",
  "gol",
  "onix",
  "hb20",
  "virtus",
  "corolla",
  "hilux",
  "nao liga",
  "partida",
  "descarregou",
  "trocar",
  "preco",
  "valor",
  "orcamento"
];

export class IntentDetectionService {
  detectMessageIntent(message: string): MessageIntentResult {
    const normalizedMessage = normalizeText(message);

    if (!normalizedMessage) {
      return { intent: "unknown", confidence: 0 };
    }

    if (this.matchesSocialIntent(normalizedMessage, thanks)) {
      return { intent: "thanks", confidence: 0.95 };
    }

    if (this.matchesSocialIntent(normalizedMessage, greetings)) {
      return { intent: "greeting", confidence: 0.95 };
    }

    if (this.matchesSocialIntent(normalizedMessage, confirmations)) {
      return { intent: "confirmation", confidence: 0.95 };
    }

    if (this.matchesSocialIntent(normalizedMessage, farewells)) {
      return { intent: "farewell", confidence: 0.95 };
    }

    if (automotiveHints.some((hint) => includesNormalized(normalizedMessage, hint))) {
      return { intent: "automotive_request", confidence: 0.8 };
    }

    return { intent: "unknown", confidence: 0.4 };
  }

  private matchesSocialIntent(normalizedMessage: string, examples: string[]): boolean {
    return examples.some((example) => {
      const normalizedExample = normalizeText(example);
      return (
        normalizedMessage === normalizedExample ||
        normalizedMessage === `${normalizedExample}!` ||
        normalizedMessage.startsWith(`${normalizedExample} `)
      );
    });
  }
}

export const intentDetectionService = new IntentDetectionService();
