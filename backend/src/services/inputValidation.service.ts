import { ClienteRequest, UrgenciaInformada } from "../types/clienteRequest.types.js";
import {
  InputExtraction,
  InputValidationResultado
} from "../types/inputValidation.types.js";
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
  "amarok"
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
  onxi: "onix"
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
  "problema",
  "nao acende nada",
  "painel nao acende",
  "nao liga nada",
  "sem energia",
  "nao esta ligando",
  "nao esta liga",
  "nao liga",
  "nao quer ligar",
  "descarregou",
  "descarregando",
  "bateria arriou",
  "bateria morreu",
  "sem partida",
  "falha na partida",
  "partida fraca",
  "painel acende mas nao liga",
  "carro parado",
  "morreu",
  "nao pega"
];

const palavrasUrgencia = ["urgente", "hoje", "agora", "socorro", "parado"];

export class InputValidationService {
  validar(cliente: ClienteRequest): InputValidationResultado {
    const mensagem = cliente.mensagem ?? "";
    const tokens = tokenize(mensagem);
    const mensagemNormalizada = normalizeText(mensagem);
    const extracted = this.extrairInformacoes(cliente);
    const hasVehicle = Boolean(cliente.veiculo?.trim() || extracted.veiculo);
    const hasDomainKeyword = this.temContextoAutomotivo(mensagem, extracted);
    const hasProblemDescription = Boolean(extracted.problema);
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

    if (extracted.isGenericVehicle) {
      return this.criarResultadoInvalido(
        "MISSING_VEHICLE",
        "Entendi o problema, mas preciso do modelo do veículo para recomendar a bateria correta.",
        "Veículo genérico informado sem modelo específico",
        ["modelo"],
        inputConfidence,
        "Qual é o modelo do veículo? Exemplo: 'Meu Gol 1.0 não liga'.",
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
    const problema = this.extrairProblema(texto);
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

    const modelo =
      modelosConhecidos.find((item) => new RegExp(`\\b${item}\\b`).test(texto)) ??
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

    if (!extracted.problema && extracted.intencao !== "orcamento") {
      missingFields.push("descricaoProblema");
    }

    return missingFields;
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
      ka: "Ka"
    };

    return nomes[modelo] ?? modelo.charAt(0).toUpperCase() + modelo.slice(1);
  }

  private extrairModeloPorAlias(texto: string): string | null {
    const tokens = texto.split(" ");
    const alias = tokens.find((token) => aliasesModelos[token]);

    return alias ? aliasesModelos[alias] : null;
  }
}

export const inputValidationService = new InputValidationService();
