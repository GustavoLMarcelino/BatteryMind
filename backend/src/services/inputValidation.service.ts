import { ClienteRequest, UrgenciaInformada } from "../types/clienteRequest.types.js";
import {
  InputExtraction,
  InputValidationResultado
} from "../types/inputValidation.types.js";
import type { SemanticProblemAnalysis } from "./semanticProblemInterpreter.service.js";
import { includesNormalized, normalizeText, tokenize } from "../utils/textPreprocessing.js";

const palavrasGenericas = new Set([
  "oi",
  "ola",
  "estou",
  "bom",
  "sim",
  "nao",
  "ok",
  "teste",
  "opa"
]);

const modelosConhecidos = [
  "gol",
  "onix",
  "hb20",
  "uno",
  "palio",
  "celta",
  "corolla",
  "civic",
  "hilux",
  "virtus",
  "polo",
  "saveiro",
  "voyage",
  "fox",
  "ka",
  "fiesta",
  "ecosport",
  "strada",
  "toro",
  "s10",
  "ranger",
  "amarok",
  "chevette"
];

const modelosMoto = [
  "cg 125",
  "cg 150",
  "cg 160",
  "fan 125",
  "fan 150",
  "fan 160",
  "start 160",
  "biz 100",
  "biz 110",
  "biz 125",
  "pop 100",
  "pop 110",
  "fazer 150",
  "fazer 250",
  "factor 125",
  "factor 150",
  "lander 250",
  "xre 190",
  "xre 300",
  "twister 250",
  "bros 150",
  "bros 160",
  "titan 150",
  "titan 160"
];

const aliasesModelos: Record<string, string> = {
  onxi: "onix",
  chevete: "chevette"
};

const veiculosGenericos = ["carro", "veiculo", "automovel", "caminhao", "moto"];
const palavrasContexto = [
  "bateria",
  "carro",
  "veiculo",
  "automovel",
  "moto",
  "caminhao",
  "problema",
  "partida",
  "trocar",
  "troca",
  "preco",
  "valor",
  "orcamento",
  "garantia",
  "alternador",
  "motor",
  ...modelosConhecidos,
  ...modelosMoto
];

const problemasConhecidos = [
  "nao acende nada",
  "painel nao acende",
  "nao liga nada",
  "sem energia",
  "luz do painel fica fraca",
  "luz do painel fica mais fraca",
  "painel fica mais fraco",
  "painel enfraquece",
  "luz fica fraca",
  "luz do painel apaga",
  "painel apaga ao virar a chave",
  "painel pisca",
  "painel pisca ao dar partida",
  "painel fica piscando",
  "luz do painel pisca",
  "quando viro a chave fica fraco",
  "ao virar a chave fica fraco",
  "faz tec tec",
  "tec tec",
  "nao esta ligando",
  "nao esta liga",
  "nao liga",
  "nao quer ligar",
  "nao pega",
  "descarregou",
  "vive descarregando",
  "sempre descarrega",
  "descarregando",
  "bateria arriou",
  "bateria morreu",
  "sem partida",
  "falha na partida",
  "partida fraca",
  "motor gira fraco",
  "painel acende mas nao liga",
  "carro parado",
  "morreu"
];

const mencoesGenericasProblema = [
  "estou com problema",
  "estou com um problema",
  "meu carro esta com problema",
  "minha moto esta com problema",
  "tenho um problema",
  "tenho problema",
  "deu problema",
  "esta com problema",
  "ta com problema",
  "com problema",
  "com problema no",
  "com problema na",
  "problema no veiculo",
  "problema no carro",
  "problema na moto",
  "problema no caminhao"
];

const palavrasUrgencia = ["urgente", "hoje", "agora", "socorro", "parado"];

