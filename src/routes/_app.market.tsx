import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useGlyphwrightAccount, shortAddr } from "@/lib/wallet";
import {
  buyListing,
  delistSpell,
  formatGen,
  getActiveListings,
  type Listing,
} from "@/lib/glyphwright.contract";
import { GrimoireCard } from "@/components/glyph/SpellCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/market")({
  head: () => ({
    meta: [
      { title: "Spell Market — Glyphwright" },
      { name: "description", content: "Buy and sell GenLayer-validated spell NFTs." },
    ],
  }),
  component: MarketPage,
});

function MarketPage() {
  const acc = useGlyphwrightAccount();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "mine">("all");

  const listingsQ = useQuery({
    queryKey: ["listings", acc.contractAddress],
    queryFn: () => getActiveListings(),
    enabled: !!acc.contractAddress,
  });

  const buyMut = useMutation({
    mutationFn: (l: Listing) => buyListing(l.id, l.price),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listings"] });
      qc.invalidateQueries({ queryKey: ["grimoire"] });
      acc.refreshBalance();
    },
  });

  const delistMut = useMutation({
    mutationFn: (l: Listing) => delistSpell(l.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listings"] });
    },
  });

  const listings = listingsQ.data ?? [];
  const visible =
    filter === "mine" && acc.address
      ? listings.filter(
          (l) => l.seller.toLowerCase() === acc.address!.toLowerCase(),
        )
      : listings;

  const busyId =
    buyMut.isPending ? buyMut.variables?.id ?? null
    : delistMut.isPending ? delistMut.variables?.id ?? null
    : null;

  const lastError =
    (buyMut.error as Error | null)?.message ??
    (delistMut.error as Error | null)?.message ??
    null;

  return (
    <div className="mx-auto max-w-6xl px-6 pb-20 pt-8">
      <header className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary/80">Glyph Market</p>
          <h1 className="font-serif text-4xl font-bold mt-1">
            {listings.length} {listings.length === 1 ? "spell" : "spells"} for sale
          </h1>
        </div>
        <div className="flex gap-2 items-center">
          {acc.address ? (
            <Badge className="bg-primary/10 text-primary border-primary/40">
              Balance: {acc.balance !== null ? formatGen(acc.balance) : "—"} GEN
            </Badge>
          ) : (
            <Button
              size="sm"
              onClick={acc.connect}
              disabled={acc.connecting}
              className="bg-primary text-primary-foreground"
            >
              {acc.connecting ? "Connecting…" : "Connect Wallet"}
            </Button>
          )}
          <div className="flex rounded-md border border-border/60 overflow-hidden">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 text-xs ${filter === "all" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("mine")}
              className={`px-3 py-1.5 text-xs ${filter === "mine" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
            >
              My Listings
            </button>
          </div>
        </div>
      </header>

      {lastError ? (
        <Card className="p-3 mb-4 bg-destructive/10 border-destructive/40 text-sm text-destructive">
          {lastError}
        </Card>
      ) : null}

      {listingsQ.isLoading ? (
        <Card className="p-12 text-center bg-card/60">
          <p className="text-muted-foreground">Loading listings from Studionet…</p>
        </Card>
      ) : listingsQ.error ? (
        <Card className="p-6 bg-destructive/10 border-destructive/40 text-sm text-destructive">
          {(listingsQ.error as Error).message}
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-12 text-center bg-card/60">
          <p className="text-muted-foreground">No spells listed yet.</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Forge spells and list them from your Grimoire.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((l) => {
            const mine =
              acc.address?.toLowerCase() === l.seller.toLowerCase();
            const busy = busyId === l.id;
            return (
              <GrimoireCard
                key={l.id}
                spell={l.spell}
                action={
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Seller</span>
                      <span className="font-mono">{shortAddr(l.seller)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-serif text-lg font-bold text-primary">
                        {formatGen(l.price)} GEN
                      </span>
                      {mine ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => delistMut.mutate(l)}
                        >
                          {busy ? "…" : "Delist"}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={busy || !acc.address}
                          onClick={() => buyMut.mutate(l)}
                          className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          {busy ? "Buying…" : "Buy"}
                        </Button>
                      )}
                    </div>
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
