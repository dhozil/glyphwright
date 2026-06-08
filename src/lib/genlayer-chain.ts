// GenLayer Studionet config — published RPC endpoint and chain id.
// We keep this in a top-level constant so it's available from both the
// server (e.g. SSR) and the browser without going through env.
export const GENLAYER_CHAIN = {
  chainId: "0xF23F", // 61999
  chainName: "GenLayer Studionet",
  nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
  rpcUrls: ["https://studio.genlayer.com/api"],
  blockExplorerUrls: ["https://explorer-studio.genlayer.com"],
} as const;

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
