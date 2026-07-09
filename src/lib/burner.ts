import { generatePrivateKey } from "genlayer-js";
import { createAccount } from "genlayer-js";

const BURNER_KEY = "glyphwright:burner";
const BURNER_MODE_KEY = "glyphwright:wallet:mode";

export type WalletMode = "metamask" | "burner";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getWalletMode(): WalletMode {
  if (!isBrowser()) return "burner";
  return (localStorage.getItem(BURNER_MODE_KEY) as WalletMode) || "metamask";
}

export function setWalletMode(mode: WalletMode): void {
  if (!isBrowser()) return;
  localStorage.setItem(BURNER_MODE_KEY, mode);
}

export function ensureBurner(): `0x${string}` {
  if (!isBrowser()) throw new Error("burner only available in browser");
  const existing = tryLoadBurner();
  if (existing) return existing.address;

  const privKey = generatePrivateKey();
  const account = createAccount(privKey);
  localStorage.setItem(
    BURNER_KEY,
    JSON.stringify({ privKey, address: account.address }),
  );
  return account.address as `0x${string}`;
}

export function tryLoadBurner():
  | { privKey: `0x${string}`; address: `0x${string}` }
  | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(BURNER_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return p.privKey && p.address ? p : null;
  } catch {
    return null;
  }
}

export function clearBurner(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(BURNER_KEY);
}