/**
 * Business analytics charts for the owner dashboard. Split into its own
 * module so recharts (~150 KB gz) can be lazy-loaded via `React.lazy`.
 */
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend } from "recharts";

export type ChartRow = {
  label: string;
  Revenue: number;
  Expenses: number;
  Purchases: number;
  Profit: number;
};

export default function BusinessCharts({ data }: { data: ChartRow[] }) {
  return (
    <>
      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="Revenue" stroke="var(--primary)" strokeWidth={2} fill="url(#rev)" />
            <Area type="monotone" dataKey="Profit" stroke="#10b981" strokeWidth={2} fill="transparent" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="h-40 sm:h-48 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Expenses" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            <Bar dataKey="Purchases" fill="#3b82f6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
