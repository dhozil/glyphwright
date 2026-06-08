import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  forgeSpell,
  type ForgeResult,
} from "@/lib/glyphwright.contract";
import { useGlyphwrightAccount } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stat, VoteCard } from "@/components/glyph/SpellCard";
import { ELEMENT_HUE, RARITY_RING, EXAMPLES } from "@/components/glyph/constants";

export const Route = createFileRoute("/_app/play")({
  head: () => ({
    meta: [
      { title: "The Forge — Glyphwright" },
      {
        name: "description",
        content: "Forge a new spell judged by 5 GenLayer LLM validators.",
      },
    ],
  }),
  component: PlayPage,
});

function PlayPage() {
  const [intent, setIntent] = useState("");
  const [lastResult, setLastResult] = useState<ForgeResult | null>(null);
  const acc = useGlyphwrightAccount();

  const mut = useMutation({
    mutationFn: (text: string) => forgeSpell(text),
    onSuccess: (r) => {
      setLastResult(r);
      acc.refreshBalance();
    },
  });

  const contractMissing = !acc.contractAddress;
  const walletDisconnected = !acc.address;

  return (
    <div className="mx-auto max-w-4xl px-6 pb-20 pt-8">
      <header className="text-center mb-10">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary/80 mb-3">
          <span className="h-px w-8 bg-primary/60" />
          The Forge · Council of Five
          <span className="h-px w-8 bg-primary/60" />
        </div>
        <h1 className="font-serif text-4xl md:text-5xl font-bold">Speak your spell</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your intent is judged on-chain by 5 LLM validators on GenLayer
          Studionet. Approval ≥ 60% mints the spell into your grimoire.
        </p>
      </header>

      {contractMissing ? <ContractAddressPrompt onSet={acc.configureContract} /> : null}

      {walletDisconnected ? (
        <Card className="p-4 mb-6 bg-primary/10 border-primary/40 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold">Connect your wallet to forge.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Glyphwright signs every forge with MetaMask via the GenLayer
              Snap so your spells stay tied to your address.
            </p>
          </div>
          <Button
            onClick={acc.connect}
            disabled={acc.connecting}
            className="bg-primary text-primary-foreground"
          >
            {acc.connecting ? "Connecting…" : "Connect Wallet"}
          </Button>
        </Card>
      ) : null}

      <Card
        className="p-6 md:p-8 border-primary/20 bg-card/70 backdrop-blur"
        style={{ boxShadow: "var(--glow-rune)" }}
      >
        <label className="text-sm uppercase tracking-widest text-primary/80">
          Your incantation of intent
        </label>
        <Textarea
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="Describe what your spell should do..."
          rows={3}
          className="mt-3 bg-input/60 border-border/60 text-base resize-none"
          disabled={mut.isPending}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setIntent(ex)}
              disabled={mut.isPending}
              className="text-xs px-2.5 py-1 rounded-full bg-secondary/60 text-secondary-foreground/80 hover:bg-accent/30 hover:text-foreground transition border border-border/40"
            >
              {ex}
            </button>
          ))}
        </div>
        <Button
          onClick={() => mut.mutate(intent)}
          disabled={
            mut.isPending ||
            intent.trim().length < 5 ||
            contractMissing ||
            walletDisconnected
          }
          className="mt-6 w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold tracking-wide"
          size="lg"
        >
          {mut.isPending
            ? "Council is deliberating on-chain…"
            : "Forge the Glyph"}
        </Button>
        {mut.isPending ? (
          <p className="mt-3 text-xs text-muted-foreground text-center">
            5 validators are voting through Optimistic Democracy. This can take
            30–90 seconds on Studionet.
          </p>
        ) : null}
        {mut.error ? (
          <p className="mt-3 text-sm text-destructive">
            The aether refused: {(mut.error as Error).message}
          </p>
        ) : null}
      </Card>

      {lastResult ? <SpellResult result={lastResult} /> : null}
    </div>
  );
}

