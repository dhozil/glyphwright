import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Glyphwright — Forge AI-judged spell NFTs on GenLayer" },
      {
        name: "description",
        content:
          "A spell-crafting game where 5 LLM validators vote on every spell you forge. Trade rare glyphs on the GenLayer-powered marketplace.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div
      className="min-h-screen text-foreground"
      style={{ background: "var(--gradient-arcane), var(--color-background)" }}
    >
      <header className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="font-serif tracking-wide text-lg">Glyphwright</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link to="/market" className="text-sm text-muted-foreground hover:text-foreground px-3 py-2">
            Market
          </Link>
          <Link to="/grimoire" className="text-sm text-muted-foreground hover:text-foreground px-3 py-2">
            Grimoire
          </Link>
          <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Link to="/play">Enter the Forge</Link>
          </Button>
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-6 pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary/80 mb-6">
          <span className="h-px w-8 bg-primary/60" />
          Powered by GenLayer Optimistic Democracy
          <span className="h-px w-8 bg-primary/60" />
        </div>
        <h1 className="font-serif text-6xl md:text-8xl font-bold tracking-tight leading-[1.05]">
          <span className="bg-gradient-to-br from-primary via-accent to-primary bg-clip-text text-transparent">
            Speak it.
          </span>
          <br />
          <span className="bg-gradient-to-br from-accent via-primary to-accent bg-clip-text text-transparent">
            The Council decides.
          </span>
        </h1>
        <p className="mt-8 text-lg text-muted-foreground max-w-2xl mx-auto">
          Write a spell in plain words. Five arcane LLM validators argue and vote
          through GenLayer's AI consensus. Forged spells become tradeable NFTs in your grimoire.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8">
            <Link to="/play">⚡ Forge a Spell</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-base px-8">
            <Link to="/market">Browse Market</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24 grid gap-6 md:grid-cols-3">
        {[
          {
            t: "Forge",
            d: "Write any intent. The AI generates a spell name, incantation, and visual lore.",
            i: "🔥",
          },
          {
            t: "Council Votes",
            d: "5 distinct LLM validators with rival personas score power, mana, element & rarity in parallel.",
            i: "⚖️",
          },
          {
            t: "Inscribe & Trade",
            d: "Approved spells are signed on GenLayer as NFTs. List, buy, and collect rare glyphs.",
            i: "💎",
          },
        ].map((c) => (
          <Card key={c.t} className="p-6 bg-card/60 border-primary/20 backdrop-blur">
            <div className="text-3xl">{c.i}</div>
            <h3 className="mt-3 font-serif text-xl font-bold">{c.t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{c.d}</p>
          </Card>
        ))}
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-24">
        <Card className="p-8 md:p-12 text-center bg-gradient-to-br from-primary/10 via-accent/10 to-primary/10 border-primary/30">
          <h2 className="font-serif text-3xl md:text-4xl font-bold">
            The Council awaits your incantation.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Connect your wallet, claim 500 $GLY from the faucet, and forge your first glyph.
          </p>
          <Button asChild size="lg" className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90">
            <Link to="/play">Enter the Forge →</Link>
          </Button>
        </Card>
      </section>

      <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground">
        Built on TanStack Start · GenLayer Studionet · Lovable AI Gateway
      </footer>
    </div>
  );
}
