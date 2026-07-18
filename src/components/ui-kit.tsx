/**
 * Reusable UI primitives layered on top of shadcn/ui. Small, presentational,
 * dependency-light — safe to import from any route or feature component.
 *
 * Exports:
 *   - StatCard        KPI tile used across dashboards
 *   - SectionCard     Card with a title bar + optional icon and side action
 *   - EmptyState      Consistent zero-state message inside cards/lists
 *   - StatusPill      Colored pill for status labels (stock, orders, tables)
 *   - StatusDot       Colored dot for status indicators
 *   - PageHeader      Title + subtitle + right-aligned actions row
 *   - SearchInput     Left-icon search input with consistent height
 */
import { type ComponentType, type ReactNode } from "react";
import { Search, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/* ─────────────────────────── StatCard ─────────────────────────── */

export type StatTone = "default" | "success" | "warning" | "danger" | "info";

const toneClass: Record<StatTone, string> = {
  default: "",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
  info: "text-sky-600 dark:text-sky-400",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon | ComponentType<{ className?: string }>;
  tone?: StatTone;
  className?: string;
}) {
  return (
    <Card className={cn("p-4 rounded-2xl shadow-sm border", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
            {label}
          </p>
          <p className={cn("mt-1.5 text-xl font-semibold tracking-tight truncate", toneClass[tone])}>
            {value}
          </p>
        </div>
        {Icon && (
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </Card>
  );
}

/* ─────────────────────────── SectionCard ─────────────────────────── */

export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className,
  padding = "p-5",
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon | ComponentType<{ className?: string }>;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padding?: string;
}) {
  return (
    <Card className={cn(padding, "rounded-2xl shadow-sm border", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="sm:shrink-0 min-w-0">{action}</div>}
      </div>
      {children}
    </Card>
  );
}

/* ─────────────────────────── EmptyState ─────────────────────────── */

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className,
  compact = false,
}: {
  title?: string;
  description?: string;
  icon?: LucideIcon | ComponentType<{ className?: string }>;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "text-center text-muted-foreground",
        compact ? "py-6 text-sm" : "py-12 text-sm",
        className,
      )}
    >
      {Icon && (
        <div className="grid mx-auto h-10 w-10 place-items-center rounded-2xl bg-muted mb-3">
          <Icon className="h-5 w-5" />
        </div>
      )}
      {title && <p className="font-medium text-foreground">{title}</p>}
      {description && <p className="mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ─────────────────────────── StatusPill / StatusDot ─────────────────────────── */

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const pillTone: Record<StatusTone, string> = {
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  danger: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  neutral: "bg-muted text-muted-foreground",
};

export function StatusPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        pillTone[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const dotTone: Record<StatusTone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-sky-500",
  neutral: "bg-muted-foreground/40",
};

export function StatusDot({ tone = "neutral", className }: { tone?: StatusTone; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full", dotTone[tone], className)} aria-hidden />;
}

/* ─────────────────────────── PageHeader ─────────────────────────── */

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {title && <h2 className="text-lg font-semibold tracking-tight truncate">{title}</h2>}
        {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/* ─────────────────────────── SearchInput ─────────────────────────── */

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
      <Input
        aria-label={ariaLabel ?? placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 h-11"
      />
    </div>
  );
}
