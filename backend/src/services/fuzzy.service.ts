import { FuzzyInput, FuzzyResultado, NivelRisco, Prioridade } from "../types/fuzzy.types.js";
import { AppError } from "../utils/errors.js";

export class FuzzyService {
  calcular(input: FuzzyInput): FuzzyResultado {
    this.validarInput(input);

    const negativoAlto = this.pertinenciaAlta(input.probabilidadeNegativo);
    const negativoMedio = this.pertinenciaMedia(input.probabilidadeNegativo);
    const negativoBaixo = this.pertinenciaBaixa(input.probabilidadeNegativo);
    const urgenciaAlta = this.pertinenciaAlta(input.urgencia);
    const urgenciaMedia = this.pertinenciaMedia(input.urgencia);
    const urgenciaBaixa = this.pertinenciaBaixa(input.urgencia);
    const margemAlta = this.pertinenciaAlta(input.margemLucro);
    const margemMedia = this.pertinenciaMedia(input.margemLucro);
    const estoqueDisponivel = input.estoqueDisponivel > 0 ? 1 : 0;
    const orcamentoBaixo = input.orcamento <= 400 ? 1 : input.orcamento <= 600 ? 0.5 : 0;

    // Regras fuzzy didáticas: cada regra gera uma força e empurra o score.
    let score =
      48 +
      Math.min(negativoAlto, urgenciaAlta) * 45 +
      Math.min(negativoMedio, urgenciaAlta) * 20 +
      Math.min(negativoBaixo, urgenciaBaixa) * -15 +
      urgenciaMedia * 12 +
      margemAlta * estoqueDisponivel * 12 +
      margemMedia * estoqueDisponivel * 6 +
      orcamentoBaixo * 4;

    if (!estoqueDisponivel) {
      score = Math.min(score, 25);
    }

    const scoreFuzzy = Math.round(Math.max(0, Math.min(100, score)));

    return {
      scoreFuzzy,
      prioridade: this.converterPrioridade(scoreFuzzy),
      nivelRisco: this.converterRisco(scoreFuzzy)
    };
  }

  private pertinenciaBaixa(valor: number): number {
    if (valor <= 0.25) return 1;
    if (valor >= 0.55) return 0;
    return (0.55 - valor) / 0.3;
  }

  private pertinenciaMedia(valor: number): number {
    if (valor <= 0.25 || valor >= 0.85) return 0;
    if (valor === 0.55) return 1;
    if (valor < 0.55) return (valor - 0.25) / 0.3;
    return (0.85 - valor) / 0.3;
  }

  private pertinenciaAlta(valor: number): number {
    if (valor <= 0.55) return 0;
    if (valor >= 0.85) return 1;
    return (valor - 0.55) / 0.3;
  }

  private converterPrioridade(score: number): Prioridade {
    if (score <= 39) return "baixa";
    if (score <= 64) return "media";
    if (score <= 84) return "alta";
    return "urgente";
  }

  private converterRisco(score: number): NivelRisco {
    if (score <= 39) return "baixo";
    if (score <= 74) return "medio";
    return "alto";
  }

  private validarInput(input: FuzzyInput): void {
    const valoresNormalizados = [input.probabilidadeNegativo, input.urgencia, input.margemLucro];
    const possuiValorInvalido = valoresNormalizados.some((valor) => valor < 0 || valor > 1);

    if (possuiValorInvalido) {
      throw new AppError("Probabilidade, urgência e margem devem estar entre 0 e 1");
    }

    if (input.orcamento < 0 || input.estoqueDisponivel < 0) {
      throw new AppError("Orçamento e estoque não podem ser negativos");
    }
  }
}

export const fuzzyService = new FuzzyService();
