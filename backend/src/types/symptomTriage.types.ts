export type SymptomCategory =
  | "sem_energia"
  | "bateria_fraca"
  | "partida_fraca"
  | "problema_recorrente"
  | "generico_nao_liga"
  | "desconhecido";

export type SymptomAnalysis = {
  symptomCategory: SymptomCategory;
  confidence: number;
  possibleCauses: string[];
  recommendedQuestions: string[];
  recommendedServices: string[];
  canRecommendBatteryDirectly: boolean;
  warning?: string;
};
