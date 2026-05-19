import { ClienteRequest } from "../types/clienteRequest.types.js";
import { FuzzyResultado } from "../types/fuzzy.types.js";
import { IndividuoRecomendacao } from "../types/recomendacao.types.js";
import { Produto } from "../types/produto.types.js";
import { isVehicleCompatible } from "../utils/vehicleCompatibility.js";

interface GeneticInput {
  produtos: Produto[];
  cliente: ClienteRequest;
  fuzzy: FuzzyResultado;
  servicosBase: string[];
}

export class GeneticAlgorithmService {
  executar(input: GeneticInput): IndividuoRecomendacao | null {
    if (input.produtos.length === 0) {
      return null;
    }

    let populacao = this.criarPopulacaoInicial(input);

    for (let geracao = 0; geracao < 30; geracao += 1) {
      populacao = populacao
        .map((individuo) => this.avaliarFitness(individuo, input))
        .sort((a, b) => b.fitness - a.fitness);

      const elite = populacao.slice(0, Math.max(2, Math.ceil(populacao.length / 2)));
      const novaGeracao = [...elite];

      while (novaGeracao.length < populacao.length) {
        const pai = elite[Math.floor(Math.random() * elite.length)];
        const mae = elite[Math.floor(Math.random() * elite.length)];
        const filho = this.mutar(this.crossover(pai, mae), input);
        novaGeracao.push(filho);
      }

      populacao = novaGeracao;
    }

    return populacao
      .map((individuo) => this.avaliarFitness(individuo, input))
      .sort((a, b) => b.fitness - a.fitness)[0];
  }

  private criarPopulacaoInicial(input: GeneticInput): IndividuoRecomendacao[] {
    return input.produtos.flatMap((produto) => [
      { produto, servicos: input.servicosBase, fitness: 0 },
      { produto, servicos: [...new Set([...input.servicosBase, "Teste elétrico"])], fitness: 0 }
    ]);
  }

  private avaliarFitness(
    individuo: IndividuoRecomendacao,
    input: GeneticInput
  ): IndividuoRecomendacao {
    const { produto } = individuo;

    if (!this.ehCompativel(produto, input.cliente.veiculo) || produto.quantidadeEstoque <= 0) {
      return { ...individuo, fitness: 0 };
    }

    const margemPercentual = (produto.precoVenda - produto.custo) / produto.precoVenda;
    const diferencaOrcamento = input.cliente.orcamentoMaximo - produto.precoVenda;
    const orcamentoBase = input.cliente.orcamentoMaximo > 0 ? input.cliente.orcamentoMaximo : produto.precoVenda;
    const pontosOrcamento =
      input.cliente.orcamentoMaximo <= 0
        ? 20
        : diferencaOrcamento >= 0
        ? 25
        : Math.max(0, 25 - Math.abs(diferencaOrcamento / orcamentoBase) * 25);
    const pontosMargem = Math.min(20, margemPercentual * 60);
    const pontosEstoque = Math.min(15, produto.quantidadeEstoque * 3);
    const pontosGarantia = Math.min(15, (produto.garantiaMeses / 30) * 15);
    const pontosPreferencia = this.calcularPontosPreferencia(produto.tipo, input.cliente.preferencia);
    const pontosFuzzy = (input.fuzzy.scoreFuzzy / 100) * 10;

    const fitness =
      pontosOrcamento +
      pontosMargem +
      pontosEstoque +
      pontosGarantia +
      pontosPreferencia +
      pontosFuzzy;

    return {
      ...individuo,
      fitness: Number(Math.min(100, fitness).toFixed(2))
    };
  }

  private crossover(
    pai: IndividuoRecomendacao,
    mae: IndividuoRecomendacao
  ): IndividuoRecomendacao {
    const produto = Math.random() > 0.5 ? pai.produto : mae.produto;
    const servicos = [...new Set([...pai.servicos.slice(0, 1), ...mae.servicos.slice(1)])];

    return { produto, servicos, fitness: 0 };
  }

  private mutar(individuo: IndividuoRecomendacao, input: GeneticInput): IndividuoRecomendacao {
    if (Math.random() > 0.15) {
      return individuo;
    }

    const produto = input.produtos[Math.floor(Math.random() * input.produtos.length)];
    const servicos = [...new Set([...individuo.servicos, ...input.servicosBase])];

    return { produto, servicos, fitness: 0 };
  }

  private calcularPontosPreferencia(tipo: Produto["tipo"], preferencia: ClienteRequest["preferencia"]): number {
    const alinhamentos: Record<ClienteRequest["preferencia"], Produto["tipo"]> = {
      economia: "economica",
      "custo-beneficio": "intermediaria",
      qualidade: "premium"
    };

    return alinhamentos[preferencia] === tipo ? 15 : 7;
  }

  private ehCompativel(produto: Produto, veiculo: string): boolean {
    return isVehicleCompatible(veiculo, produto.aplicacoesVeiculos);
  }
}

export const geneticAlgorithmService = new GeneticAlgorithmService();