export class InputValidationService {
  validar(cliente: ClienteRequest, semanticAnalysis?: SemanticProblemAnalysis): InputValidationResultado {
    const mensagem = cliente.mensagem ?? "";
    const tokens = tokenize(mensagem);
    const mensagemNormalizada = normalizeText(mensagem);
    const extracted = this.extrairInformacoes(cliente);
    const semanticHasProblem = Boolean(semanticAnalysis && semanticAnalysis.category !== "desconhecido");
    const hasVehicle = Boolean(cliente.veiculo?.trim() || extracted.veiculo);
    const hasDomainKeyword = this.temContextoAutomotivo(mensagem, extracted) || semanticHasProblem;
    const hasProblemDescription = extracted.hasSpecificSymptom || semanticHasProblem;
    const hasValidBudget = Number(cliente.orcamentoMaximo) > 0 || extracted.orcamento !== null;
    const hasClearUrgency = extracted.urgencia === "alta";
    const inputConfidence = this.calcularConfianca({
      hasVehicle,
      hasProblemDescription,
      hasDomainKeyword,
      hasClearUrgency,
      hasValidBudget,
      extracted
    });
    const isGenericSingleWord = tokens.length <= 1 && palavrasGenericas.has(mensagemNormalizada);

    if (extracted.isTruckWithoutDetails) {
      return this.criarResultadoInvalido(
        "NEED_MORE_DETAILS",
        "Para recomendar uma bateria de caminhão com segurança, informe o modelo do caminhão, a tensão do sistema e o problema apresentado.",
        "Caminhão informado sem modelo, tensão e problema",
        ["modelo", "problema", "tensao"],
        30,
        "Qual é o modelo do caminhão e ele usa sistema 12V ou 24V? Exemplo: 'Tenho um caminhão 24V que não está ligando'.",
        extracted,
        { hasVehicle, hasDomainKeyword, hasProblemDescription, hasValidBudget, hasClearUrgency }
      );
    }

    if (isGenericSingleWord || tokens.length < 2 || !hasDomainKeyword) {
      return this.criarResultadoInvalido(
        "INSUFFICIENT_INFORMATION",
        "Não consegui identificar uma necessidade relacionada a bateria automotiva.",
        "Mensagem muito curta ou fora do contexto",
        this.identificarCamposFaltantes(extracted),
        inputConfidence,
        "Informe o modelo do veículo e descreva o problema. Exemplo: 'Meu Gol 1.0 não liga e preciso trocar a bateria hoje'.",
        extracted,
        { hasVehicle, hasDomainKeyword, hasProblemDescription, hasValidBudget, hasClearUrgency }
      );
    }

    if (semanticHasProblem && (!extracted.veiculo || extracted.isGenericVehicle)) {
      return this.criarResultadoInvalido(
        "MISSING_VEHICLE",
        this.criarMensagemModeloFaltantePorSemantica(semanticAnalysis),
        "Interpretação semântica suficiente, mas veículo sem modelo específico",
        ["modelo"],
        inputConfidence,
        this.criarMensagemModeloFaltantePorSemantica(semanticAnalysis),
        extracted,
        { hasVehicle, hasDomainKeyword, hasProblemDescription, hasValidBudget, hasClearUrgency }
      );
    }

    if (extracted.isGenericVehicle && !extracted.hasSpecificSymptom && !semanticHasProblem && extracted.hasGenericProblemMention) {
      return this.criarResultadoInvalido(
        "NEED_VEHICLE_MODEL_AND_SYMPTOM",
        this.criarMensagemModeloESintoma(extracted),
        "Menção genérica de problema sem modelo e sem sintoma",
        this.identificarCamposFaltantes(extracted),
        inputConfidence,
        "Certo, é um carro. Para eu ajudar melhor, informe o modelo do veículo e o que está acontecendo. Exemplo: 'Meu Onix 2020 não liga' ou 'Meu Gol 1.0 não acende nada'.",
        extracted,
        { hasVehicle, hasDomainKeyword, hasProblemDescription, hasValidBudget, hasClearUrgency }
      );
    }

    if (extracted.isGenericVehicle) {
      return this.criarResultadoInvalido(
        "MISSING_VEHICLE",
        this.criarMensagemModeloFaltante(extracted),
        "Veículo genérico informado sem modelo específico",
        ["modelo"],
        inputConfidence,
        "Qual é o modelo do veículo? Exemplo: 'Meu Gol 1.0 não liga'.",
        extracted,
        { hasVehicle, hasDomainKeyword, hasProblemDescription, hasValidBudget, hasClearUrgency }
      );
    }

    if (!extracted.hasSpecificSymptom && !semanticHasProblem && !this.temIntencaoClaraDeCompra(extracted)) {
      return this.criarResultadoInvalido(
        "NEED_MORE_DETAILS",
        this.criarMensagemSintomaFaltante(extracted),
        extracted.hasGenericProblemMention
          ? "Menção genérica de problema sem sintoma descrito"
          : "Veículo informado sem sintoma ou intenção clara de compra",
        ["descricaoProblema"],
        inputConfidence,
        "Informe o que está acontecendo. Exemplo: 'não liga', 'não acende nada', 'painel pisca' ou 'partida fraca'.",
        extracted,
        { hasVehicle, hasDomainKeyword, hasProblemDescription, hasValidBudget, hasClearUrgency }
      );
    }

    if (inputConfidence < 50) {
      return this.criarResultadoInvalido(
        "INSUFFICIENT_INFORMATION",
        "Não consegui recomendar uma bateria ainda.",
        "Informações insuficientes para recomendação segura",
        this.identificarCamposFaltantes(extracted),
        inputConfidence,
        "Informe o modelo do veículo e descreva o problema. Exemplo: 'Meu Gol 1.0 não liga e preciso trocar a bateria hoje'.",
        extracted,
        { hasVehicle, hasDomainKeyword, hasProblemDescription, hasValidBudget, hasClearUrgency }
      );
    }

    return {
      isValid: true,
      missingFields: [],
      inputConfidence,
      extracted,
      hasVehicle,
      hasDomainKeyword,
      hasProblemDescription,
      hasValidBudget,
      hasClearUrgency
    };
  }

