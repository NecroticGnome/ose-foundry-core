/**
 * @file Decides whether a character already has an ability a class or race grants.
 */
export interface OwnedAbility {
  name: string;
  requirements: string;
  source: string;
}

const key = (name: string, requirements: string) => `${name}|${requirements}`.toLocaleLowerCase().trim();

// Same compendium source, or same name for the same class.
export const isAbilityOwned = (
  owned: OwnedAbility[],
  candidate: { name: string; requirements: string; uuid: string },
) =>
  owned.some(
    (o) =>
      (o.source && o.source === candidate.uuid) ||
      key(o.name, o.requirements) === key(candidate.name, candidate.requirements),
  );

// Ability links default to level order.
export const sortByLevel = <T extends { level: number }>(links: T[]): T[] =>
  links
    .map((link, i) => ({ link, i }))
    .sort((a, b) => a.link.level - b.link.level || a.i - b.i)
    .map(({ link }) => link);

export const insertByLevel = <T extends { level: number }>(links: T[], link: T): T[] => {
  const after = links.findLastIndex((l) => l.level <= link.level);
  return [...links.slice(0, after + 1), link, ...links.slice(after + 1)];
};
