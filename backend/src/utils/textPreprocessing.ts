const stopWords = new Set([
  "a",
  "o",
  "as",
  "os",
  "um",
  "uma",
  "uns",
  "umas",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "para",
  "por",
  "com",
  "que",
  "qual",
  "quanto",
  "quanta",
  "meu",
  "minha",
  "seu",
  "sua",
  "eu",
  "voce",
  "voces",
  "isso",
  "esse",
  "essa",
  "esta",
  "estao",
  "estou",
  "foi",
  "tem",
  "têm",
  "mas"
]);

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(" ")
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

export function includesNormalized(text: string, expression: string): boolean {
  return normalizeText(text).includes(normalizeText(expression));
}
