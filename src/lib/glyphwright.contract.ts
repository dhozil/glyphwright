// Glyphwright <-> GenLayer Studionet bridge.
//
// All on-chain interaction lives here. The rest of the app talks to the
// contract through the typed helpers exported below.
//
// Identity model
// --------------
// Players connect with MetaMask. genlayer-js handles the GenLayer
// MetaMask Snap behind the scenes so MetaMask can sign Intelligent
// Contract calls against Studionet's `gen_*` JSON-RPC. We build a
// client per connected EVM address; the address is the player's
// identity and is also the contract `gl.message.sender_address`.

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus, type TransactionHash } from "genlayer-js/types";
import type { Address as ViemAddress } from "viem";

// ---------- Contract address ----------------------------------------------

const CONTRACT_ADDR_KEY = "glyphwright:contract:address";

// Deployed on GenLayer Studionet. Set via VITE_GLYPHWRIGHT_CONTRACT or
// falls back to this hardcoded address from the last known deployment.
const FALLBACK_CONTRACT = "0x11Bac5fE29e8EE3a353eCa5133e09A82E55949aE";

const ENV_ADDR =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: Record<string, string | undefined> }).env
      ?.VITE_GLYPHWRIGHT_CONTRACT) ||
  FALLBACK_CONTRACT;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getContractAddress(): ViemAddress | null {
  if (ENV_ADDR && /^0x[0-9a-fA-F]{40}$/.test(ENV_ADDR)) {
    return ENV_ADDR as ViemAddress;
  }
  if (!isBrowser()) return null;
  const v = localStorage.getItem(CONTRACT_ADDR_KEY);
  return v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as ViemAddress) : null;
}

export function setContractAddress(addr: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(CONTRACT_ADDR_KEY, addr);
}

class ContractNotConfiguredError extends Error {
  constructor() {
    super(
      "Glyphwright contract address not set. Deploy contracts/glyphwright.py to GenLayer Studionet, then set VITE_GLYPHWRIGHT_CONTRACT.",
    );
    this.name = "ContractNotConfiguredError";
  }
}

function requireContractAddress(): ViemAddress {
  const a = getContractAddress();
  if (!a) throw new ContractNotConfiguredError();
  return a;
}

// ---------- Wallet connection (MetaMask) ----------------------------------

const ADDR_STORAGE = "glyphwright:wallet:address";

type Eth = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void;
};

declare global {
  interface Window {
    ethereum?: Eth;
  }
}

export class WalletNotConnectedError extends Error {
  constructor() {
    super("Wallet not connected. Click 'Connect Wallet' in the header.");
    this.name = "WalletNotConnectedError";
  }
}

export class NoWalletError extends Error {
  constructor() {
    super("MetaMask is recommended for the best Glyphwright experience.");
    this.name = "NoWalletError";
  }
}

export class WalletNotMetaMaskError extends Error {
  constructor() {
    super(
      "Glyphwright works best with MetaMask. Please switch to MetaMask and try again.",
    );
    this.name = "WalletNotMetaMaskError";
  }
}

export function loadStoredAddress(): ViemAddress | null {
  if (!isBrowser()) return null;
  const v = localStorage.getItem(ADDR_STORAGE);
  return v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as ViemAddress) : null;
}

function saveStoredAddress(addr: ViemAddress | null): void {
  if (!isBrowser()) return;
  if (addr) localStorage.setItem(ADDR_STORAGE, addr);
  else localStorage.removeItem(ADDR_STORAGE);
}

let cachedClient: ReturnType<typeof createClient> | null = null;
let cachedFor: ViemAddress | null = null;
let connectedOnce = false;

function buildClient(addr: ViemAddress) {
  if (cachedClient && cachedFor === addr) return cachedClient;
  cachedClient = createClient({
    chain: studionet,
    account: addr,
  });
  cachedFor = addr;
  connectedOnce = false;
  return cachedClient;
}

function getClient(addr?: ViemAddress | null): ReturnType<typeof createClient> {
  const target = addr ?? loadStoredAddress();
  if (!target) throw new WalletNotConnectedError();
  return buildClient(target);
}

/** Reset state when the user disconnects or switches accounts. */
export function clearWalletState(): void {
  cachedClient = null;
  cachedFor = null;
  connectedOnce = false;
  saveStoredAddress(null);
}

/** Prompt MetaMask for accounts. Returns the connected address. */
export async function connectWallet(): Promise<ViemAddress> {
  if (!isBrowser() || !window.ethereum) {
    throw new NoWalletError();
  }
  // Verify the wallet actually supports the Snap API (MetaMask or
  // MetaMask-compatible). Non-MetaMask wallets like Rabby expose an
  // EVM provider but cannot install the GenLayer Snap, so we catch
  // that early with a helpful message.
  try {
    await window.ethereum.request({
      method: "wallet_getSnaps",
      params: [],
    });
  } catch {
    throw new WalletNotMetaMaskError();
  }
  const accs = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];
  const addr = accs?.[0];
  if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) {
    throw new Error("MetaMask returned no account.");
  }
  saveStoredAddress(addr as ViemAddress);
  buildClient(addr as ViemAddress);
  return addr as ViemAddress;
}

