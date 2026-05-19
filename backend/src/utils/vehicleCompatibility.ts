import { normalizeText } from "./textPreprocessing.js";

const termosGenericos = new Set(["carro", "veiculo", "automovel", "moto", "caminhao"]);

function tokenizarVeiculo(veiculo: string): string[] {
  return normalizeText(veiculo)
    .split(" ")
    .filter((token) => token.length > 1);
}

export function isVehicleCompatible(inputVehicle: string, productApplications: string[]): boolean {
  const inputNormalizado = normalizeText(inputVehicle);
  const inputTokens = tokenizarVeiculo(inputVehicle).filter((token) => !termosGenericos.has(token));

  if (!inputNormalizado || inputTokens.length === 0) {
    return false;
  }

  return productApplications.some((application) => {
    const applicationNormalizada = normalizeText(application);
    const applicationTokens = tokenizarVeiculo(application).filter((token) => !termosGenericos.has(token));

    if (!applicationNormalizada || applicationTokens.length === 0) {
      return false;
    }

    if (inputNormalizado === applicationNormalizada) {
      return true;
    }

    if (inputNormalizado.includes(applicationNormalizada) || applicationNormalizada.includes(inputNormalizado)) {
      return applicationNormalizada.length >= 3 && inputNormalizado.length >= 3;
    }

    const tokensEmComum = applicationTokens.filter((token) => inputTokens.includes(token));
    const temModeloEmComum = tokensEmComum.some((token) => token.length >= 3 || /\d/.test(token));
    const exigeTensaoCaminhao =
      applicationNormalizada.includes("caminhao") || inputNormalizado.includes("caminhao");

    if (exigeTensaoCaminhao) {
      return (
        temModeloEmComum &&
        ((applicationNormalizada.includes("24v") && inputNormalizado.includes("24v")) ||
          (applicationNormalizada.includes("12v") && inputNormalizado.includes("12v")))
      );
    }

    return temModeloEmComum;
  });
}
