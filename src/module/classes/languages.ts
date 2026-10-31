/**
 * @file Merges the languages a class or race grants into a character's list.
 */
const ALIGNMENT = "Alignment";

export const mergeLanguages = (known: string[], granted: string[], alignment = ""): string[] => {
  const out = [...known];
  for (const raw of granted) {
    const name = raw === ALIGNMENT && alignment ? alignment : raw;
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
};