function ContractAddressPrompt({ onSet }: { onSet: (addr: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = value.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
      setError("Address must be 0x followed by 40 hex chars.");
      return;
    }
    setError(null);
    onSet(trimmed);
  };

  return (
    <Card className="p-4 mb-6 bg-amber-500/10 border-amber-400/40">
      <p className="text-sm text-amber-300 font-semibold">
        Glyphwright contract is not configured.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Deploy <code className="font-mono">contracts/glyphwright.py</code> in
        the{" "}
        <a
          href="https://studio.genlayer.com"
          target="_blank"
          rel="noreferrer"
          className="underline text-primary"
        >
          GenLayer Studio
        </a>
        , then paste the deployed contract address below. The value is saved
        locally — no rebuild required.
      </p>
      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0x…"
          className="font-mono text-xs"
        />
        <Button
          onClick={submit}
          className="bg-primary text-primary-foreground"
        >
          Use this contract
        </Button>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      ) : null}
      <p className="mt-2 text-[10px] text-muted-foreground">
        You can also pre-set this with{" "}
        <code className="font-mono">VITE_GLYPHWRIGHT_CONTRACT</code> in{" "}
        <code className="font-mono">.env</code>.
      </p>
    </Card>
  );
}

function SpellResult({ result }: { result: ForgeResult }) {
  const { spellName, incantation, description, votes, consensus } = result;
  const elemHue = ELEMENT_HUE[consensus.element] ?? ELEMENT_HUE.arcane;
  const rarityRing = RARITY_RING[consensus.rarity] ?? RARITY_RING.common;
  const forged = consensus.verdict === "FORGED";

  return (
    <div className="mt-10 space-y-6 animate-in fade-in duration-700">
      <Card
        className={`relative overflow-hidden border-primary/30 bg-gradient-to-br ${elemHue} ring-2 ${rarityRing} p-8`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary/80">
              {consensus.rarity} · {consensus.element}
            </p>
            <h2 className="mt-2 font-serif text-3xl md:text-4xl font-bold">
              {spellName}
            </h2>
            <p className="mt-2 italic text-accent-foreground/90">"{incantation}"</p>
          </div>
          <Badge
            variant={forged ? "default" : "destructive"}
            className={
              forged
                ? "bg-primary text-primary-foreground text-sm px-3 py-1"
                : "text-sm px-3 py-1"
            }
          >
            {consensus.verdict}
          </Badge>
        </div>
        <p className="mt-4 text-foreground/90 leading-relaxed">{description}</p>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <Stat label="Power" value={consensus.power} accent="text-primary" />
          <Stat
            label="Mana"
            value={consensus.mana_cost}
            accent="text-sky-300"
          />
          <Stat
            label="Approval"
            value={Math.round(consensus.approval * 100)}
            suffix="%"
            accent={forged ? "text-emerald-400" : "text-destructive"}
          />
        </div>

        {forged ? (
          <div className="mt-6 border-t border-border/30 pt-5">
            <div className="text-sm">
              <div className="text-emerald-300 font-semibold">
                ✓ Inscribed to GenLayer
              </div>
              <div className="mt-1 font-mono text-xs text-muted-foreground break-all">
                spell id: {result.spell_id}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                View it in your{" "}
                <a href="/grimoire" className="text-primary underline">
                  Grimoire
                </a>{" "}
                or list it on the{" "}
                <a href="/market" className="text-primary underline">
                  Market
                </a>
                .
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6 border-t border-border/30 pt-5 text-sm">
            <div className="text-destructive font-semibold">
              ✗ Council rejected the spell
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Less than 60% of validators approved. Adjust your intent and
              re-forge.
            </p>
          </div>
        )}
      </Card>

      <div>
        <h3 className="text-xs uppercase tracking-[0.3em] text-primary/80 mb-3">
          Validator Verdicts · Optimistic Democracy
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          {votes.map((v) => (
            <VoteCard key={v.validator} vote={v} />
          ))}
        </div>
      </div>
    </div>
  );
}
