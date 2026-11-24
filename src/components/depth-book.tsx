import { Area, AreaChart, ResponsiveContainer, XAxis } from "recharts";

export function ladder(price: number) {
  const bids = Array.from({ length: 7 }, (_, i) => {
    const px = price * (1 - (i + 1) * 0.0012);
    const size = 0.42 + ((i * 17) % 9) * 0.11;
    return { px, size, side: "bid" as const };
  });
  const asks = Array.from({ length: 7 }, (_, i) => {
    const px = price * (1 + (i + 1) * 0.0012);
    const size = 0.38 + ((i * 13) % 8) * 0.12;
    return { px, size, side: "ask" as const };
  });
  const depth = [
    ...bids
      .slice()
      .reverse()
      .map((row, i) => ({ i, bid: row.size * (8 - i), ask: 0 })),
    ...asks.map((row, i) => ({ i: i + 7, bid: 0, ask: row.size * (i + 2) })),
  ];
  return { bids, asks, depth };
}

export function DepthChart({ price }: { price: number }) {
  const { depth } = ladder(price);
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={depth}>
          <XAxis dataKey="i" hide />
          <Area type="monotone" dataKey="bid" stroke="#12b981" fill="#12b981" fillOpacity={0.25} />
          <Area type="monotone" dataKey="ask" stroke="#ef4444" fill="#ef4444" fillOpacity={0.22} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OrderBook({ price }: { price: number }) {
  const { bids, asks } = ladder(price);
  return (
    <div className="grid grid-cols-2 gap-3 text-xs tabular-nums">
      <div>
        <p className="mb-2 text-muted">Bids</p>
        {bids.map((row) => (
          <div key={row.px} className="flex justify-between py-1 text-buy">
            <span>{row.px.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
            <span>{row.size.toFixed(3)}</span>
          </div>
        ))}
      </div>
      <div>
        <p className="mb-2 text-muted">Asks</p>
        {asks.map((row) => (
          <div key={row.px} className="flex justify-between py-1 text-sell">
            <span>{row.px.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
            <span>{row.size.toFixed(3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
