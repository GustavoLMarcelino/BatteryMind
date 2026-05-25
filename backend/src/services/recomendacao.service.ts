import { ClienteRequest, UrgenciaInformada } from "../types/clienteRequest.types.js";
import { ConversationContext } from "../types/conversationContext.types.js";
import { FuzzyInput } from "../types/fuzzy.types.js";
import { InputExtraction } from "../types/inputValidation.types.js";
import { CategoriaVeiculo, Produto } from "../types/produto.types.js";
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
import type { SemanticProblemAnalysis } from "./semanticProblemInterpreter.service.js";
import { semanticProblemInterpreterService } from "./semanticProblemInterpreter.service.js";
import { symptomTriageService } from "./symptomTriage.service.js";

export class RecomendacaoService {
  recomendar(cliente: ClienteRequest): RecomendacaoServiceResponse {
    this.validarContratoBasico(cliente);

    const intent = intentDetectionService.detectMessageIntent(cliente.mensagem);

    if (["greeting", "thanks", "confirmation", "farewell"].includes(intent.intent)) {
      return this.criarRespostaSocial(intent.intent as Exclude<MessageIntent, "automotive_request" | "unknown">);
    }

    const conversationId = cliente.conversationId || "default";
    let contexto = conversationContextService.updateContextFromMessage(
      conversationId,
      cliente.mensagem,
      cliente
    );
    const semanticAnalysis = semanticProblemInterpreterService.interpretProblemSemantically(cliente.mensagem);
    contexto = conversationContextService.applySemanticAnalysis(conversationId, semanticAnalysis);
    const clienteComContexto = conversationContextService.mergeContextWithRequest(contexto, cliente);
    const bloqueioContextual = this.validarPendenciasContextuais(contexto, clienteComContexto);

    if (bloqueioContextual) {
      return bloqueioContextual;
    }

    const validacaoEntrada = inputValidationService.validar(clienteComContexto, semanticAnalysis);

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
        validacaoEntrada.extracted,
        semanticAnalysis
      );
    }

    const clienteInterpretado = this.aplicarExtracoes(clienteComContexto, validacaoEntrada.extracted);
    const symptomAnalysis = symptomTriageService.analyzeSymptoms(clienteInterpretado.mensagem, contexto);
    const analysisForResponse = this.combinarAnaliseDeSintoma(symptomAnalysis, semanticAnalysis);

    if (!semanticAnalysis.canRecommendBattery && semanticAnalysis.category === "polo_danificado") {
      return this.criarFalha(
        "NEED_MORE_DETAILS",
        semanticAnalysis.customerMessage,
        "Interpretação semântica indica problema principal nos terminais, sem confirmação de bateria danificada",
        ["inspecaoTerminais"],
        "Recomendo verificar os cabos, polos e terminais antes de trocar a bateria.",
        validacaoEntrada.inputConfidence,
        contexto,
        validacaoEntrada.extracted,
        semanticAnalysis
      );
    }
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

    const produtosPriorizados = this.filtrarProdutosPorPreferencia(produtosCompativeis, clienteInterpretado);
    const analiseSentimento = naiveBayesService.analisar(clienteInterpretado.mensagem);
    const urgencia = this.calcularUrgencia(clienteInterpretado, semanticAnalysis);
    const produtoReferencia = this.selecionarProdutoReferencia(
      produtosPriorizados,
      clienteInterpretado.orcamentoMaximo
    );
    const margemReferencia =
      (produtoReferencia.precoVenda - produtoReferencia.custo) / produtoReferencia.precoVenda;
    const fuzzyInput: FuzzyInput = {
      probabilidadeNegativo: analiseSentimento.probabilidades.negativo,
      urgencia,
      orcamento: clienteInterpretado.orcamentoMaximo,
      estoqueDisponivel: produtoReferencia.quantidadeEstoque,
      margemLucro: margemReferencia,
      semanticSeverity: semanticAnalysis.severity,
      semanticCategory: semanticAnalysis.category
    };
    const analiseFuzzy = fuzzyService.calcular(fuzzyInput);
    const servicosBase = this.definirServicos(clienteInterpretado, analiseFuzzy.prioridade);
    const melhorIndividuo = geneticAlgorithmService.executar({
      produtos: produtosPriorizados,
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

    const servicosCliente = semanticAnalysis.category !== "desconhecido"
      ? semanticAnalysis.recommendedServices
      : this.mesclarServicos(melhorIndividuo.servicos, analysisForResponse.recommendedServices);
    const customerMessage = this.gerarMensagemCliente(clienteInterpretado, contexto, analysisForResponse, semanticAnalysis);
    const justificativaCliente = this.gerarJustificativaCliente(
      clienteInterpretado,
      melhorIndividuo.produto,
      contexto,
      analysisForResponse,
      semanticAnalysis
    );
    const margemLucro = Number(
      ((melhorIndividuo.produto.precoVenda - melhorIndividuo.produto.custo) / melhorIndividuo.produto.precoVenda).toFixed(4)
    );

    return {
      success: true,
      type: "RECOMMENDATION",
      message: "Recomendação gerada com sucesso",
      customerMessage,
      data: {
        cliente: clienteInterpretado.nomeCliente,
        entrada: clienteInterpretado,
        inputConfidence: validacaoEntrada.inputConfidence,
        context: contexto,
        extracted: validacaoEntrada.extracted,
        semanticAnalysis,
        symptomAnalysis: analysisForResponse,
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
          servicos: servicosCliente,
          veiculoResolvido: clienteInterpretado.veiculo,
          aplicacaoUsada: clienteInterpretado.veiculo,
          confidenceLabel: this.classificarRecomendacao(melhorIndividuo.fitness, analysisForResponse),
          ...(melhorIndividuo.fitness < 60
            ? { alerta: "Confirme a aplicação e faça o teste elétrico antes da troca." }
            : {}),
          justificativaCliente,
          justificativa: justificativaCliente
        },
        academicDetails: {
          semanticProblemInterpreter: semanticAnalysis,
          naiveBayes: {
            sentimento: analiseSentimento.sentimento,
            confianca: analiseSentimento.confianca,
            probabilidades: analiseSentimento.probabilidades,
            ...(analiseSentimento.observacao ? { observacao: analiseSentimento.observacao } : {})
          },
          fuzzy: analiseFuzzy,
          geneticAlgorithm: {
            fitness: melhorIndividuo.fitness,
            criterios: {
              compatibilidade: true,
              estoqueDisponivel: melhorIndividuo.produto.quantidadeEstoque > 0,
              margemLucro,
              preferenciaCliente: clienteInterpretado.preferencia
            }
          }
        }
      }
    };
  }

  calcularUrgencia(cliente: ClienteRequest, semanticAnalysis?: SemanticProblemAnalysis): number {
    const basePorUrgencia = {
      baixa: 0.25,
      media: 0.55,
      alta: 0.8
    } satisfies Record<UrgenciaInformada, number>;
    const urgenciaSemantica = {
      baixa: 0.25,
      media: 0.55,
      alta: 0.8,
      critica: 1
    } satisfies Record<SemanticProblemAnalysis["severity"], number>;
    const palavrasChave = ["urgente", "hoje", "agora", "não liga", "nao liga", "parado", "socorro"];
    const reforcos = palavrasChave.filter((palavra) => includesNormalized(cliente.mensagem, palavra));
    const base = Math.max(
      basePorUrgencia[cliente.urgenciaInformada],
      semanticAnalysis ? urgenciaSemantica[semanticAnalysis.severity] : 0
    );
    const urgencia = base + reforcos.length * 0.08;

    return Number(Math.min(1, urgencia).toFixed(2));
  }

  private aplicarExtracoes(cliente: ClienteRequest, extracted: InputExtraction): ClienteRequest {
    const orcamentoInformado =
      cliente.orcamentoMaximo > 0 && cliente.orcamentoMaximo !== extracted.ano ? cliente.orcamentoMaximo : 0;

    return {
      ...cliente,
      veiculo: cliente.veiculo?.trim() || extracted.veiculo || "",
      orcamentoMaximo: extracted.orcamento ?? orcamentoInformado,
      preferencia: this.inferirPreferencia(cliente),
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

  private filtrarProdutosPorPreferencia(produtos: Produto[], cliente: ClienteRequest): Produto[] {
    const mensagem = cliente.mensagem;
    const pediuMarcaPremium = includesNormalized(mensagem, "moura") || includesNormalized(mensagem, "heliar");
    const semOrcamento = cliente.orcamentoMaximo <= 0;
    const candidatosComOrcamento =
      cliente.orcamentoMaximo > 0 ? produtos.filter((produto) => produto.precoVenda <= cliente.orcamentoMaximo) : [];
    const base = candidatosComOrcamento.length > 0 ? candidatosComOrcamento : produtos;

    if (cliente.preferencia === "qualidade" || pediuMarcaPremium) {
      const premium = base.filter(
        (produto) => produto.tipo === "premium" || ["moura", "heliar"].includes(produto.marca.toLowerCase())
      );
      return premium.length > 0 ? premium : base;
    }

    if (cliente.preferencia === "economia" || (cliente.preferencia === "custo-beneficio" && semOrcamento)) {
      const economicas = base.filter((produto) => produto.tipo === "economica");
      return economicas.length > 0 ? economicas : base;
    }

    const custoBeneficio = base.filter((produto) => produto.tipo !== "premium");
    return custoBeneficio.length > 0 ? custoBeneficio : base;
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

    return [...servicos];
  }

  private combinarAnaliseDeSintoma(
    symptomAnalysis: SymptomAnalysis,
    semanticAnalysis: SemanticProblemAnalysis
  ): SymptomAnalysis {
    if (semanticAnalysis.category === "desconhecido") {
      return symptomAnalysis;
    }

    const categoryBySemantic: Record<SemanticProblemAnalysis["category"], SymptomAnalysis["symptomCategory"]> = {
      bateria_ausente: "sem_energia",
      bateria_explodiu: "sem_energia",
      vazamento_acido: "sem_energia",
      bateria_inchada: "sem_energia",
      polo_danificado: "desconhecido",
      sem_carga: "problema_recorrente",
      bateria_fraca: "bateria_fraca",
      problema_eletrico: "desconhecido",
      sintoma_generico: "generico_nao_liga",
      intencao_compra_bateria: "sintoma_nao_informado",
      desconhecido: symptomAnalysis.symptomCategory
    };

    return {
      symptomCategory: categoryBySemantic[semanticAnalysis.category],
      confidence: Math.max(
        symptomAnalysis.confidence,
        semanticAnalysis.category === "sintoma_generico" ? 60 : semanticAnalysis.isPurchaseIntent ? 70 : 90
      ),
      possibleCauses: [...new Set([...symptomAnalysis.possibleCauses, semanticAnalysis.interpretedProblem])],
      recommendedQuestions: semanticAnalysis.canRecommendBattery ? [] : symptomAnalysis.recommendedQuestions,
      recommendedServices: [...new Set([...symptomAnalysis.recommendedServices, ...semanticAnalysis.recommendedServices])],
      canRecommendBatteryDirectly: semanticAnalysis.canRecommendBattery,
      warning: semanticAnalysis.requiresSafetyWarning ? semanticAnalysis.customerMessage : symptomAnalysis.warning
    };
  }

  private gerarMensagemCliente(
    cliente: ClienteRequest,
    contexto: ConversationContext,
    symptomAnalysis: SymptomAnalysis,
    semanticAnalysis: SemanticProblemAnalysis
  ): string {
    if (semanticAnalysis.category !== "desconhecido") {
      if (semanticAnalysis.category === "intencao_compra_bateria" && cliente.veiculo) {
        return `Separei uma opção compatível para ${cliente.veiculo}. Como você não informou nenhum sintoma, estou considerando que é uma solicitação de orçamento/troca de bateria. Se o veículo estiver apresentando problema, me diga o que acontece, por exemplo: não liga, partida fraca ou painel apagando.`;
      }

      if (semanticAnalysis.category === "bateria_ausente" && cliente.veiculo) {
        return `Entendi que o veículo está sem bateria instalada. Posso indicar uma bateria compatível com o ${cliente.veiculo} e recomendo realizar a instalação com verificação dos terminais.`;
      }

      return semanticAnalysis.customerMessage;
    }

    if (symptomAnalysis.symptomCategory === "bateria_fraca" && symptomAnalysis.confidence >= 80) {
      return "Como a luz do painel fica fraca ao virar a chave, pode haver queda de tensão na partida. Recomendo realizar teste de bateria e verificação dos terminais antes da troca.";
    }

    if (symptomAnalysis.symptomCategory === "generico_nao_liga") {
      return "Quando o veículo não liga, pode ser bateria fraca, baixa carga, mau contato nos terminais ou outra falha elétrica. Recomendo fazer um teste elétrico antes da troca para confirmar a causa.";
    }

    if (symptomAnalysis.symptomCategory === "sem_energia") {
      return "Esse sintoma pode indicar bateria descarregada ou mau contato nos terminais. Recomendo fazer um teste de bateria e verificar os terminais antes da troca.";
    }

    if (symptomAnalysis.symptomCategory === "problema_recorrente") {
      return "Como o problema parece recorrente, o ideal é testar bateria, alternador e fuga de corrente antes de substituir a bateria.";
    }

    if (cliente.preferencia === "qualidade") {
      return "Separei uma opção premium compatível com o veículo informado, com foco em qualidade e garantia. A confirmação final deve ser feita após teste elétrico.";
    }

    if (contexto.tipoVeiculo === "caminhao") {
      return "Separei uma opção compatível com o sistema informado. Para caminhão, confirme a tensão e faça o teste elétrico antes da troca.";
    }

    return "Separei uma opção compatível com o veículo informado. Antes da troca, recomendamos realizar teste de bateria, alternador e terminais para confirmar a causa do problema.";
  }

  private gerarJustificativaCliente(
    cliente: ClienteRequest,
    produto: Produto,
    contexto: ConversationContext,
    symptomAnalysis: SymptomAnalysis,
    semanticAnalysis: SemanticProblemAnalysis
  ): string {
    if (semanticAnalysis.requiresSafetyWarning) {
      return "Opção compatível para substituição, com atendimento técnico recomendado por segurança. Antes da instalação, verifique terminais, alternador e sistema de carga.";
    }

    if (semanticAnalysis.category === "bateria_ausente") {
      return "Opção compatível para instalação no veículo informado. Recomendo verificar os terminais e testar o sistema de carga após a instalação.";
    }

    if (semanticAnalysis.category === "intencao_compra_bateria") {
      return `Opção compatível com ${cliente.veiculo}. A confirmação final da aplicação deve ser feita antes da instalação.`;
    }

    if (cliente.preferencia === "qualidade" || produto.tipo === "premium") {
      return "Opção premium compatível com o veículo informado, indicada para quem prioriza qualidade e garantia. A confirmação final deve ser feita após teste elétrico.";
    }

    if (cliente.preferencia === "economia") {
      return "Opção econômica compatível com o veículo informado. A confirmação final deve ser feita após teste elétrico.";
    }

    if (symptomAnalysis.canRecommendBatteryDirectly) {
      return "Opção compatível com o veículo informado. A confirmação final deve ser feita após teste elétrico.";
    }

    if (contexto.tipoVeiculo === "caminhao") {
      return "Produto compatível com a categoria informada. Confirme o modelo e a tensão do sistema antes da instalação.";
    }

    return "Produto indicado como opção compatível. A confirmação final deve ser feita após teste elétrico no veículo.";
  }

  private inferirPreferencia(cliente: ClienteRequest): ClienteRequest["preferencia"] {
    const mensagem = cliente.mensagem;

    if (
      includesNormalized(mensagem, "barata") ||
      includesNormalized(mensagem, "barato") ||
      includesNormalized(mensagem, "economia") ||
      includesNormalized(mensagem, "economico") ||
      includesNormalized(mensagem, "econômico")
    ) {
      return "economia";
    }

    if (
      includesNormalized(mensagem, "melhor") ||
      includesNormalized(mensagem, "top") ||
      includesNormalized(mensagem, "qualidade") ||
      includesNormalized(mensagem, "premium") ||
      includesNormalized(mensagem, "moura") ||
      includesNormalized(mensagem, "heliar")
    ) {
      return "qualidade";
    }

    return cliente.preferencia;
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
    extracted?: InputExtraction,
    semanticAnalysis?: SemanticProblemAnalysis
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
        ...(extracted ? { extracted } : {}),
        ...(semanticAnalysis ? { semanticAnalysis } : {})
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
    const mencaoGenericaSemSintoma = Boolean(contexto.genericProblemMention && !contexto.problema);
    const temProblema = Boolean(contexto.problema && contexto.problema !== "problema não especificado");
    const mensagemAtualTemTensao =
      includesNormalized(cliente.mensagem, "24v") ||
      includesNormalized(cliente.mensagem, "12v") ||
      cliente.mensagem.trim() === "24" ||
      cliente.mensagem.trim() === "12";

    if (!temTensao) {
      conversationContextService.setLastQuestionType(contexto.conversationId, "truck_voltage");
      if (mencaoGenericaSemSintoma) {
        return this.criarFalha(
          "NEED_VEHICLE_MODEL_AND_SYMPTOM",
          "Entendi que há um problema no caminhão, mas preciso do modelo, da tensão 12V/24V e do sintoma apresentado.",
          "Caminhão informado com menção genérica de problema, sem tensão e sem sintoma",
          ["modelo", "tensao", "descricaoProblema"],
          "Informe o modelo do caminhão, se usa 12V ou 24V, e o que está acontecendo. Exemplo: 'Meu caminhão 24V não acende nada'.",
          30,
          contexto
        );
      }
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
      if (contexto.genericProblemMention && !contexto.problema) {
        return this.criarFalha(
          "NEED_VEHICLE_MODEL_AND_SYMPTOM",
          "Entendi que há um problema na moto, mas preciso do modelo/cilindrada e do sintoma apresentado.",
          "Moto informada com menção genérica de problema, sem modelo e sem sintoma",
          ["modelo", "cilindrada", "descricaoProblema"],
          "Informe o modelo/cilindrada da moto e o que está acontecendo. Exemplo: 'Minha CG 160 não acende nada'.",
          30,
          contexto
        );
      }
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

  private classificarRecomendacao(
    fitness: number,
    symptomAnalysis: SymptomAnalysis
  ): "opção recomendada" | "boa recomendação" | "recomendação com confirmação técnica" {
    if (!symptomAnalysis.canRecommendBatteryDirectly || symptomAnalysis.confidence < 70 || fitness < 60) {
      return "recomendação com confirmação técnica";
    }

    if (fitness <= 84) return "boa recomendação";
    return "opção recomendada";
  }
}

export const recomendacaoService = new RecomendacaoService();