/** Ensure the underlying wallet is on Studionet. Idempotent — safe to
 *  call before every write. genlayer-js handles the Snap install +
 *  chain switch under the hood. */
async function ensureConnected(addr: ViemAddress): Promise<void> {
  if (connectedOnce && cachedFor === addr) return;
  const client = buildClient(addr);
  // `client.connect("studionet")` switches the underlying EVM wallet to
  // GenLayer Studionet and installs the GenLayer Snap if needed.
  await (client as unknown as {
    connect: (network: string) => Promise<void>;
  }).connect("studionet");
  connectedOnce = true;
}

// ---------- Domain types --------------------------------------------------

export type Vote = {
  validator: string;
  power: number;
  mana_cost: number;
  element: string;
  rarity: string;
  approve: boolean;
  reasoning: string;
};

export type Consensus = {
  power: number;
  mana_cost: number;
  element: string;
  rarity: string;
  approval: number; // 0..1
  verdict: "FORGED" | "REJECTED";
};

export type ForgeResult = {
  spell_id: string;
  owner: string;
  forged_at: number;
  intent: string;
  spellName: string;
  incantation: string;
  description: string;
  votes: Vote[];
  consensus: Consensus;
};

export type Spell = {
  id: string;
  owner: string;
  forged_at: number;
  spellName: string;
  incantation: string;
  description: string;
  intent: string;
  votes: Vote[];
  consensus: Consensus;
};

export type Listing = {
  id: string;
  spell_id: string;
  seller: string;
  /** Price in wei (1 GEN = 1e18 wei). */
  price: bigint;
  listed_at: number;
  spell: Spell;
};

// ---------- Result coercion -----------------------------------------------

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

const num = (x: unknown, fallback = 0): number => {
  if (typeof x === "number") return x;
  if (typeof x === "bigint") return Number(x);
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
};

const str = (x: unknown, fallback = ""): string =>
  typeof x === "string" ? x : fallback;

const bool = (x: unknown): boolean => Boolean(x);

function coerceVote(raw: unknown): Vote {
  const r = isRecord(raw) ? raw : {};
  return {
    validator: str(r.validator),
    power: num(r.power),
    mana_cost: num(r.mana_cost),
    element: str(r.element),
    rarity: str(r.rarity),
    approve: bool(r.approve),
    reasoning: str(r.reasoning),
  };
}

function coerceConsensus(raw: unknown): Consensus {
  const r = isRecord(raw) ? raw : {};
  return {
    power: num(r.power),
    mana_cost: num(r.mana_cost),
    element: str(r.element, "arcane"),
    rarity: str(r.rarity, "common"),
    approval: num(r.approval),
    verdict: r.verdict === "FORGED" ? "FORGED" : "REJECTED",
  };
}

function coerceForgeResult(raw: unknown): ForgeResult | null {
  if (!isRecord(raw) || !raw.consensus) return null;
  const votes = Array.isArray(raw.votes) ? raw.votes.map(coerceVote) : [];
  return {
    spell_id: str(raw.spell_id),
    owner: str(raw.owner),
    forged_at: num(raw.forged_at),
    intent: str(raw.intent),
    spellName: str(raw.spellName),
    incantation: str(raw.incantation),
    description: str(raw.description),
    votes,
    consensus: coerceConsensus(raw.consensus),
  };
}

function coerceSpell(raw: unknown): Spell | null {
  if (!isRecord(raw) || !raw.id) return null;
  const votes = Array.isArray(raw.votes) ? raw.votes.map(coerceVote) : [];
  return {
    id: str(raw.id),
    owner: str(raw.owner),
    forged_at: num(raw.forged_at),
    spellName: str(raw.spellName),
    incantation: str(raw.incantation),
    description: str(raw.description),
    intent: str(raw.intent),
    votes,
    consensus: coerceConsensus(raw.consensus),
  };
}

function coerceListing(raw: unknown): Listing | null {
  if (!isRecord(raw) || !raw.id) return null;
  const sp = coerceSpell(raw.spell);
  if (!sp) return null;
  let price: bigint;
  try {
    price = typeof raw.price === "bigint" ? raw.price : BigInt(String(raw.price ?? 0));
  } catch {
    price = 0n;
  }
  return {
    id: str(raw.id),
    spell_id: str(raw.spell_id),
    seller: str(raw.seller),
    price,
    listed_at: num(raw.listed_at),
    spell: sp,
  };
}

// ---------- Public read methods (free, no signing) ------------------------
//
// Reads work without a connected wallet — we lazily build a read-only
// client when needed.

let readonlyClient: ReturnType<typeof createClient> | null = null;
function getReadonlyClient() {
  if (readonlyClient) return readonlyClient;
  readonlyClient = createClient({ chain: studionet });
  return readonlyClient;
}

