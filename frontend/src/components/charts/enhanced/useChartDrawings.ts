/**
 * useChartDrawings.ts — 绘图工具 Hook
 * 封装所有绘图相关的状态和操作
 */
import { createSignal } from 'solid-js';
import {
  IChartApi, ISeriesApi, Time, PriceLineOptions, IPriceLine,
} from 'lightweight-charts';
import {
  Drawing, DrawingToolType, DrawPoint, TrendLine, FibonacciLine,
  RectangleAnnotation, TextAnnotation, AlertLine,
  FIB_COLORS, getFibPrices, isAlertTriggered,
  createTrendLine, createFibonacci, createRectangle, createAlertLine,
} from './DrawingTools';
import type { DailyBar } from '../../../hooks/useApi';

export interface UseChartDrawingsOptions {
  chartRef: () => IChartApi | undefined;
  bars: () => DailyBar[];
}

export function useChartDrawings(opts: UseChartDrawingsOptions) {
  const alertLineMap = new Map<string, ISeriesApi<'Line'>>();
  let drawingLines: Array<{ line: ISeriesApi<'Line'>; priceLine?: IPriceLine }> = [];

  const [activeTool, setActiveTool] = createSignal<DrawingToolType | null>(null);
  const [drawings, setDrawings] = createSignal<Drawing[]>([]);
  const [drawingPoints, setDrawingPoints] = createSignal<DrawPoint[]>([]);
  const [alertLines, setAlertLines] = createSignal<AlertLine[]>([]);

  function handleDrawingClick(time: Time, price: number) {
    const tool = activeTool();
    if (!tool) return;
    const pt: DrawPoint = { x: 0, y: 0, time, price };
    setDrawingPoints((prev) => [...prev, pt]);

    if (tool === 'alertline') {
      const al = createAlertLine(price);
      setAlertLines((prev) => [...prev, al]);
      setDrawings((prev) => [...prev, al]);
      renderDrawings();
      setDrawingPoints([]);
      return;
    }

    const pts = [...drawingPoints(), pt];
    if (pts.length < 2) return;
    let drawing: Drawing | null = null;
    if (tool === 'trendline') drawing = createTrendLine(pts[0], pts[1]);
    else if (tool === 'fibonacci') drawing = createFibonacci(pts[0], pts[1]);
    else if (tool === 'rectangle') drawing = createRectangle(pts[0], pts[1]);
    if (drawing) { setDrawings((prev) => [...prev, drawing!]); renderDrawings(); }
    setDrawingPoints([]);
  }

  function renderDrawings() {
    const chart = opts.chartRef();
    if (!chart) return;
    drawingLines.forEach(({ line }) => chart.removeSeries(line));
    drawingLines = [];

    drawings().forEach((d) => {
      if (!d.visible) return;
      if (d.type === 'trendline') {
        const dl = d as TrendLine;
        const line = chart.addLineSeries({ color: dl.color, lineWidth: 1, priceLineVisible: false });
        line.setData([{ time: dl.points[0].time, value: dl.points[0].price }, { time: dl.points[1].time, value: dl.points[1].price }]);
        drawingLines.push({ line });
      } else if (d.type === 'fibonacci') {
        const fb = d as FibonacciLine;
        const [p1, p2] = fb.points;
        const high = Math.max(p1.price, p2.price);
        const low = Math.min(p1.price, p2.price);
        getFibPrices(high, low, fb.levels).forEach(({ level, price }, i) => {
          const line = chart.addLineSeries({ color: FIB_COLORS[i % FIB_COLORS.length], lineWidth: level === 0.382 || level === 0.618 ? 2 : 1, priceLineVisible: false });
          line.setData([{ time: p1.time, value: price }, { time: p2.time, value: price }]);
          drawingLines.push({ line });
        });
      } else if (d.type === 'rectangle') {
        const rect = d as RectangleAnnotation;
        const [p1, p2] = rect.points;
        const high = Math.max(p1.price, p2.price);
        const low = Math.min(p1.price, p2.price);
        const line = chart.addLineSeries({ color: rect.color, lineWidth: 1, priceLineVisible: false });
        line.setData([
          { time: p1.time, value: high }, { time: p2.time, value: high },
          { time: p2.time, value: high }, { time: p2.time, value: low },
          { time: p2.time, value: low }, { time: p1.time, value: low },
          { time: p1.time, value: low }, { time: p1.time, value: high },
        ]);
        drawingLines.push({ line });
      } else if (d.type === 'text') {
        const txt = d as TextAnnotation;
        const line = chart.addLineSeries({ color: 'transparent', lineWidth: 1, priceLineVisible: false });
        line.setData([{ time: txt.point.time, value: txt.point.price }]);
        const priceLine = line.createPriceLine({ color: txt.color, lineVisible: false, title: txt.text } as PriceLineOptions & { title: string });
        drawingLines.push({ line, priceLine });
      } else if (d.type === 'alertline') {
        const al = d as AlertLine;
        if (alertLineMap.has(al.id)) { chart.removeSeries(alertLineMap.get(al.id)!); alertLineMap.delete(al.id); }
        const line = chart.addLineSeries({ color: al.triggered ? '#EF4444' : al.color, lineWidth: 1, lineStyle: 2, priceLineVisible: true, title: `⚠️ ¥${al.price.toFixed(2)}` });
        const arr = opts.bars();
        line.setData([
          { time: (arr[0]?.trade_date || 0) as Time, value: al.price },
          { time: (arr[arr.length - 1]?.trade_date || 0) as Time, value: al.price },
        ]);
        alertLineMap.set(al.id, line);
        drawingLines.push({ line });
      }
    });
  }

  function checkAlerts(price: number) {
    const triggered = alertLines().filter((a) => !a.triggered && isAlertTriggered(a, price));
    if (!triggered.length) return;
    triggered.forEach((a) => {
      setAlertLines((prev) => prev.map((al) => al.id === a.id ? { ...al, triggered: true } : al));
      console.warn(`[Alert] Price ${price} triggered alert at ¥${a.price}`);
    });
    renderDrawings();
  }

  function deleteDrawing(id: string) {
    setDrawings((prev) => prev.filter((d) => d.id !== id));
    const al = alertLines().find((a) => a.id === id);
    if (al) {
      setAlertLines((prev) => prev.filter((a) => a.id !== id));
      const s = alertLineMap.get(id);
      if (s) { opts.chartRef()?.removeSeries(s); alertLineMap.delete(id); }
    }
    renderDrawings();
  }

  function clearAllDrawings() {
    setDrawings([]); setAlertLines([]);
    alertLineMap.forEach((s) => opts.chartRef()?.removeSeries(s));
    alertLineMap.clear();
    drawingLines.forEach(({ line }) => opts.chartRef()?.removeSeries(line));
    drawingLines = [];
  }

  return {
    activeTool, setActiveTool,
    drawings, drawingPoints,
    alertLines,
    handleDrawingClick, renderDrawings, checkAlerts,
    deleteDrawing, clearAllDrawings,
  };
}
