// Re-exports kept for backwards compatibility with existing imports.
// The real on-chain spell type lives in `glyphwright.contract.ts`.

export type { Spell as GrimoireEntry } from "./glyphwright.contract";
export { getSpellsByOwner as loadGrimoire } from "./glyphwright.contract";
