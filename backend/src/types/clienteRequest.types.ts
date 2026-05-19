export type PreferenciaCliente = "economia" | "custo-beneficio" | "qualidade";
export type UrgenciaInformada = "baixa" | "media" | "alta";

export interface ClienteRequest {
  conversationId?: string;
  nomeCliente: string;
  mensagem: string;
  veiculo: string;
  orcamentoMaximo: number;
  preferencia: PreferenciaCliente;
  urgenciaInformada: UrgenciaInformada;
}
