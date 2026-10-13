/**
 * @file Finds the abilities a class or race granted to a character.
 */
export interface Grant {
  type: string;
  key: string;
}

export interface OwnedGrant {
  id: string;
  name: string;
  requirements: string;
  source: string;
  grantedBy?: Grant;
}

export interface GrantingItem {
  type: string;
  system: { key: string };
  // The item's linked abilities, resolved by the caller.
  links: { uuid: string; name: string; requirements: string }[];
}

const same = (a: string, b: string) => (a ?? "").toLocaleLowerCase().trim() === (b ?? "").toLocaleLowerCase().trim();

// Tagged by this item.
export const abilitiesGrantedBy = (item: GrantingItem, owned: OwnedGrant[]) =>
  owned
    .filter((o) => {
      if (o.grantedBy) return o.grantedBy.type === item.type && o.grantedBy.key === item.system.key;
      return item.links.some(
        (l) => (o.source && o.source === l.uuid) || (same(o.name, l.name) && same(o.requirements, l.requirements)),
      );
    })
    .map((o) => o.id);
