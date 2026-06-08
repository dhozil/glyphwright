import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useGlyphwrightAccount } from "@/lib/wallet";
import {
  getActiveListings,
  getSpellsByOwner,
  listSpell,
  parseGen,
  type Spell,
} from "@/lib/glyphwright.contract";
import { GrimoireCard } from "@/components/glyph/SpellCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/grimoire")({
  head: () => ({
    meta: [
      { title: "Your Grimoire — Glyphwright" },
      { name: "description", content: "Your collected spell NFTs on GenLayer." },
    ],
  }),
  component: GrimoirePage,
});

function GrimoirePage() {
  const acc = useGlyphwrightAccount();
  const qc = useQueryClient();
  const [selling, setSelling] = useState<Spell | null>(null);
  const [price, setPrice] = useState("0.1");

  const grimoireQ = useQuery({
    queryKey: ["grimoire", acc.address, acc.contractAddress],
    queryFn: () => (acc.address ? getSpellsByOwner(acc.address) : Promise.resolve([])),
    enabled: !!acc.address && !!acc.contractAddress,
  });

  const listingsQ = useQuery({
    queryKey: ["listings", acc.contractAddress],
    queryFn: () => getActiveListings(),
    enabled: !!acc.contractAddress,
  });

  const listMut = useMutation({
    mutationFn: ({ id, wei }: { id: string; wei: bigint }) =>
      listSpell(id, wei),
    onSuccess: () => {
      setSelling(null);
      qc.invalidateQueries({ queryKey: ["listings"] });
      qc.invalidateQueries({ queryKey: ["grimoire"] });
    },
  });

  const listed = new Set(
    (listingsQ.data ?? []).map((l) => l.spell_id),
  );
  const grim = grimoireQ.data ?? [];

  if (!acc.address) {
    return (
      <div className="mx-auto max-w-2xl px-6 pt-20 text-center">
        <h1 className="font-serif text-3xl font-bold">Connect your wallet</h1>
        <p className="mt-2 text-muted-foreground">
          Your grimoire is bound to your wallet address.
        </p>
        <Button
          onClick={acc.connect}
          disabled={acc.connecting}
          className="mt-6 bg-primary text-primary-foreground"
        >
          {acc.connecting ? "Connecting…" : "Connect Wallet"}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 pb-20 pt-8">
      <header className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary/80">Your Grimoire</p>
          <h1 className="font-serif text-4xl font-bold mt-1">
            {grim.length} {grim.length === 1 ? "spell inscribed" : "spells inscribed"}
          </h1>
        </div>
        <Button asChild variant="outline">
          <Link to="/play">+ Forge another</Link>
        </Button>
      </header>

      {grimoireQ.isLoading ? (
        <Card className="p-12 text-center bg-card/60">
          <p className="text-muted-foreground">Reading your grimoire from Studionet…</p>
        </Card>
      ) : grimoireQ.error ? (
        <Card className="p-6 bg-destructive/10 border-destructive/40 text-sm text-destructive">
          {(grimoireQ.error as Error).message}
        </Card>
      ) : grim.length === 0 ? (
        <Card className="p-12 text-center bg-card/60">
          <p className="text-muted-foreground">Your grimoire is empty.</p>
          <Button asChild className="mt-4 bg-primary text-primary-foreground">
            <Link to="/play">Forge your first spell</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {grim.map((spell) => (
            <GrimoireCard
              key={spell.id}
              spell={spell}
              action={
                listed.has(spell.id) ? (
                  <div className="text-xs text-emerald-400 font-semibold">● Listed on Market</div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setSelling(spell)}
                  >
                    List on Market
                  </Button>
                )
              }
            />
          ))}
        </div>
      )}

      <Dialog open={!!selling} onOpenChange={(o) => !o && setSelling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>List "{selling?.spellName}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              Price in GEN
            </label>
            <Input
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.1"
              disabled={listMut.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Listing calls <code className="font-mono">list_spell</code> on
              the GenLayer Intelligent Contract. Buyers pay in native GEN.
            </p>
            {listMut.error ? (
              <p className="text-xs text-destructive">
                {(listMut.error as Error).message}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setSelling(null)}
              disabled={listMut.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selling) return;
                const wei = parseGen(price);
                if (!wei || wei <= 0n) return;
                listMut.mutate({ id: selling.id, wei });
              }}
              disabled={listMut.isPending || !parseGen(price)}
              className="bg-primary text-primary-foreground"
            >
              {listMut.isPending ? "Confirming on-chain…" : "Confirm Listing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
