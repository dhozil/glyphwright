# Glyphwright

> Forge spells in plain language. Five AI validators argue and vote. Inscribe winners to your on-chain grimoire and trade them on the open market — powered by **GenLayer** Optimistic Democracy.

Glyphwright is an arcane crafting game built on top of [GenLayer](https://genlayer.com)'s two unique primitives:

1. **Intelligent Contracts** — smart contracts that call LLMs natively
2. **Optimistic Democracy** — many LLM validators reach consensus on non-deterministic outputs

Players write the *intent* of a spell ("a whisper that makes someone forget the last sentence they spoke"). A council of 5 validator personas — Pyromancer Ignis, Verdant Sage Liora, Voidcaller Nyx, Runesmith Borr, and Oracle Sephielle — judges power, mana, element, rarity, and whether to approve it. If ≥60% approve, the spell is **FORGED** and minted into the player's on-chain grimoire as a tradeable glyph.

---

## ✨ Features

- **Natural-language spell crafting** — write intent, get a fully realized spell (name, incantation, lore, stats)
- **5-validator AI council** — distinct personas vote in a single LLM round, judged by `gl.eq_principle.prompt_comparative`
- **Consensus aggregation** — averaged stats, mode-voted element/rarity, 60% approval threshold
- **MetaMask + GenLayer Snap** — connect with the wallet you already use; the GenLayer Snap signs Intelligent Contract calls
- **On-chain grimoire** — every player's collection is keyed to their wallet address
- **Native GEN marketplace** — list spells for sale in GEN, buy other players' glyphs, atomic ownership transfer + payment in one transaction
- **Mystical UI** — semantic design tokens, arcane gradients, rune glow, rarity rings

---

## 🗺 Pages

| Route | Page | Purpose |
|---|---|---|
| `/` | **Landing** | Hero, feature overview, CTA to enter the game |
| `/play` | **The Forge** | Write intent → council votes → mint winning spells |
| `/grimoire` | **Your Grimoire** | View your collected spells, list any of them on the market |
| `/market` | **Glyph Market** | Browse all listings, buy spells with native GEN, manage your own listings |

All in-game pages share a sticky header with navigation, wallet status, GEN balance, and a Studionet badge.

---

## 🛠 Tech Stack

| Layer | Tech |
|---|---|
| Framework | TanStack Start v1 (React 19, SSR-capable, file-based routing) |
| Build | Vite 7 |
| Styling | Tailwind CSS v4 + semantic tokens in `src/styles.css` |
| Smart contract | GenLayer Intelligent Contract — Python (`contracts/glyphwright.py`) |
| Consensus | `gl.eq_principle.prompt_comparative` — single LLM round with 5 validator personas |
| SDK | [`genlayer-js`](https://github.com/genlayerlabs/genlayer-js) — Studionet client + MetaMask Snap |
| Wallet | MetaMask via GenLayer Snap (`client.connect("studionet")`) |
| Currency | Native GEN — listings priced and paid in wei (1 GEN = 1e18 wei) |
| Storage | Contract state (TreeMap[str, str] holding JSON-serialized records) |

---

## 📁 Project Structure

```
contracts/
└── glyphwright.py             # GenLayer Intelligent Contract (forge council, grimoire, market)

public/
└── favicon.svg                # Arcane glyph favicon

src/
├── components/
│   ├── glyph/
│   │   ├── AppHeader.tsx        # Sticky header: nav, MetaMask connect, GEN balance
│   │   ├── SpellCard.tsx        # Stat, VoteCard, GrimoireCard
│   │   └── constants.ts         # Element hues, rarity rings, example intents
│   └── ui/                      # shadcn primitives
├── lib/
│   ├── glyphwright.contract.ts  # genlayer-js wrapper — every read/write goes through here
│   ├── genlayer-chain.ts        # Studionet chain config + helpers
│   ├── wallet.ts                # useGlyphwrightAccount() — MetaMask connection hook
│   ├── glyphwright.functions.ts # Type re-exports for backward-compat imports
│   ├── grimoire.ts              # Type re-exports for backward-compat imports
│   └── marketplace.ts           # Type re-exports for backward-compat imports
├── routes/
│   ├── __root.tsx               # Shell, providers, error boundaries, favicon
│   ├── index.tsx                # Landing page
│   ├── _app.tsx                 # Layout for in-game pages (header + Outlet)
│   ├── _app.play.tsx            # The Forge — calls forge_spell on-chain
│   ├── _app.grimoire.tsx        # Reads get_spells_by_owner; lists spells via list_spell
│   └── _app.market.tsx          # Reads get_active_listings; buy / delist writes
└── styles.css                   # Arcane design tokens (oklch)
```

---

## 🔗 GenLayer Integration

The contract runs on **GenLayer Studionet**:

```ts
// src/lib/genlayer-chain.ts
export const GENLAYER_CHAIN = {
  chainId: "0xF23F", // 61999
  chainName: "GenLayer Studionet",
  nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
  rpcUrls: ["https://studio.genlayer.com/api"],
  blockExplorerUrls: ["https://explorer-studio.genlayer.com"],
};
```

### Wallet model

Players connect with **MetaMask**. Studionet uses GenLayer's `gen_*` JSON-RPC (not pure EVM), so `genlayer-js` installs the GenLayer Snap on first connect to translate MetaMask signatures into Intelligent Contract calls. The flow:

1. User clicks **Connect Wallet** → MetaMask popup
2. `client.connect("studionet")` installs the GenLayer Snap if not already present and switches the active chain
3. Every `forge_spell`, `list_spell`, `buy_listing` is signed by the connected MetaMask account — reads work without a wallet at all

### Currency

The marketplace uses **native GEN**, not a custom token:

- Listings are priced in wei (1 GEN = 1e18 wei) and stored on-chain
- `buy_listing` is `@gl.public.write.payable` — buyers attach the price as `value` on the transaction
- The contract validates `gl.message.value >= price`, transfers `price` to the seller via `_Recipient.emit_transfer`, and refunds any overpayment back to the buyer
- No faucet inside the app — players use Studio's built-in GEN faucet to top up their MetaMask account

### Wiring the contract address

Deploy the contract once, then point the frontend at it via env:

```bash
# .env
VITE_GLYPHWRIGHT_CONTRACT=0x11Bac5fE29e8EE3a353eCa5133e09A82E55949aE
```

`src/lib/glyphwright.contract.ts` also carries a `FALLBACK_CONTRACT` constant pointing at the most recent deployment, so the app works out of the box even without `.env` for casual previews. Current deployment: **Studionet — `0x11Bac5fE29e8EE3a353eCa5133e09A82E55949aE`**.

If neither is set, the Forge page surfaces a banner with a paste-the-address input that saves at runtime via `useGlyphwrightAccount().configureContract(addr)`.

### Deploying

The recommended path is the GenLayer Studio web UI:

1. Open [studio.genlayer.com](https://studio.genlayer.com)
2. Paste the contents of `contracts/glyphwright.py`
3. Click **Get Schema** to verify the contract parses cleanly
4. Click **Deploy**, copy the printed address
5. Drop the address into `.env`, restart the dev server

Or with the CLI:

```bash
genlayer network studionet
genlayer deploy --contract contracts/glyphwright.py
# Returns: 0x11Bac5fE29e8EE3a353eCa5133e09A82E55949aE (Studionet)
```

---

## 🚀 Running Locally

```bash
bun install
# Optional: pre-set the contract address. If skipped, the in-app fallback is used.
#   VITE_GLYPHWRIGHT_CONTRACT=0x...
bun dev
```

Open [http://localhost:8080](http://localhost:8080):

1. Click **Connect Wallet** in the header — MetaMask will prompt, install the GenLayer Snap, and switch to Studionet
2. Make sure the connected account has Studionet GEN — use the Studio faucet if it doesn't
3. Head to `/play` and forge your first spell. Council deliberation typically takes 15–30 seconds

---

## 🗺 Roadmap

- **PvP Duels** — two players' spells judged head-to-head by the council
- **Validator staking** — stake GEN on a persona; earn when their vote aligns with the majority
- **Seasonal leaderboards** — most-forged, rarest spell, biggest sale
- **Spell fusion** — combine two grimoire spells into a new hybrid, re-judged by the council
- **AI-generated spell sigils** — image generation gated by approval score

---

## 📝 License

MIT — fork it, remix it, forge stranger spells.
