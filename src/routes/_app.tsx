import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppHeader } from "@/components/glyph/AppHeader";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <div
      className="min-h-screen text-foreground"
      style={{ background: "var(--gradient-arcane), var(--color-background)" }}
    >
      <AppHeader />
      <Outlet />
    </div>
  );
}
