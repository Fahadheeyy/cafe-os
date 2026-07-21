/** Chef/kitchen chrome: mirrors OwnerShell but with the chef nav items. */
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, Coffee, Package, Inbox, Trash2, Menu, LayoutDashboard } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useStore } from "@/lib/store";
import { useAuth, useCurrentUser } from "@/hooks/use-auth";
import { PageErrorBoundary } from "@/components/error-boundary";

const nav = [
  { to: "/chef/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chef/stock", label: "Stock", icon: Package },
  { to: "/chef/requests", label: "Requests", icon: Inbox },
  { to: "/chef/waste", label: "Waste", icon: Trash2 },
] as const;

function Links({ onNav }: { onNav?: () => void }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <nav className="flex flex-col gap-1 p-3">
      {nav.map((item) => {
        const active = pathname === item.to || pathname.startsWith(item.to + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNav}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ChefShell({ children, title }: { children: ReactNode; title: string }) {
  const user = useCurrentUser();
  const { signOut, business } = useAuth();
  const settings = useStore((s) => s.settings);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const handleLogout = async () => { await signOut(); navigate({ to: "/login", replace: true }); };
  const displayName = business?.name ?? settings.restaurantName;

  return (
    <div className="min-h-dvh flex bg-background">
      <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r bg-sidebar">
        <div className="flex items-center gap-2 px-5 h-16 border-b">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Coffee className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{displayName}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Kitchen</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto"><Links /></div>
        <div className="border-t p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-accent text-accent-foreground text-xs font-semibold">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">Chef</p>
            </div>
            <button onClick={handleLogout} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 border-b bg-background/70 backdrop-blur flex items-center px-4 sm:px-6 sticky top-0 z-30">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden mr-2 min-h-11 min-w-11" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <VisuallyHidden>
                <SheetTitle>Navigation</SheetTitle>
                <SheetDescription>Kitchen navigation menu</SheetDescription>
              </VisuallyHidden>
              <div className="flex items-center gap-2 px-5 h-16 border-b">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <Coffee className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold">{displayName}</p>
              </div>
              <Links onNav={() => setOpen(false)} />
              <div className="p-3 border-t">
                <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <PageErrorBoundary boundary={`chef:${title}`}>{children}</PageErrorBoundary>
        </main>
      </div>
    </div>
  );
}
