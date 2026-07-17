import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useGlyphwrightAccount, shortAddr } from "@/lib/wallet";
import { formatGen } from "@/lib/glyphwright.contract";

const NAV = [
  { to: "/play", label: "Forge" },
  { to: "/grimoire", label: "Grimoire" },
  { to: "/market", label: "Market" },
] as const;

export function AppHeader() {
  const acc = useGlyphwrightAccount();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="sticky top-0 z-20 backdrop-blur bg-background/70 border-b border-border/40">
      <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="font-serif tracking-wide text-lg">Glyphwright</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => {
              const active = pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-1.5 rounded-md text-sm transition ${
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {acc.walletMode === "burner" ? (
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/40 hidden sm:inline-flex text-[10px]">
              Burner
            </Badge>
          ) : null}
          {acc.address ? (
            <>
              <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-primary/10 border border-primary/30 text-xs">
                <span className="text-primary font-semibold">
                  {acc.balance !== null ? formatGen(acc.balance) : "—"}
                </span>
                <span className="text-muted-foreground">GEN</span>
              </div>
              {acc.contractAddress ? (
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/40 hidden sm:inline-flex">
                  Studionet
                </Badge>
              ) : (
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/40 hidden sm:inline-flex">
                  Contract not set
                </Badge>
              )}
              <AccountPopover />
            </>
          ) : (
            <Button
              size="sm"
              onClick={acc.connect}
              disabled={acc.connecting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {acc.connecting ? "Connecting…" : "Connect Wallet"}
            </Button>
          )}
        </div>
      </div>
      <nav className="md:hidden flex items-center justify-center gap-1 pb-2 px-6">
        {NAV.map((n) => {
          const active = pathname === n.to;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`px-3 py-1 rounded-md text-xs transition ${
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
      {acc.error ? (
        <div className="mx-auto max-w-6xl px-6 pb-2 text-xs text-destructive truncate">
          {acc.error}
        </div>
      ) : null}

      <AlertDialog
        open={acc.needsMetaMask}
        onOpenChange={(open) => {
          if (!open) acc.dismissMetaMaskModal();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Connect a Wallet</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <span>
                  Glyphwright uses the GenLayer Snap for the best experience.
                  Choose how you'd like to connect:
                </span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => {
                acc.dismissMetaMaskModal();
                window.open("https://metamask.io/download/", "_blank");
              }}
              className="w-full"
            >
              Install MetaMask (Recommended)
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                acc.dismissMetaMaskModal();
                acc.connectBurner();
              }}
              className="w-full"
            >
              Continue with Temporary Wallet
            </Button>
          </div>
          <div className="flex justify-center">
            <button
              onClick={acc.dismissMetaMaskModal}
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              Cancel
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AccountPopover() {
  const acc = useGlyphwrightAccount();

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* ignore */
    }
  };

  if (!acc.address) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="px-3 py-1.5 rounded-md bg-secondary/60 border border-border/50 text-xs font-mono hover:bg-secondary transition">
          {shortAddr(acc.address)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Connected wallet
          </div>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 text-xs font-mono break-all">
              {acc.address}
            </code>
            <Button size="sm" variant="ghost" onClick={() => copy(acc.address!)}>
              Copy
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Balance</span>
          <span className="font-semibold">
            {acc.balance !== null ? formatGen(acc.balance) : "—"} GEN
          </span>
        </div>
        <div className="border-t border-border/40 pt-3">
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={acc.disconnect}
          >
            Disconnect
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
