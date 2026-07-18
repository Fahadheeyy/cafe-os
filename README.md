# CafeOS

Lightning-fast POS + business-management SaaS for small cafés, tea shops, juice
shops, and bakeries. Built on TanStack Start (React 19, Vite 7), TypeScript,
Tailwind v4, shadcn/ui, Zustand, and Recharts. Everything is client-side and
persists to `localStorage` — no backend is required to demo the app.

## Demo accounts

| Role  | Email             | Password  |
| ----- | ----------------- | --------- |
| Owner | owner@cafe.com    | owner123  |
| Staff | staff@cafe.com    | staff123  |
| Chef  | chef@cafe.com     | chef123   |

## Roles

- **Owner** — full access: Dashboard, Orders, Tables, Menu, Staff, Stock,
  Purchase Requests, Purchases, Expenses, Waste, Reports, Settings.
- **Staff** — Dashboard + POS order screen only.
- **Chef** — Kitchen dashboard, stock updates, purchase requests, waste log.
  No financial data.

`AuthGuard` enforces role-based access on every protected route and redirects
mismatched users to their own home dashboard.

## Project layout

```
src/
├── routes/               # File-based routing (TanStack Router auto-generated tree)
│   ├── __root.tsx        # HTML shell, providers, root error/notfound boundaries
│   ├── login.tsx         # /login
│   ├── index.tsx         # / — redirects to the right dashboard by role
│   ├── staff.tsx         # /staff — staff table grid
│   ├── order.$tableId.tsx# /order/:tableId — POS order screen
│   ├── owner.*.tsx       # /owner/... — owner routes (dashboard, menu, stock, …)
│   └── chef.*.tsx        # /chef/...  — chef routes (dashboard, stock, requests, waste)
│
├── components/
│   ├── auth-guard.tsx    # Role-based route protection
│   ├── owner-shell.tsx   # Owner sidebar + top bar + PageErrorBoundary
│   ├── chef-shell.tsx    # Chef sidebar + top bar + PageErrorBoundary
│   ├── error-boundary.tsx# Reusable PageErrorBoundary class component
│   ├── business-charts.tsx # Recharts area/bar charts (lazy-loaded)
│   ├── stock-manager.tsx # Shared stock view (owner + chef)
│   ├── requests-view.tsx # Shared purchase-requests view (owner + chef)
│   ├── waste-view.tsx    # Shared waste log (owner + chef)
│   └── ui/               # shadcn/ui primitives (Button, Card, Dialog, …)
│
└── lib/
    ├── store.ts          # Zustand store + all domain types + seed data
    ├── selectors.ts      # useShallow-backed selectors + derivations
    ├── pricing.ts        # Pure order / purchase math (subtotal, tax, total)
    ├── format.ts         # money(), shortDate(), shortTime(), dateTime()
    ├── date-range.ts     # todayRange / weekRange / monthRange helpers
    ├── notify.ts         # notify.* toasts + tryRun() unified error handling
    ├── print.ts          # 80mm thermal-receipt printer via window.print
    ├── error-boundary.ts # (in components/) — see above
    ├── error-capture.ts  # Global unhandled-error listeners (SSR safety)
    ├── error-page.ts     # Bare-metal HTML fallback for catastrophic SSR failures
    └── lovable-error-reporting.ts # Forwards Errors to Lovable capture
```

## Data model

All domain types live in `src/lib/store.ts` — start there when reading the
codebase. Key entities:

- `User` (role: owner / staff / chef)
- `Product` + `Category` (Tea / Coffee / Snacks / …)
- `Table` (available / occupied / bill_ready)
- `Order` + `OrderItem` + `PaymentMethod` (upi / cash)
- `StockItem` + `StockHistory` (kind: update / purchase / waste)
- `PurchaseRequest` (pending / approved / purchased / rejected)
- `Purchase` + `PurchaseLine` — recording a purchase updates stock, writes
  history, and creates a matching `Expense`.
- `Expense` (categories: Rent / Salary / Gas / Purchases / …)
- `WasteEntry` — deducts stock and estimates cost from last purchase rate.

## Error handling

Four layers:

1. **Input validation** in every store mutation (`addStaff`, `addProduct`,
   `recordPurchase`, `addWaste`, …) — throws `Error` with a friendly message.
2. **`tryRun(fn, { success, error })`** in `src/lib/notify.ts` wraps every
   user-triggered action, toasting failures and forwarding `Error`s to
   Lovable capture.
3. **`PageErrorBoundary`** inside `OwnerShell` and `ChefShell` catches render
   failures inside a page and shows a "Try again / Reload" card while keeping
   the sidebar alive.
4. **Root `errorComponent` + `notFoundComponent`** in `__root.tsx` catch
   anything the page boundary misses.

## Performance

- **Recharts is lazy-loaded** on the owner dashboard, keeping the initial
  chunk lean.
- **Zustand atomic selectors** everywhere — components only re-render when
  their specific slice changes. Multi-slice reads use `useShallow` via
  `src/lib/selectors.ts`.
- **Automatic route code-splitting** courtesy of the TanStack Router Vite
  plugin. Route components live inside `createFileRoute()` and are never
  exported, so each page ships as its own chunk.

## Printing

`printBill(order, settings)` in `src/lib/print.ts` opens a 380 × 640 popup
containing 80mm-formatted HTML and calls `window.print()`. Throws a friendly
error when the browser blocks the popup; callers route it through `tryRun`
so the user sees "Please allow pop-ups for this site" as a toast.

## Local development

```bash
bun install
bun run dev
```

The Vite dev server is already running inside the Lovable sandbox at
`http://localhost:8080`.
