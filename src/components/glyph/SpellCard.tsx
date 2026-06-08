import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Spell, Vote } from "@/lib/glyphwright.contract";
import { ELEMENT_HUE, RARITY_RING } from "./constants";

export function Stat({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: number;
  suffix?: string;
  accent: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-serif text-3xl font-bold ${accent}`}>
        {value}
        {suffix ?? ""}
      </div>
      <Progress value={value} className="mt-2 h-1" />
    </div>
  );
}

export function VoteCard({ vote }: { vote: Vote }) {
  return (
    <Card className="p-4 bg-card/60 border-border/60">
      <div className="flex items-center justify-between">
        <div className="font-serif font-semibold">{vote.validator}</div>
        <Badge
          variant="outline"
          className={
            vote.approve
              ? "border-emerald-400/60 text-emerald-300"
              : "border-destructive/60 text-destructive"
          }
        >
          {vote.approve ? "APPROVE" : "REJECT"}
        </Badge>
      </div>
      <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
        <span>PWR {vote.power}</span>
        <span>MANA {vote.mana_cost}</span>
        <span className="capitalize">{vote.element}</span>
        <span className="capitalize">{vote.rarity}</span>
      </div>
      <p className="mt-2 text-sm text-foreground/80 italic">"{vote.reasoning}"</p>
    </Card>
  );
}

export function GrimoireCard({
  spell,
  action,
}: {
  spell: Spell;
  action?: React.ReactNode;
}) {
  const ring = RARITY_RING[spell.consensus.rarity] ?? RARITY_RING.common;
  const hue = ELEMENT_HUE[spell.consensus.element] ?? ELEMENT_HUE.arcane;
  return (
    <Card className={`p-4 bg-gradient-to-br ${hue} border-border/60 ring-1 ${ring}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-serif font-semibold truncate">{spell.spellName}</div>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">
          {spell.consensus.element} · {spell.consensus.rarity}
        </span>
      </div>
      <p className="mt-1 text-xs italic text-foreground/70 line-clamp-2">"{spell.incantation}"</p>
      <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
        <span>PWR {spell.consensus.power}</span>
        <span>MANA {spell.consensus.mana_cost}</span>
        <span>APPR {Math.round(spell.consensus.approval * 100)}%</span>
      </div>
      <div className="mt-2 font-mono text-[10px] text-muted-foreground break-all">
        {spell.id} · {new Date(spell.forged_at * 1000).toLocaleDateString()}
      </div>
      {action ? <div className="mt-3">{action}</div> : null}
    </Card>
  );
}
