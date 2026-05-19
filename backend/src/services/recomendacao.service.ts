import { ClienteRequest, UrgenciaInformada } from "../types/clienteRequest.types.js";
import { ConversationContext } from "../types/conversationContext.types.js";
import { FuzzyInput } from "../types/fuzzy.types.js";
import { InputExtraction } from "../types/inputValidation.types.js";
import { CategoriaVeiculo } from "../types/produto.types.js";
import { RecomendacaoFalha, RecomendacaoServiceResponse } from "../types/recomendacao.types.js";
import { SymptomAnalysis } from "../types/symptomTriage.types.js";
import { AppError } from "../utils/errors.js";
import { includesNormalized, tokenize } from "../utils/textPreprocessing.js";
import { fuzzyService } from "./fuzzy.service.js";
import { conversationContextService } from "./conversationContext.service.js";
import { geneticAlgorithmService } from "./geneticAlgorithm.service.js";
import { inputValidationService } from "./inputValidation.service.js";
import { intentDetectionService, MessageIntent } from "./intentDetection.service.js";
import { naiveBayesService } from "./naiveBayes.service.js";
import { produtoService } from "./produto.service.js";
import { symptomTriageService } from "./symptomTriage.service.js";

export class RecomendacaoService {
  recomendar(cliente: ClienteRequest): RecomendacaoServiceResponse {
    this.validarContratoBasico(cliente);

    const intent = intentDetectionService.detectMessageIntent(cliente.mensagem);

    if (["greeting", "thanks", "confirmation", "farewell"].includes(intent.intent)) {
      return this.criarRespostaSocial(intent.intent as Exclude<MessageIntent, "automotive_request" | "unknown">);
    }

    const conversationId = cliente.conversationId || "default";
    const contexto = conversationContextService.updateContextFromMessage(
      conversationId,
      cliente.mensagem,
      cliente
    );
    const clienteComContexto = conversationContextService.mergeContextWithRequest(contexto, cliente);
    const bloqueioContextual = this.validarPendenciasContextuais(contexto, clienteComContexto);

    if (bloqueioContextual) {
      return bloqueioContextual;
    }

    const validacaoEntrada = inputValidationService.validar(clienteComContexto);

    if (!validacaoEntrada.isValid) {
      return this.criarFalha(
        validacaoEntrada.type ?? "INSUFFICIENT_INFORMATION",
        validacaoEntrada.message ?? "Não consegui recomendar uma bateria ainda.",
        validacaoEntrada.reason ?? "Informações insuficientes para recomendação segura",
        validacaoEntrada.missingFields,
        validacaoEntrada.suggestedQuestion ??
          "Informe o modelo do veículo e descreva o problema. Exemplo: 'Meu Gol 1.0 não liga e preciso trocar a bateria hoje'.",
        validacaoEntrada.inputConfidence,
        contexto,
        validacaoEntrada.extracted
      );
    }

    const clienteInterpretado = this.aplicarExtracoes(clienteComContexto, validacaoEntrada.extracted);
    const symptomAnalysis = symptomTriageService.analyzeSymptoms(clienteInterpretado.mensagem, contexto);
    const categoriaVeiculo = this.obterCategoriaVeiculo(contexto);
    const todosProdutosCompativeis = produtoService.listarCompativeisPorCategoria(
      clienteInterpretado.veiculo,
      categoriaVeiculo
    );

    if (todosProdutosCompativeis.length === 0) {
      return this.criarFalha(
        "NO_COMPATIBLE_PRODUCT",
        this.criarMensagemSemProduto(validacaoEntrada.extracted),
        "Nenhum produto cadastrado atende ao veículo informado",
        [],
        "Confirme o modelo do veículo ou consulte a loja para uma avaliação manual.",
        validacaoEntrada.inputConfidence,
        contexto,
        validacaoEntrada.extracted
      );
    }

    const produtosCompativeis = todosProdutosCompativeis.filter((produto) => produto.quantidadeEstoque > 0);

    if (produtosCompativeis.length === 0) {
      return this.criarFalha(
        "NO_COMPATIBLE_PRODUCT",
        "Não encontrei uma bateria compatível com estoque disponível para o veículo informado.",
        "Produtos compatíveis existem, mas estão sem estoque",
        [],
        "Consulte a loja para previsão de reposição ou avaliação de alternativa equivalente.",
        validacaoEntrada.inputConfidence,
        contexto,
        validacaoEntrada.extracted
      );
    }

    const analiseSentimento = naiveBayesService.analisar(clienteInterpretado.mensagem);
    const urgencia = this.calcularUrgencia(clienteInterpretado);
    const produtoReferencia = this.selecionarProdutoReferencia(
      produtosCompativeis,
      clienteInterpretado.orcamentoMaximo
    );
    const margemReferencia =
      (produtoReferencia.precoVenda - produtoReferencia.custo) / produtoReferencia.precoVenda;
    const fuzzyInput: FuzzyInput = {
      probabilidadeNegativo: analiseSentimento.probabilidades.negativo,
      urgencia,
      orcamento: clienteInterpretado.orcamentoMaximo,
      estoqueDisponivel: produtoReferencia.quantidadeEstoque,
      margemLucro: margemReferencia
    };
    const analiseFuzzy = fuzzyService.calcular(fuzzyInput);
    const servicosBase = this.definirServicos(clienteInterpretado, analiseFuzzy.prioridade);
    const melhorIndividuo = geneticAlgorithmService.executar({
      produtos: produtosCompativeis,
      cliente: clienteInterpretado,
      fuzzy: analiseFuzzy,
      servicosBase
    });

    if (!melhorIndividuo) {
      throw new AppError("Não foi possível gerar uma recomendação segura", 422);
    }

    if (melhorIndividuo.fitness < 50) {
      return this.criarFalha(
        "NEED_MORE_DETAILS",
        "A recomendação ficou com baixa confiança. Confirme mais dados do veículo antes da venda.",
        "Fitness abaixo do limite mínimo de segurança",
        ["modelo", "aplicacao"],
        "Confirme o modelo exato, ano e sintomas antes de recomendar a bateria.",
        validacaoEntrada.inputConfidence,
        contexto,
        validacaoEntrada.extracted
      );
    }

    return {
      success: true,
      message: "Recomendação gerada com sucesso",
      data: {
        cliente: clienteInterpretado.nomeCliente,
        entrada: clienteInterpretado,
        inputConfidence: validacaoEntrada.inputConfidence,
        context: contexto,
        extracted: validacaoEntrada.extracted,
        symptomAnalysis,
        analiseSentimento: {
          sentimento: analiseSentimento.sentimento,
          confianca: analiseSentimento.confianca,
          probabilidades: analiseSentimento.probabilidades,
          ...(analiseSentimento.observacao ? { observacao: analiseSentimento.observacao } : {})
        },
        analiseFuzzy,
        recomendacao: {
          produto: {
            id: melhorIndividuo.produto.id,
            nome: melhorIndividuo.produto.nome,
            marca: melhorIndividuo.produto.marca,
            amperagem: melhorIndividuo.produto.amperagem,
            modelo: melhorIndividuo.produto.modelo,
            precoVenda: melhorIndividuo.produto.precoVenda,
            garantiaMeses: melhorIndividuo.produto.garantiaMeses,
            tipo: melhorIndividuo.produto.tipo
          },
          servicos: this.mesclarServicos(melhorIndividuo.servicos, symptomAnalysis.recommendedServices),
          fitness: melhorIndividuo.fitness,
          confidenceLabel: this.classificarFitness(melhorIndividuo.fitness),
          ...(melhorIndividuo.fitness < 60
            ? { alerta: "Recomendação com baixa confiança. Confirme aplicação antes da venda." }
            : {}),
          justificativa: this.gerarJustificativa(
            clienteInterpretado,
            melhorIndividuo.produto.precoVenda,
            contexto,
            symptomAnalysis
          )
        }
      }
    };
  }

