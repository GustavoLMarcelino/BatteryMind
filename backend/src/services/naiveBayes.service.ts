import { datasetSentimentos } from "../data/datasetSentimentos.data.js";
import {
  AnaliseSentimentoResultado,
  Sentimento,
  SentimentoDatasetItem
} from "../types/sentimento.types.js";
import { AppError } from "../utils/errors.js";
import { includesNormalized, tokenize } from "../utils/textPreprocessing.js";

type ContagemPorClasse = Record<Sentimento, Map<string, number>>;

const sentimentos: Sentimento[] = ["positivo", "neutro", "negativo"];
const tokensGenericos = new Set(["oi", "ola", "olá", "estou", "bom", "sim", "nao", "não", "ok", "teste", "opa"]);
const palavrasRelevantes = [
  "bateria",
  "carro",
  "veiculo",
  "veículo",
  "moto",
  "caminhao",
  "caminhão",
  "gol",
  "onix",
  "hb20",
  "uno",
  "palio",
  "celta",
  "corolla",
  "civic",
  "hilux",
  "descarregou",
  "descarregada",
  "não liga",
  "nao liga",
  "partida",
  "trocar",
  "troca",
  "preço",
  "preco",
  "valor",
  "orçamento",
  "orcamento",
  "garantia",
  "urgente",
  "hoje",
  "agora",
  "alternador"
];

export class NaiveBayesService {
  private readonly vocabulario = new Set<string>();
  private readonly contagemPalavras: ContagemPorClasse = {
    positivo: new Map(),
    neutro: new Map(),
    negativo: new Map()
  };
  private readonly totalPalavrasPorClasse: Record<Sentimento, number> = {
    positivo: 0,
    neutro: 0,
    negativo: 0
  };
  private readonly totalDocumentosPorClasse: Record<Sentimento, number> = {
    positivo: 0,
    neutro: 0,
    negativo: 0
  };

  constructor(dataset: SentimentoDatasetItem[] = datasetSentimentos) {
    this.treinar(dataset);
  }

  analisar(mensagem: string): AnaliseSentimentoResultado {
    if (!mensagem || mensagem.trim().length === 0) {
      throw new AppError("Mensagem é obrigatória");
    }

    const tokens = tokenize(mensagem);
    const tokensRelevantes = tokens.filter((token) => !tokensGenericos.has(token));

    if (
      tokensRelevantes.length === 0 ||
      !palavrasRelevantes.some((palavra) => includesNormalized(mensagem, palavra))
    ) {
      return {
        sentimento: "neutro",
        confianca: 0,
        probabilidades: {
          positivo: 0.33,
          neutro: 0.34,
          negativo: 0.33
        },
        tokensProcessados: tokens,
        observacao: "Mensagem insuficiente para análise de sentimento confiável."
      };
    }

    const probabilidadesLog = this.calcularProbabilidadesLog(tokens);
    const probabilidades = this.normalizarProbabilidades(probabilidadesLog);
    const maiorProbabilidade = Math.max(...Object.values(probabilidades));
    const sentimentoCalculado = sentimentos.reduce((melhor, atual) =>
      probabilidades[atual] > probabilidades[melhor] ? atual : melhor
    );
    const baixaConfianca = maiorProbabilidade < 0.55;

    return {
      sentimento: baixaConfianca ? "neutro" : sentimentoCalculado,
      confianca: Number((maiorProbabilidade * 100).toFixed(2)),
      probabilidades,
      tokensProcessados: tokens,
      ...(baixaConfianca
        ? { observacao: "Classificação com baixa confiança; sentimento tratado como neutro." }
        : {})
    };
  }

  private treinar(dataset: SentimentoDatasetItem[]): void {
    dataset.forEach((item) => {
      const tokens = tokenize(item.texto);
      this.totalDocumentosPorClasse[item.sentimento] += 1;

      tokens.forEach((token) => {
        this.vocabulario.add(token);
        const contagemAtual = this.contagemPalavras[item.sentimento].get(token) ?? 0;
        this.contagemPalavras[item.sentimento].set(token, contagemAtual + 1);
        this.totalPalavrasPorClasse[item.sentimento] += 1;
      });
    });
  }

  private calcularProbabilidadesLog(tokens: string[]): Record<Sentimento, number> {
    const totalDocumentos = Object.values(this.totalDocumentosPorClasse).reduce(
      (total, quantidade) => total + quantidade,
      0
    );
    const tamanhoVocabulario = this.vocabulario.size || 1;

    return sentimentos.reduce(
      (resultado, sentimento) => {
        const documentosClasse = this.totalDocumentosPorClasse[sentimento];
        let logProbabilidade = Math.log(documentosClasse / totalDocumentos);

        tokens.forEach((token) => {
          const ocorrencias = this.contagemPalavras[sentimento].get(token) ?? 0;
          const totalPalavrasClasse = this.totalPalavrasPorClasse[sentimento];

          // Suavização de Laplace evita probabilidade zero para palavras novas.
          const probabilidadeToken =
            (ocorrencias + 1) / (totalPalavrasClasse + tamanhoVocabulario);
          logProbabilidade += Math.log(probabilidadeToken);
        });

        resultado[sentimento] = logProbabilidade;
        return resultado;
      },
      {} as Record<Sentimento, number>
    );
  }

  private normalizarProbabilidades(logs: Record<Sentimento, number>): Record<Sentimento, number> {
    const maiorLog = Math.max(...Object.values(logs));
    const expValores = sentimentos.reduce(
      (resultado, sentimento) => {
        resultado[sentimento] = Math.exp(logs[sentimento] - maiorLog);
        return resultado;
      },
      {} as Record<Sentimento, number>
    );
    const soma = Object.values(expValores).reduce((total, valor) => total + valor, 0);

    return sentimentos.reduce(
      (resultado, sentimento) => {
        resultado[sentimento] = Number((expValores[sentimento] / soma).toFixed(4));
        return resultado;
      },
      {} as Record<Sentimento, number>
    );
  }
}

export const naiveBayesService = new NaiveBayesService();