export async function balanceOf(addr: string): Promise<bigint> {
  // Native GEN balance lives on the chain layer, not on the IC. We read
  // it via the standard EVM `eth_getBalance` exposed through genlayer-js
  // (which is just a viem client under the hood for read ops).
  const client = getReadonlyClient();
  // viem's getBalance is part of PublicActions and is preserved on the
  // GenLayerClient.
  const bal = await (client as unknown as {
    getBalance: (args: { address: string }) => Promise<bigint>;
  }).getBalance({ address: addr });
  return bal;
}

// Helper: contract methods now return JSON strings (PatchworkTruth-style),
// so every read goes through this little parse step.
function parseJsonOrNull<T = unknown>(raw: unknown): T | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function getSpellsByOwner(addr: string): Promise<Spell[]> {
  const client = getReadonlyClient();
  const r = await client.readContract({
    address: requireContractAddress(),
    functionName: "get_spells_by_owner",
    args: [addr],
  });
  const arr = parseJsonOrNull<unknown[]>(r);
  if (!Array.isArray(arr)) return [];
  return arr.map(coerceSpell).filter((s): s is Spell => s !== null);
}

export async function getActiveListings(): Promise<Listing[]> {
  const client = getReadonlyClient();
  const r = await client.readContract({
    address: requireContractAddress(),
    functionName: "get_active_listings",
    args: [],
  });
  const arr = parseJsonOrNull<unknown[]>(r);
  if (!Array.isArray(arr)) return [];
  return arr.map(coerceListing).filter((l): l is Listing => l !== null);
}

export async function getLastForge(addr: string): Promise<ForgeResult | null> {
  const client = getReadonlyClient();
  const r = await client.readContract({
    address: requireContractAddress(),
    functionName: "get_last_forge",
    args: [addr],
  });
  const obj = parseJsonOrNull(r);
  return coerceForgeResult(obj);
}

// ---------- Public write methods (signed via MetaMask) --------------------

async function writeAndWait(
  functionName: string,
  args: unknown[],
  value: bigint = 0n,
): Promise<{ hash: TransactionHash; tx: unknown }> {
  const addr = loadStoredAddress();
  if (!addr) throw new WalletNotConnectedError();
  await ensureConnected(addr);
  const client = getClient(addr);

  const hash: TransactionHash = await client.writeContract({
    address: requireContractAddress(),
    functionName,
    args: args as never[],
    value,
  });
  // ACCEPTED is the standard UX choice — FINALIZED forces players to
  // sit through the appeal window for every action.
  const tx = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 200,
    interval: 2000,
  });
  return { hash, tx };
}

export async function forgeSpell(intent: string): Promise<ForgeResult> {
  const trimmed = intent.trim();
  if (trimmed.length < 5 || trimmed.length > 400) {
    throw new Error("intent must be 5..400 chars");
  }
  await writeAndWait("forge_spell", [trimmed]);
  const addr = loadStoredAddress();
  if (!addr) throw new WalletNotConnectedError();

  // Storage state can lag a beat behind the receipt. Poll a few times
  // before giving up so the UI doesn't fail on a race that resolves
  // within seconds.
  for (let i = 0; i < 8; i++) {
    const result = await getLastForge(addr);
    if (result) return result;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(
    "Forge transaction was accepted but the receipt is not visible yet. Check your Grimoire in a moment.",
  );
}

export async function listSpell(
  spellId: string,
  priceWei: bigint,
): Promise<void> {
  if (priceWei <= 0n) {
    throw new Error("price must be > 0");
  }
  await writeAndWait("list_spell", [spellId, priceWei]);
}

export async function delistSpell(listingId: string): Promise<void> {
  await writeAndWait("delist_spell", [listingId]);
}

export async function buyListing(
  listingId: string,
  priceWei: bigint,
): Promise<void> {
  await writeAndWait("buy_listing", [listingId], priceWei);
}

// ---------- Misc ----------------------------------------------------------

export const GENLAYER_EXPLORER = "https://explorer-studio.genlayer.com";

export const studioExplorer = (txHash: string) =>
  `${GENLAYER_EXPLORER}/tx/${txHash}`;

/** Format wei as a short GEN string (e.g. 1500000000000000000n -> "1.5"). */
export function formatGen(wei: bigint, fractionDigits = 4): string {
  const ONE = 1_000_000_000_000_000_000n; // 1e18
  const whole = wei / ONE;
  const remainder = wei - whole * ONE;
  if (remainder === 0n) return whole.toString();
  // Build a fixed-point fraction string and trim trailing zeros.
  const fracStr = remainder.toString().padStart(18, "0").slice(0, fractionDigits);
  const trimmed = fracStr.replace(/0+$/, "");
  return trimmed.length ? `${whole}.${trimmed}` : whole.toString();
}

/** Parse a "1.5" GEN string into wei. Returns null if invalid. */
export function parseGen(input: string): bigint | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  try {
    return BigInt(whole) * 1_000_000_000_000_000_000n + BigInt(fracPadded || "0");
  } catch {
    return null;
  }
}
