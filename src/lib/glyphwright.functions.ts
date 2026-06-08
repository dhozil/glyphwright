// All forge logic now lives in the GenLayer Intelligent Contract
// (contracts/glyphwright.py). This file used to host a server-side
// 5-validator simulation against the Lovable AI Gateway; that path is
// gone. We keep the type aliases here so existing imports across the UI
// keep compiling while the routes migrate to the contract client.

export type {
  ForgeResult,
  Vote,
  Consensus,
} from "./glyphwright.contract";

export { forgeSpell } from "./glyphwright.contract";