  calcularUrgencia(cliente: ClienteRequest): number {
    const basePorUrgencia = {
      baixa: 0.25,
      media: 0.55,
      alta: 0.8
    } satisfies Record<UrgenciaInformada, number>;
    const palavrasChave = ["urgente", "hoje", "agora", "não liga", "nao liga", "parado", "socorro"];
    const reforcos = palavrasChave.filter((palavra) => includesNormalized(cliente.mensagem, palavra));
    const urgencia = basePorUrgencia[cliente.urgenciaInformada] + reforcos.length * 0.08;

    return Number(Math.min(1, urgencia).toFixed(2));
  }

  private aplicarExtracoes(cliente: ClienteRequest, extracted: InputExtraction): ClienteRequest {
    const orcamentoInformado =
      cliente.orcamentoMaximo > 0 && cliente.orcamentoMaximo !== extracted.ano ? cliente.orcamentoMaximo : 0;

    return {
      ...cliente,
      veiculo: cliente.veiculo?.trim() || extracted.veiculo || "",
      orcamentoMaximo: extracted.orcamento ?? orcamentoInformado,
      urgenciaInformada: this.escolherUrgenciaMaisForte(cliente.urgenciaInformada, extracted.urgencia)
    };
  }

  private escolherUrgenciaMaisForte(
    informada: UrgenciaInformada,
    extraida: UrgenciaInformada
  ): UrgenciaInformada {
    const peso = { baixa: 1, media: 2, alta: 3 } satisfies Record<UrgenciaInformada, number>;
    return peso[extraida] > peso[informada] ? extraida : informada;
  }

