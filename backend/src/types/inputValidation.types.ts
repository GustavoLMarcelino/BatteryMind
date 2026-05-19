import { UrgenciaInformada } from "./clienteRequest.types.js";

export type InputValidationErrorType =
  | "INSUFFICIENT_INFORMATION"
  | "MISSING_VEHICLE"
  | "NEED_VEHICLE_MODEL_AND_SYMPTOM"
  | "NEED_MORE_DETAILS"
  | "NEED_MOTO_MODEL"
  | "NO_COMPATIBLE_PRODUCT";

export interface InputExtraction {
  veiculo: string | null;
  ano: number | null;
  tipoVeiculo: "carro" | "moto" | "caminhao" | null;
  problema: string | null;
  symptomDescription: string | null;
  hasGenericProblemMention: boolean;
  hasSpecificSymptom: boolean;
  intencao: "compra" | "orcamento" | "troca" | "atendimento" | "diagnostico" | null;
  orcamento: number | null;
  urgencia: UrgenciaInformada;
  isGenericVehicle: boolean;
  isTruckWithoutDetails: boolean;
}

export interface InputValidationResultado {
  isValid: boolean;
  reason?: string;
  missingFields: string[];
  suggestedQuestion?: string;
  inputConfidence: number;
  extracted: InputExtraction;
  hasVehicle: boolean;
  hasDomainKeyword: boolean;
  hasProblemDescription: boolean;
  hasValidBudget: boolean;
  hasClearUrgency: boolean;
  type?: InputValidationErrorType;
  message?: string;
}
