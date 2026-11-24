import { Area, AreaChart, ResponsiveContainer } from "recharts";

export function sparkSeries(seed: number, points = 28): { i: number; v: number }[] {
  const rows: { i: number; v: number }[] = [];
  for (let i = 0; i < points; i += 1) {
    const wave = Math.sin(i * 0.55 + seed) * seed * 0.012;
    const trend = seed * (0.94 + (i / points) * 0.08);
    rows.push({ i, v: Math.max(trend + wave, seed * 0.5) });
  }
  return rows;
}

export function Sparkline({ seed, up }: { seed: number; up: boolean }) {
  const data = sparkSeries(Math.abs(seed) || 1);
  const color = up ? "#12b981" : "#ef4444";
  return (
    <div className="h-12 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <Area type="monotone" dataKey="v" stroke={color} fill={color} fillOpacity={0.18} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
