import { useEffect, useRef } from "react";
import { ColorType, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import type { Candle } from "@/lib/types";

export function CandleChart({ candles }: { candles: Candle[] }) {
  const host = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a398b5",
        fontFamily: "IBM Plex Sans, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(44,38,64,0.65)" },
        horzLines: { color: "rgba(44,38,64,0.65)" },
      },
      rightPriceScale: { borderColor: "rgba(44,38,64,0.9)" },
      timeScale: { borderColor: "rgba(44,38,64,0.9)", timeVisible: true, secondsVisible: false },
      crosshair: { vertLine: { color: "#6b46c1" }, horzLine: { color: "#6b46c1" } },
    });
    const series = chart.addCandlestickSeries({
      upColor: "#12b981",
      downColor: "#ef4444",
      borderUpColor: "#12b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#12b981",
      wickDownColor: "#ef4444",
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;
    const data = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return <div ref={host} className="h-72 w-full" />;
}
