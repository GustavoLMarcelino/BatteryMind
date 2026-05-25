export type Prioridade = "baixa" | "media" | "alta" | "urgente";
export type NivelRisco = "baixo" | "medio" | "alto";

export interface FuzzyInput {
  probabilidadeNegativo: number;
  urgencia: number;
  orcamento: number;
  estoqueDisponivel: number;
  margemLucro: number;
  semanticSeverity?: "baixa" | "media" | "alta" | "critica";
  semanticCategory?: string;
}

export interface FuzzyResultado {
  scoreFuzzy: number;
  prioridade: Prioridade;
  nivelRisco: NivelRisco;
}
