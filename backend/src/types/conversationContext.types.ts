import { PreferenciaCliente, UrgenciaInformada } from "./clienteRequest.types.js";

export type TipoVeiculoContexto = "carro" | "caminhao" | "moto" | "desconhecido";
export type TensaoVeiculo = "12V" | "24V";
export type LastQuestionType = "vehicle_model" | "truck_voltage" | "symptom_detail" | "budget" | "unknown";

export type ConversationContext = {
  conversationId: string;
  nomeCliente?: string;
  mensagens: string[];
  veiculo?: string;
  tipoVeiculo?: TipoVeiculoContexto;
  modelo?: string;
  ano?: string;
  tensao?: TensaoVeiculo;
  problema?: string;
  symptom?: string;
  genericProblemMention?: boolean;
  orcamentoMaximo?: number;
  preferencia?: PreferenciaCliente;
  urgencia?: UrgenciaInformada;
  lastQuestionType?: LastQuestionType;
  updatedAt: Date;
};