  private extrairInformacoes(cliente: ClienteRequest): InputExtraction {
    const mensagem = cliente.mensagem ?? "";
    const texto = normalizeText(mensagem);
    const ano = this.extrairAno(texto);
    const symptomDescription = this.extrairProblema(texto);
    const hasSpecificSymptom = Boolean(symptomDescription);
    const hasGenericProblemMention = this.temMencaoGenericaProblema(texto);
    const problema = symptomDescription;
    const veiculoDoCampo = cliente.veiculo?.trim() || null;
    const veiculoExtraido = veiculoDoCampo || this.extrairVeiculo(texto, ano);
    const tipoVeiculo = this.extrairTipoVeiculo(texto, veiculoExtraido);
    const orcamento = this.extrairOrcamento(texto);
    const urgencia = this.extrairUrgencia(texto, cliente.urgenciaInformada, problema);
    const intencao = this.extrairIntencao(texto, problema);
    const veiculoNormalizado = normalizeText(veiculoExtraido ?? "");
    const isGenericVehicle = Boolean(veiculoExtraido && veiculosGenericos.includes(veiculoNormalizado));
    const isTruckWithoutDetails =
      tipoVeiculo === "caminhao" &&
      (!includesNormalized(veiculoExtraido ?? mensagem, "24v") && !includesNormalized(veiculoExtraido ?? mensagem, "12v")) &&
      (!problema || isGenericVehicle);

    return {
      veiculo: veiculoExtraido,
      ano,
      tipoVeiculo,
      problema,
      symptomDescription,
      hasGenericProblemMention,
      hasSpecificSymptom,
      intencao,
      orcamento,
      urgencia,
      isGenericVehicle,
      isTruckWithoutDetails
    };
  }

  private extrairVeiculo(texto: string, ano: number | null): string | null {
    if (includesNormalized(texto, "caminhao 24v")) return "Caminhão 24V";
    if (includesNormalized(texto, "caminhao 12v")) return "Caminhão 12V";
    const modeloMoto = modelosMoto.find((item) => includesNormalized(texto, item));
    if (modeloMoto) return this.formatarModelo(modeloMoto);
    if (/\bmoto\b/.test(texto)) return "Moto";

    const modelosCarro = this.isPoloTerminalContext(texto)
      ? modelosConhecidos.filter((item) => item !== "polo")
      : modelosConhecidos;
    const modelo =
      modelosCarro.find((item) => new RegExp(`\\b${item}\\b`).test(texto)) ??
      this.extrairModeloPorAlias(texto);

    if (modelo) {
      const motorMatch = texto.match(new RegExp(`\\b${modelo}\\b\\s*(\\d\\s\\d|\\d\\.\\d|\\d{3,4})?`));
      const detalhe = motorMatch?.[1];
      const nomeModelo = this.formatarModelo(modelo);
      const detalheNormalizado = detalhe?.replace(/\s+/, ".");

      if (detalheNormalizado && detalheNormalizado.length <= 3) {
        return `${nomeModelo} ${detalheNormalizado}`;
      }

      if (ano) {
        return `${nomeModelo} ${ano}`;
      }

      return nomeModelo;
    }

    if (/\bcaminhao\b/.test(texto)) return "Caminhão";
    if (/\bcarro\b/.test(texto)) return "Carro";
    if (/\bveiculo\b/.test(texto)) return "Veículo";
    if (/\bautomovel\b/.test(texto)) return "Automóvel";

    return null;
  }

  private extrairAno(texto: string): number | null {
    const match = texto.match(/\b(19[8-9]\d|20[0-3]\d)\b/);
    return match ? Number(match[1]) : null;
  }

  private extrairProblema(texto: string): string | null {
    return problemasConhecidos.find((problema) => includesNormalized(texto, problema)) ?? null;
  }

