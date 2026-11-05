# @ose-foundry-core/types

TypeScript types for the [Old-School Essentials
(OSE)](https://github.com/NecroticGnome/ose-foundry-core) Foundry VTT system.

This package is intentionally minimal in its initial release. It re-exports
**only the types that are already explicitly declared in OSE's TypeScript
source** — config unions, the character helper-class interfaces, the item
data shapes, and the character class definitions. The shipped surface grows automatically as the
system's remaining `.js` data models are converted to `.ts`.

The package ships a single declaration-only entrypoint (`index.d.ts`). It
contains **no runtime code**.

## Install

```sh
npm i -D @ose-foundry-core/types
# or pnpm add -D @ose-foundry-core/types
```

### Required peer

This package needs `@league-of-foundry-developers/foundry-vtt-types` (Foundry's  
type definitions) to be present. On npm 7+ and pnpm 8+ it installs  
automatically — you don't need to do anything extra.

## What's exported

As of 30 October 2026:


| Group                                                                             | Types                                                                                                                                            |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Config unions** (from `src/module/config.ts`)                                   | `OseConfig`, `Save`, `Armor`, `Attribute`, `ExplorationSkill`, `RollType`, `Color`, `InventoryItemTag`, `InventoryItemTagValue`, `EncumbranceOption`, `ApplyDamageOption` |
| **Character helper interfaces** (from `src/module/actor/data-model-classes/*.ts`) | `CharacterScores`, `CharacterAC`, `CharacterMove`, `CharacterEncumbrance`, `CharacterSpells`, `ExplorationSkills` (from `src/module/actor/exploration-skills`) |
| **Item data** (from `src/module/item/item-types.ts`) | `WeaponItemData`, `ArmorItemData`, `ArmorType`, `SpellItemData`, `AbilityItemData`, `ContainerItemData`, `MiscItemData`, `PhysicalItemData`, `NonPhysicalItemData`, `CarriedItem`, `ItemTag`, `DisplayTag`, `ClassItemData`, `RaceItemData`, `ClassLimit`, `ClassAccess` |
| **Class and race rules** (from `src/module/classes/*.ts`) | `PrimeReq`, `ClassLevelRow`, `SaveKey`, `ClassTable`, `ScoreRequirements`, `ScoreBounds`, `RaceSaveBonus`, `OwnedAbility`, `ClassLike`, `Derived`, `Finals`, `ClassStats`, `StatChange` |
| **Classes** (from `src/types/classes.ts`)                                         | `ClassicClassName`, `OseClass`                                                                                                                   |


## Usage

```ts
import type { Save, CharacterScores, ClassicClassName } from "@ose-foundry-core/types";

function rollSave(scoreType: Save) { /* … */ }

const klass: ClassicClassName = "Magic-User";   // ✓
// const bad: ClassicClassName = "Sorcerer";    // ✗ type error
```

## Roadmap

As the system migrates its `.js` data models to `.ts`, the explicit type
definitions in those files become eligible for re-export here. Likely future
additions, in roughly the order they'd land:

- `CharacterSystemData` / `MonsterSystemData` (and their `*Source` variants) —
when the actor data models migrate
- Document-level convenience types (e.g. `OseCharacter = Actor & { type: "character"; … }`) — once the system data shapes are available to compose with

## Maintenance

`index.d.ts` is **generated** — do not edit it. It is produced from  
`src/types/` in the system repo via `npm run build:types` (a declaration-only  
`tsc` pass bundled with `rollup-plugin-dts`).

## Releasing

Bump `version` in `packages/types/package.json`. The workflow automatically warns when
the built types differ from the published version and the version wasn't bumped.

Publishing a GitHub release runs the Publish Types workflow, which publishes the
package if that version isn't on npm yet. 

To publish manually instead, run `npm run release:types` from the repo root — it
rebuilds `index.d.ts` and publishes the package to npm. Publishing by hand
needs an npm account with publish rights to the `@ose-foundry-core` scope (the
scope/org must already exist on npm). Run `npm login` first, then the release
script.

The package sets `publishConfig.access: public`, so the first publish creates
the scoped package as public — no extra flags needed.
