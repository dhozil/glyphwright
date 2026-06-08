# Glyphwright — GenLayer Intelligent Contract

This directory holds the on-chain port of the Glyphwright game logic.

| File | Purpose |
|---|---|
| `glyphwright.py` | The full Intelligent Contract: 5-validator forge council, grimoire (NFT-like), `$GLY` balances + faucet, and marketplace. |

It mirrors, 1:1, the TypeScript simulation in:

- `src/lib/glyphwright.functions.ts` — forge + 5-validator council
- `src/lib/grimoire.ts`              — per-wallet spell storage
- `src/lib/marketplace.ts`           — listings, buy/sell, `$GLY` balance + faucet

## Public methods

### Reads (free)
- `balance_of(owner: str) -> int`
- `get_spell(spell_id: str) -> dict`
- `get_spells_by_owner(owner: str) -> list[dict]`
- `get_active_listings() -> list[dict]`
- `get_listing(listing_id: str) -> dict`

### Writes (consensus)
- `forge_spell(intent: str) -> dict` — runs the 5-validator council via
  `gl.eq_principle.prompt_comparative`; on ≥60% approval, mints the spell
  into the caller's grimoire. Returns the full receipt
  `{ spell_id, owner, spellName, incantation, description, votes[], consensus }`,
  so the frontend never needs a follow-up read after the tx finalizes.
- `claim_faucet() -> int` — +250 `$GLY` for the caller; returns new balance.
- `list_spell(spell_id, price) -> str` — returns the new listing id.
- `delist_spell(listing_id)`
- `buy_listing(listing_id)` — transfers `$GLY` and spell ownership atomically.

All errors are raised with `gl.vm.UserError(...)` so they surface cleanly
through `genlayer-js` as `UserError` rejections rather than generic VM
exceptions.

## Deploy

```bash
# Studionet (chainId 61999 / 0xF23F, https://studio.genlayer.com)
genlayer network studionet
genlayer deploy --contract contracts/glyphwright.py
```

Take the returned contract address and expose it to the frontend, e.g.:

```bash
# .env
VITE_GLYPHWRIGHT_CONTRACT=0x...
```

## Wiring it from the frontend

Once deployed, replace the localStorage layer with `genlayer-js` calls:

```ts
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const client = createClient({ chain: studionet, account: createAccount() });

// forge
const tx = await client.writeContract({
  address: import.meta.env.VITE_GLYPHWRIGHT_CONTRACT,
  functionName: "forge_spell",
  args: [intent],
});
const receipt = await client.waitForTransactionReceipt({ hash: tx, status: "FINALIZED" });

// read grimoire
const spells = await client.readContract({
  address: import.meta.env.VITE_GLYPHWRIGHT_CONTRACT,
  functionName: "get_spells_by_owner",
  args: [address],
});
```

Drop-in replacements per file:

| Current (simulation) | Replace with |
|---|---|
| `forgeSpell` (server fn) | `writeContract("forge_spell", [intent])` |
| `saveSpell` | nothing — `forge_spell` mints on approval |
| `loadGrimoire(addr)` | `readContract("get_spells_by_owner", [addr])` |
| `loadListings()` | `readContract("get_active_listings")` |
| `listSpell` / `delistSpell` / `buyListing` | matching contract writes |
| `getBalance` / `claimFaucet` | `balance_of` / `claim_faucet` |

## Consensus model

Each LLM call inside `forge_spell` is wrapped in
`gl.eq_principle.prompt_comparative` so the validator network reaches
agreement on what is otherwise non-deterministic LLM output. `strict_eq`
is intentionally **not** used for the LLM rounds — different validators
may run different models, so byte-identical output is not realistic.

Two equivalence principles are used:

1. **Identity** — validators must agree the generated `spellName`,
   `incantation`, and `description` describe the same magical effect and
   stay faithful to the player's intent.
2. **Vote** — for a given persona, validators must agree on the boolean
   `approve`, `element`, and `rarity`; `power` and `mana_cost` may differ
   by up to 15 points; `reasoning` must make the same overall point.

The final aggregate (averaged stats, mode-voted element/rarity, approval
ratio, FORGED/REJECTED verdict) is computed **deterministically in
contract code after** all nondet rounds settle, so the receipt is fully
reproducible from the agreed-upon prompt outputs. Storage writes
(minting, grimoire append, listing changes) only happen *after* every
equivalence-principle round has reached consensus, in line with
GenLayer's rule that side effects must live outside non-deterministic
blocks.

## Timestamps

`forged_at` and `listed_at` are populated from
`datetime.now(timezone.utc).timestamp()`. GenVM wires the Python clock
to the transaction's datetime, so all validators observe the same value
and the timestamp is reproducible from the receipt.