  private temMencaoGenericaProblema(texto: string): boolean {
    return mencoesGenericasProblema.some((expressao) => includesNormalized(texto, expressao));
  }

  private extrairOrcamento(texto: string): number | null {
    const matches = [
      ...texto.matchAll(/(?:ate|r\$|rs|orcamento|valor|preco)\s*(?:de|em|ate)?\s*(\d{2,5})(?:\s*reais)?/g),
      ...texto.matchAll(/\b(\d{2,5})\s*reais\b/g)
    ];
    const match = matches.find((item) => {
      const valor = Number(item[1]);
      return valor < 1980 || valor > 2035;
    });

    return match ? Number(match[1]) : null;
  }

  private extrairUrgencia(
    texto: string,
    urgenciaInformada: UrgenciaInformada,
    problema: string | null
  ): UrgenciaInformada {
    if (palavrasUrgencia.some((palavra) => includesNormalized(texto, palavra))) return "alta";
    if (problema) return urgenciaInformada === "alta" ? "alta" : "media";
    return urgenciaInformada;
  }

  private extrairIntencao(
    texto: string,
    problema: string | null
  ): InputExtraction["intencao"] {
    if (problema) return "diagnostico";
    if (includesNormalized(texto, "orcamento") || includesNormalized(texto, "valor") || includesNormalized(texto, "preco")) return "orcamento";
    if (includesNormalized(texto, "trocar") || includesNormalized(texto, "troca")) return "troca";
    if (includesNormalized(texto, "bateria")) return "compra";
    if (includesNormalized(texto, "atendimento")) return "atendimento";
    return null;
  }

  private extrairTipoVeiculo(texto: string, veiculo: string | null): InputExtraction["tipoVeiculo"] {
    const base = normalizeText(`${texto} ${veiculo ?? ""}`);

    if (includesNormalized(base, "caminhao")) return "caminhao";
    if (includesNormalized(base, "moto")) return "moto";
    if (veiculo || includesNormalized(base, "carro") || includesNormalized(base, "veiculo")) return "carro";

    return null;
  }

  private temContextoAutomotivo(mensagem: string, extracted: InputExtraction): boolean {
    return Boolean(
      extracted.veiculo ||
        extracted.problema ||
        extracted.intencao ||
        palavrasContexto.some((palavra) => includesNormalized(mensagem, palavra))
    );
  }

  private calcularConfianca(criterios: {
    hasVehicle: boolean;
    hasProblemDescription: boolean;
    hasDomainKeyword: boolean;
    hasClearUrgency: boolean;
    hasValidBudget: boolean;
    extracted: InputExtraction;
  }): number {
    return (
      (criterios.hasVehicle ? 30 : 0) +
      (criterios.hasProblemDescription ? 30 : 0) +
      (criterios.hasDomainKeyword ? 20 : 0) +
      (criterios.hasClearUrgency ? 10 : 0) +
      (criterios.hasValidBudget ? 10 : 0)
    );
  }

  private identificarCamposFaltantes(extracted: InputExtraction): string[] {
    const missingFields: string[] = [];

    if (!extracted.veiculo || extracted.isGenericVehicle) {
      missingFields.push("veiculo");
    }

    if (!extracted.hasSpecificSymptom && !this.temIntencaoClaraDeCompra(extracted)) {
      missingFields.push("descricaoProblema");
    }

    return missingFields;
  }

  private temIntencaoClaraDeCompra(extracted: InputExtraction): boolean {
    return ["compra", "orcamento", "troca"].includes(extracted.intencao ?? "");
  }

  private criarMensagemModeloESintoma(extracted: InputExtraction): string {
    if (extracted.tipoVeiculo === "caminhao") {
      return "Entendi que há um problema no caminhão, mas preciso do modelo, da tensão 12V/24V e do sintoma. O painel acende? A partida está fraca? Faz 'tec tec'? Ou não acende nada?";
    }

    if (extracted.tipoVeiculo === "moto") {
      return "Entendi que há um problema na moto, mas preciso do modelo/cilindrada e do sintoma. O painel acende? A partida está fraca? Faz 'tec tec'? Ou não acende nada?";
    }

    return "Entendi que há um problema no carro, mas preciso do modelo e do sintoma. O painel acende? A partida está fraca? Faz 'tec tec'? Ou não acende nada?";
  }

