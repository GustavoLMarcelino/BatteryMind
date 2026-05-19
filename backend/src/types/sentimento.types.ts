export type Sentimento = "positivo" | "neutro" | "negativo";

export interface SentimentoDatasetItem {
  texto: string;
  sentimento: Sentimento;
}

export interface AnaliseSentimentoResultado {
  sentimento: Sentimento;
  confianca: number;
  probabilidades: Record<Sentimento, number>;
  tokensProcessados: string[];
  observacao?: string;
}
