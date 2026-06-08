// useGlyphwrightAccount - MetaMask wallet connection for GenLayer Studionet.
//
// genlayer-js handles the GenLayer MetaMask Snap so signing IC calls
// works against the `gen_*` JSON-RPC. From the player's POV: click
// Connect, pop MetaMask, done.

import { useCallback, useEffect, useState } from "react";
import {
  balanceOf,
  clearWalletState,
  connectWallet,
  getContractAddress,
  loadStoredAddress,
  setContractAddress,
} from "./glyphwright.contract";

export { GENLAYER_CHAIN, shortAddr } from "./genlayer-chain";

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

export function useGlyphwrightAccount() {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [contractAddr, setContractAddrState] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore previously connected address on mount + listen for wallet
  // events so the UI updates when the user switches/disconnects accounts
  // in MetaMask.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setContractAddrState(getContractAddress());
    const stored = loadStoredAddress();
    if (stored) setAddress(stored);

    const eth = window.ethereum;
    if (!eth?.on) return;

    const onAccounts = (...args: unknown[]) => {
      const accs = args[0] as string[];
      const next = accs?.[0] ?? null;
      if (!next) {
        clearWalletState();
        setAddress(null);
      } else if (next.toLowerCase() !== (loadStoredAddress() ?? "").toLowerCase()) {
        // Account switched in MetaMask - reset our cached client and
        // store the new address as the active one.
        clearWalletState();
        setAddress(next);
        // Persist via the same code path so the contract module sees it.
        try {
          window.localStorage.setItem("glyphwright:wallet:address", next);
        } catch {
          /* ignore */
        }
      }
    };

    eth.on("accountsChanged", onAccounts);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
    };
  }, []);

  // Refresh on-chain balance whenever the address or contract changes.
  const refreshBalance = useCallback(async () => {
    if (!address || !contractAddr) {
      setBalance(null);
      return;
    }
    try {
      setBalance(await balanceOf(address));
    } catch (e) {
      setBalance(0n);
      setError((e as Error).message);
    }
  }, [address, contractAddr]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const addr = await connectWallet();
      setAddress(addr);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    clearWalletState();
    setAddress(null);
    setBalance(null);
    setError(null);
  }, []);

  const configureContract = useCallback((addr: string) => {
    setContractAddress(addr);
    setContractAddrState(addr);
  }, []);

  return {
    address,
    balance,
    contractAddress: contractAddr,
    /** True once both wallet AND contract are wired up. */
    ready: !!address && !!contractAddr,
    connecting,
    error,
    connect,
    disconnect,
    refreshBalance,
    configureContract,
  };
}
