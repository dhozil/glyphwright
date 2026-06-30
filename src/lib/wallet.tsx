import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  NoWalletError,
  WalletNotMetaMaskError,
  balanceOf,
  clearWalletState,
  connectWallet,
  getContractAddress,
  loadStoredAddress,
  setContractAddress,
} from "./glyphwright.contract";

export { GENLAYER_CHAIN, shortAddr } from "./genlayer-chain";

// ---------- Context shape ------------------------------------------------

type WalletState = {
  address: string | null;
  balance: bigint | null;
  contractAddress: string | null;
  ready: boolean;
  connecting: boolean;
  error: string | null;
  needsMetaMask: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  configureContract: (addr: string) => void;
  dismissMetaMaskModal: () => void;
};

const WalletContext = createContext<WalletState | null>(null);

// ---------- Provider -----------------------------------------------------

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [contractAddr, setContractAddrState] = useState<string | null>(
    getContractAddress(),
  );
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsMetaMask, setNeedsMetaMask] = useState(false);

  // Restore persisted address + listen for wallet account changes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setContractAddrState(getContractAddress());
    const stored = loadStoredAddress();
    if (stored) setAddress(stored);
  }, []);

  // Listen for MetaMask account switches / disconnects.
  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.on) return;

    const onAccounts = (...args: unknown[]) => {
      const accs = args[0] as string[];
      const next = accs?.[0] ?? null;
      if (!next) {
        clearWalletState();
        setAddress(null);
      } else if (
        next.toLowerCase() !== (loadStoredAddress() ?? "").toLowerCase()
      ) {
        clearWalletState();
        setAddress(next);
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

  const refreshBalance = useCallback(async () => {
    if (!address || !contractAddr) {
      setBalance(null);
      return;
    }
    try {
      setBalance(await balanceOf(address));
    } catch {
      setBalance(0n);
    }
  }, [address, contractAddr]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  const connect = useCallback(async () => {
    setError(null);
    setNeedsMetaMask(false);
    setConnecting(true);
    try {
      const addr = await connectWallet();
      setAddress(addr);
    } catch (e) {
      if (
        e instanceof WalletNotMetaMaskError ||
        e instanceof NoWalletError
      ) {
        setNeedsMetaMask(true);
      } else {
        setError((e as Error).message);
      }
    } finally {
      setConnecting(false);
    }
  }, []);

  const dismissMetaMaskModal = useCallback(() => {
    setNeedsMetaMask(false);
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

  const value = useMemo<WalletState>(
    () => ({
      address,
      balance,
      contractAddress: contractAddr,
      ready: !!address && !!contractAddr,
      connecting,
      error,
      needsMetaMask,
      connect,
      disconnect,
      refreshBalance,
      configureContract,
      dismissMetaMaskModal,
    }),
    [
      address,
      balance,
      contractAddr,
      connecting,
      error,
      needsMetaMask,
      connect,
      disconnect,
      refreshBalance,
      configureContract,
      dismissMetaMaskModal,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

// ---------- Hook ---------------------------------------------------------

export function useGlyphwrightAccount(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx)
    throw new Error(
      "useGlyphwrightAccount must be used within a <WalletProvider>.",
    );
  return ctx;
}