  private selecionarProdutoReferencia(produtos: ReturnType<typeof produtoService.listar>, orcamento: number) {
    const dentroDoOrcamento = orcamento > 0 ? produtos.filter((produto) => produto.precoVenda <= orcamento) : [];
    const candidatos = dentroDoOrcamento.length > 0 ? dentroDoOrcamento : produtos;

    return candidatos.sort((a, b) => b.quantidadeEstoque - a.quantidadeEstoque)[0];
  }

  private definirServicos(cliente: ClienteRequest, prioridade: string): string[] {
    const servicos = new Set<string>();
    const tokens = tokenize(cliente.mensagem);

    if (prioridade === "urgente") {
      servicos.add("Teste elétrico");
      servicos.add("Instalação imediata");
    }

    if (
      tokens.includes("descarregando") ||
      tokens.includes("descarregou") ||
      includesNormalized(cliente.mensagem, "problema recorrente")
    ) {
      servicos.add("Teste do alternador");
      servicos.add("Teste de fuga de corrente");
    }

    if (cliente.preferencia === "economia") {
      servicos.add("Comparação de opções econômicas");
    }

    return [...servicos];
  }

  private gerarJustificativa(
    cliente: ClienteRequest,
    precoVenda: number,
    contexto: ConversationContext,
    symptomAnalysis: SymptomAnalysis
  ): string {
    const textoOrcamento =
      cliente.orcamentoMaximo <= 0
        ? "sem orçamento máximo informado"
        : precoVenda <= cliente.orcamentoMaximo
          ? "dentro do orçamento informado"
          : "próximo ao orçamento informado";

    const avisoCaminhao =
      contexto.tipoVeiculo === "caminhao" && !contexto.modelo
        ? " Como o modelo exato do caminhão não foi informado, a recomendação considera apenas o sistema 24V. O ideal é confirmar o modelo antes da venda."
        : "";
    const avisoSintoma = symptomAnalysis.warning ? ` ${symptomAnalysis.warning}` : "";

    return `Produto compatível com o veículo, ${textoOrcamento}, com estoque disponível, boa margem de lucro e adequado para atendimento ${cliente.urgenciaInformada}.${avisoSintoma}${avisoCaminhao}`;
  }

  private criarMensagemSemProduto(extracted: InputExtraction): string {
    const veiculo = extracted.veiculo ? `o veículo é um ${extracted.veiculo}` : "o veículo informado";
    const problema = extracted.problema ? ` e que ele está com o problema "${extracted.problema}"` : "";

    return `Entendi que ${veiculo}${problema}, mas não encontrei uma bateria compatível cadastrada no sistema.`;
  }

  private validarContratoBasico(cliente: ClienteRequest): void {
    if (!cliente.nomeCliente || !cliente.mensagem) {
      throw new AppError("Nome do cliente e mensagem são obrigatórios");
    }

    if (Number(cliente.orcamentoMaximo) < 0) {
      throw new AppError("Orçamento máximo não pode ser negativo");
    }

    if (!["economia", "custo-beneficio", "qualidade"].includes(cliente.preferencia)) {
      throw new AppError("Preferência inválida");
    }

    if (!["baixa", "media", "alta"].includes(cliente.urgenciaInformada)) {
      throw new AppError("Urgência informada inválida");
    }
  }

  private criarFalha(
    type: RecomendacaoFalha["type"],
    message: string,
    reason: string,
    missingFields: string[],
    suggestedQuestion: string,
    inputConfidence: number,
    context?: ConversationContext,
    extracted?: InputExtraction
  ): RecomendacaoFalha {
    return {
      success: false,
      type,
      message,
      data: {
        reason,
        missingFields,
        suggestedQuestion,
        inputConfidence,
        ...(context ? { context } : {}),
        ...(extracted ? { extracted } : {})
      }
    };
  }

