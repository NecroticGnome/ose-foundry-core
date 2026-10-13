/**
 * @file Class/race name normalisation for matching free text to items.
 */
export const normaliseName = (name: string) =>
  (name ?? "")
    .toLocaleLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]/gu, "");

export const toKey = (name: string) =>
  (name ?? "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");

export const isCombinedClassText = (text: string) => /[/&+,]/.test(text ?? "");
