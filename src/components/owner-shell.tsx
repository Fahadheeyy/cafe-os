/**
 * Owner app chrome: fixed sidebar on desktop, slide-out sheet on mobile,
 * plus a top bar and a `PageErrorBoundary` around the page content so a
 * broken widget can't blank the whole shell.
 */
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ClipboardList, Grid3x3, UtensilsCrossed, Users, Settings, LogOut, Coffee, Menu, Package, Inbox, ShoppingCart, Receipt, Trash2, FileBarChart, Activity } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useStore } from "@/lib/store";
import { useAuth, useCurrentUser } from "@/hooks/use-auth";
import { PageErrorBoundary } from "@/components/error-boundary";

const nav = [
  { to: "/owner/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/owner/operations", label: "Operations", icon: Activity },
  { to: "/owner/orders", label: "Orders", icon: ClipboardList },
  { to: "/owner/tables", label: "Tables", icon: Grid3x3 },
  { to: "/owner/menu", label: "Menu", icon: UtensilsCrossed },
  { to: "/owner/stock", label: "Stock", icon: Package },
  { to: "/owner/requests", label: "Requests", icon: Inbox },
  { to: "/owner/purchases", label: "Purchases", icon: ShoppingCart },
  { to: "/owner/expenses", label: "Expenses", icon: Receipt },
  { to: "/owner/waste", label: "Waste", icon: Trash2 },
  { to: "/owner/reports", label: "Reports", icon: FileBarChart },
  { to: "/owner/staff", label: "Staff", icon: Users },
  { to: "/owner/settings", label: "Settings", icon: Settings },
] as const;

function NavLinks({ onNav }: { onNav?: () => void }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <nav className="flex flex-col gap-0.5 p-3">
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

export function OwnerShell({ children, title }: { children: ReactNode; title: string }) {
  const user = useCurrentUser();
  const { signOut, business } = useAuth();
  const settings = useStore((s) => s.settings);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login", replace: true });
  };
  const displayName = business?.name ?? settings.restaurantName;

  return (
    <div className="min-h-dvh flex bg-background">
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r bg-sidebar">
        <div className="flex items-center gap-2 px-5 h-16 border-b">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Coffee className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{displayName}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Owner</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <div className="border-t p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-accent text-accent-foreground text-xs font-semibold">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
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
                <SheetDescription>Owner navigation menu</SheetDescription>
              </VisuallyHidden>
              <div className="flex items-center gap-2 px-5 h-16 border-b">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <Coffee className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold">{displayName}</p>
              </div>
              <NavLinks onNav={() => setOpen(false)} />
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
          <PageErrorBoundary boundary={`owner:${title}`}>{children}</PageErrorBoundary>
        </main>
      </div>
    </div>
  );
}