  private criarRespostaSocial(
    intent: Exclude<MessageIntent, "automotive_request" | "unknown">
  ): RecomendacaoServiceResponse {
    const messages = {
      greeting:
        "Olá! Me informe o modelo do veículo e o problema apresentado para eu ajudar a encontrar a melhor bateria.",
      thanks:
        "Disponha! Se precisar de ajuda para escolher uma bateria ou tirar dúvidas sobre o veículo, é só me chamar.",
      confirmation:
        "Certo. Se quiser, me informe o modelo do veículo e o que está acontecendo para eu continuar a análise.",
      farewell:
        "Até mais! Quando precisar, posso ajudar a encontrar a bateria ideal para o seu veículo."
    };

    return {
      success: true,
      type: "SOCIAL_RESPONSE",
      intent,
      message: messages[intent]
    };
  }

  private validarPendenciasContextuais(
    contexto: ConversationContext,
    cliente: ClienteRequest
  ): RecomendacaoFalha | null {
    if (contexto.tipoVeiculo !== "caminhao") {
      if (contexto.tipoVeiculo === "moto") {
        return this.validarPendenciasMoto(contexto);
      }
      return null;
    }

    const temTensao = Boolean(contexto.tensao);
    const temProblema = Boolean(contexto.problema && contexto.problema !== "problema não especificado");
    const mensagemAtualTemTensao =
      includesNormalized(cliente.mensagem, "24v") ||
      includesNormalized(cliente.mensagem, "12v") ||
      cliente.mensagem.trim() === "24" ||
      cliente.mensagem.trim() === "12";

    if (!temTensao) {
      conversationContextService.setLastQuestionType(contexto.conversationId, "truck_voltage");
      return this.criarFalha(
        "NEED_MORE_DETAILS",
        "Qual é o modelo do caminhão e ele usa sistema 12V ou 24V?",
        "Caminhão informado sem tensão do sistema",
        ["modelo", "tensao"],
        "Qual é o modelo do caminhão e ele usa sistema 12V ou 24V?",
        30,
        contexto
      );
    }

    if (!temProblema) {
      conversationContextService.setLastQuestionType(contexto.conversationId, "symptom_detail");
      return this.criarFalha(
        "NEED_MORE_DETAILS",
        mensagemAtualTemTensao
          ? `Perfeito, sistema ${contexto.tensao}. O que acontece com o caminhão: não acende nada, partida fraca, painel pisca ou descarrega com frequência?`
          : "Informe o problema apresentado pelo caminhão.",
        "Caminhão informado com tensão, mas sem problema",
        ["problema"],
        "O que acontece com o caminhão: não acende nada, partida fraca, painel pisca ou descarrega com frequência?",
        40,
        contexto
      );
    }

    return null;
  }

  private validarPendenciasMoto(contexto: ConversationContext): RecomendacaoFalha | null {
    if (!contexto.modelo) {
      conversationContextService.setLastQuestionType(contexto.conversationId, "vehicle_model");
      return this.criarFalha(
        "NEED_MOTO_MODEL",
        "Para recomendar a bateria correta da moto, preciso do modelo e cilindrada. Exemplo: CG 160, Biz 125, Fazer 250 ou XRE 300.",
        "Moto informada sem modelo/cilindrada",
        ["modelo", "cilindrada"],
        "Para recomendar a bateria correta da moto, preciso do modelo e cilindrada. Exemplo: CG 160, Biz 125, Fazer 250 ou XRE 300.",
        30,
        contexto
      );
    }

    if (!contexto.problema || contexto.problema === "problema não especificado") {
      conversationContextService.setLastQuestionType(contexto.conversationId, "symptom_detail");
      return this.criarFalha(
        "NEED_MORE_DETAILS",
        "Entendi o modelo da moto. O que está acontecendo: não acende nada, painel pisca ao dar partida, partida fraca ou descarregou parada?",
        "Moto informada sem sintoma/problema",
        ["descricaoProblema"],
        "O que está acontecendo com a moto: não acende nada, painel pisca, partida fraca ou descarregou parada?",
        50,
        contexto
      );
    }

    return null;
  }

  private obterCategoriaVeiculo(contexto: ConversationContext): CategoriaVeiculo {
    if (contexto.tipoVeiculo === "moto") return "moto";
    if (contexto.tipoVeiculo === "caminhao") return "caminhao";
    return "carro";
  }

  private mesclarServicos(servicos: string[], servicosTriagem: string[]): string[] {
    return [...new Set([...servicos, ...servicosTriagem])];
  }

  private classificarFitness(fitness: number): "baixa confiança" | "confiança moderada" | "boa recomendação" | "recomendação otimizada" {
    if (fitness <= 49) return "baixa confiança";
    if (fitness <= 69) return "confiança moderada";
    if (fitness <= 84) return "boa recomendação";
    return "recomendação otimizada";
  }
}

export const recomendacaoService = new RecomendacaoService();