  private criarMensagemModeloFaltante(extracted: InputExtraction): string {
    const tipoVeiculo = this.descreverTipoVeiculo(extracted);
    const symptomDescription = extracted.symptomDescription
      ? this.formatarSintoma(extracted.symptomDescription)
      : null;

    if (symptomDescription) {
      return `Entendi que o ${tipoVeiculo} ${symptomDescription}, mas preciso do modelo do veículo para recomendar a bateria correta.`;
    }

    return "Entendi que há um problema no veículo, mas ainda preciso saber o modelo e o sintoma apresentado.";
  }

  private criarMensagemSintomaFaltante(extracted: InputExtraction): string {
    if (extracted.veiculo && !extracted.isGenericVehicle) {
      return `Entendi que o veículo é um ${extracted.veiculo}, mas preciso saber o que está acontecendo. Ele não liga, não acende nada, o painel pisca ou a partida está fraca?`;
    }

    return "Entendi que há um problema no veículo, mas ainda preciso saber o modelo e o sintoma apresentado.";
  }

  private criarMensagemModeloFaltantePorSemantica(semanticAnalysis?: SemanticProblemAnalysis): string {
    if (semanticAnalysis?.category === "intencao_compra_bateria") {
      return "Qual é o modelo do carro para eu indicar a bateria correta?";
    }

    if (semanticAnalysis?.category === "bateria_ausente") {
      return "Entendi que o veículo está sem bateria. Qual é o modelo do veículo para eu indicar a bateria correta?";
    }

    if (semanticAnalysis?.category === "bateria_explodiu") {
      return "Entendi que houve um problema grave com a bateria. Por segurança, não tente ligar o veículo. Qual é o modelo do veículo para eu indicar uma substituição compatível?";
    }

    if (semanticAnalysis?.category === "vazamento_acido") {
      return "Pode ser vazamento de ácido da bateria. Evite contato com o líquido. Qual é o modelo do veículo para eu indicar a bateria correta?";
    }

    if (semanticAnalysis?.category === "polo_danificado") {
      return "Entendi que pode haver problema nos polos ou terminais. Recomendo verificar os cabos e terminais antes de trocar a bateria. Qual é o modelo do veículo para eu orientar a inspeção corretamente?";
    }

    return "Entendi o problema informado. Qual é o modelo do veículo para eu indicar a bateria correta?";
  }

  private descreverTipoVeiculo(extracted: InputExtraction): string {
    if (extracted.tipoVeiculo === "moto") return "moto";
    if (extracted.tipoVeiculo === "caminhao") return "caminhao";
    return "carro";
  }

  private formatarSintoma(symptomDescription: string): string {
    const nomes: Record<string, string> = {
      "nao liga": "não liga",
      "nao acende nada": "não acende nada",
      "nao pega": "não pega",
      "nao quer ligar": "não quer ligar",
      "nao esta ligando": "não está ligando",
      "partida fraca": "partida fraca",
      "painel pisca": "painel pisca",
      "motor gira fraco": "motor gira fraco",
      "sem energia": "sem energia",
      "bateria arriou": "bateria arriou",
      "descarregou": "descarregou"
    };

    return nomes[symptomDescription] ?? symptomDescription;
  }

  private criarResultadoInvalido(
    type: InputValidationResultado["type"],
    message: string,
    reason: string,
    missingFields: string[],
    inputConfidence: number,
    suggestedQuestion: string,
    extracted: InputExtraction,
    flags: Pick<
      InputValidationResultado,
      "hasVehicle" | "hasDomainKeyword" | "hasProblemDescription" | "hasValidBudget" | "hasClearUrgency"
    >
  ): InputValidationResultado {
    return {
      isValid: false,
      type,
      message,
      reason,
      missingFields,
      suggestedQuestion,
      inputConfidence,
      extracted,
      ...flags
    };
  }

  private formatarModelo(modelo: string): string {
    const nomes: Record<string, string> = {
      hb20: "HB20",
      s10: "S10",
      ka: "Ka",
      chevette: "Chevette"
    };

    return nomes[modelo] ?? modelo.charAt(0).toUpperCase() + modelo.slice(1);
  }

  private extrairModeloPorAlias(texto: string): string | null {
    const tokens = texto.split(" ");
    const alias = tokens.find((token) => aliasesModelos[token]);

    return alias ? aliasesModelos[alias] : null;
  }

  private isPoloTerminalContext(texto: string): boolean {
    return (
      includesNormalized(texto, "polo derreteu") ||
      includesNormalized(texto, "polo queimou") ||
      includesNormalized(texto, "polo oxidado") ||
      includesNormalized(texto, "polo com zinabre")
    );
  }
}

export const inputValidationService = new InputValidationService();
