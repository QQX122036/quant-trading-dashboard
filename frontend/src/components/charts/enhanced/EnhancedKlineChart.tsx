/**
 * EnhancedKlineChart.tsx — 增强型K线图表（重构版）
 * 功能：复权切换 | 多股票对比 | 绘图工具 | 筹码分布 | 区间统计
 */
import { Component, createSignal, createEffect, onMount } from 'solid-js';
import { IChartApi, Time } from 'lightweight-charts';
import { fetchDailyBar, type DailyBar, MAJOR_INDICES } from '../../../hooks/useApi';
import { COMPARISON_COLORS } from './DrawingTools';
import { KLineCanvas } from './KLineCanvas';
import { ChartControls } from './ChartControls';
import { ChipChart } from './ChipChart';
import { RangeStatsPanel } from './RangeStatsPanel';
import { AlertBanner } from './AlertBanner';
import { ChartOverlays } from './ChartOverlays';
import { DrawingsPanel } from './DrawingsPanel';
import { CompareChart } from './CompareChart';
import { computeRangeStats, adjustBars, normalizeToStart, type RangeStats } from './chartUtils';
import { useChartDrawings } from './useChartDrawings';
import type { AdjustType } from './types';

// ── Types ────────────────────────────────────────────────────

// AdjustType re-exported from types.ts
export interface ComparedStock {
  ts_code: string;
  name: string;
  color: string;
  bars: DailyBar[];
  normalizedData: import('lightweight-charts').LineData<Time>[];
  series?: import('lightweight-charts').ISeriesApi<'Line'>;
}
export interface EnhancedKlineChartProps {
  tsCode?: string;
  name?: string;
  bars?: DailyBar[];
  onBarsLoaded?: (bars: DailyBar[]) => void;
  onCrosshairMove?: (time: Time | null) => void;
}

// ── Component ────────────────────────────────────────────────

export const EnhancedKlineChart: Component<EnhancedKlineChartProps> = (props) => {
  let chartRef: IChartApi | undefined;
  const [bars, setBars] = createSignal<DailyBar[]>([]);
  const [adjustedBars, setAdjustedBars] = createSignal<DailyBar[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [adjustType, setAdjustType] = createSignal<AdjustType>('none');
  const [comparedStocks, setComparedStocks] = createSignal<ComparedStock[]>([]);
  const [showCompare, setShowCompare] = createSignal(false);
  const [showChips, setShowChips] = createSignal(false);
  const [indexBars, setIndexBars] = createSignal<DailyBar[]>([]);
  const [visibleCount, setVisibleCount] = createSignal(0);
  const [totalCount, setTotalCount] = createSignal(0);
  const [selectingRange, setSelectingRange] = createSignal(false);
  const [rangeStart, setRangeStart] = createSignal<{ time: Time; price: number } | null>(null);
  const [_rangeSelection, setRangeSelection] = createSignal<{
    fromIndex: number;
    toIndex: number;
    fromTime: Time;
    toTime: Time;
  } | null>(null);
  const [rangeStats, setRangeStats] = createSignal<RangeStats | null>(null);

  const drawing = useChartDrawings({ chartRef: () => chartRef, bars });

  async function loadData() {
    const tsCode = props.tsCode || '600519.SH';
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDailyBar(tsCode, undefined, undefined, 100);
      if (res.code === '0' && res.data?.bars) {
        const raw = res.data.bars;
        setBars(raw);
        setAdjustedBars(adjustBars(raw, adjustType()));
        props.onBarsLoaded?.(raw);
        loadIndexBars();
      } else setError(res.message || '加载数据失败');
    } catch (e: unknown) {
      setError((e as Error)?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadIndexBars() {
    try {
      const res = await fetchDailyBar('000001.SH', undefined, undefined, 100);
      if (res.code === '0' && res.data?.bars) setIndexBars(res.data.bars);
    } catch {
      /* silent */
    }
  }

  async function loadComparedStock(tsCode: string) {
    try {
      const res = await fetchDailyBar(tsCode, undefined, undefined, 100);
      if (res.code === '0' && res.data?.bars) {
        const adj = adjustBars(res.data.bars, adjustType());
        const color = COMPARISON_COLORS[comparedStocks().length % COMPARISON_COLORS.length];
        const name = MAJOR_INDICES.find((i) => i.ts_code === tsCode)?.name || tsCode;
        setComparedStocks((p) => [
          ...p,
          { ts_code: tsCode, name, color, bars: adj, normalizedData: normalizeToStart(adj) },
        ]);
      }
    } catch {
      /* silent */
    }
  }

  function handleChartReady(c: IChartApi) {
    chartRef = c;
  }

  function handleCrosshairMove(time: Time | null, price?: number) {
    props.onCrosshairMove?.(time);
    if (price !== undefined) drawing.checkAlerts(price);
  }

  function handleChartClick(param: {
    time?: Time;
    point?: { x: number; y: number; price: number };
  }) {
    if (!param.time || !param.point || (!drawing.activeTool() && !selectingRange())) return;
    if (selectingRange()) {
      handleRangeSelect(param.time, param.point.price);
      return;
    }
    drawing.handleDrawingClick(param.time, param.point.price);
  }

  function handleRangeSelect(time: Time, price: number) {
    if (!selectingRange()) {
      setRangeStart({ time, price });
      setSelectingRange(true);
      return;
    }
    const start = rangeStart();
    if (!start) {
      setSelectingRange(false);
      return;
    }
    const all = adjustedBars();
    const fromIdx = all.findIndex((b) => Number(b.trade_date as unknown as number) >= Number(time));
    const toIdx = all.findIndex(
      (b) => Number(b.trade_date as unknown as number) >= Number(start.time)
    );
    const [mn, mx] = [Math.min(fromIdx, toIdx), Math.max(fromIdx, toIdx)];
    if (mn >= 0 && mx >= 0) {
      setRangeSelection({ fromIndex: mn, toIndex: mx, fromTime: start.time, toTime: time });
      setRangeStats(computeRangeStats(all, mn, mx, indexBars()));
    }
    setSelectingRange(false);
    setRangeStart(null);
  }

  function zoomIn() {
    if (!chartRef) return;
    const ts = chartRef.timeScale();
    const vr = ts.getVisibleRange();
    if (!vr) return;
    const c = ((vr.from as number) + (vr.to as number)) / 2;
    const h = ((vr.to as number) - (vr.from as number)) * 0.35;
    ts.setVisibleRange({ from: (c - h) as Time, to: (c + h) as Time });
  }

  function zoomOut() {
    if (!chartRef) return;
    const ts = chartRef.timeScale();
    const vr = ts.getVisibleRange();
    if (!vr) return;
    const c = ((vr.from as number) + (vr.to as number)) / 2;
    const h = ((vr.to as number) - (vr.from as number)) * 0.7;
    ts.setVisibleRange({ from: (c - h) as Time, to: (c + h) as Time });
  }

  function handleAdjustChange(type: AdjustType) {
    setAdjustType(type);
    setAdjustedBars(adjustBars(bars(), type));
  }

  onMount(() => {
    if (!props.bars) loadData();
  });

  createEffect(() => {
    if (props.bars && props.bars.length > 0) {
      setBars(props.bars);
      setAdjustedBars(adjustBars(props.bars, adjustType()));
    }
  });

  createEffect(() => {
    drawing.renderDrawings();
  });

  function getTooltipText(): string | null {
    if (selectingRange()) return '📊 点击K线左键选择区间起点，再点击选择终点';
    if (!drawing.activeTool()) return null;
    const m: Record<string, string> = {
      trendline: '趋势线',
      fibonacci: '斐波那契',
      rectangle: '矩形',
      text: '文字',
      alertline: '预警线',
    };
    return `点击K线设置${m[drawing.activeTool()!]}起点，再点击设置终点`;
  }

  return (
    <div class="relative w-full h-full flex flex-col">
      <ChartControls
        adjustType={adjustType()}
        onAdjustChange={handleAdjustChange}
        activeTool={drawing.activeTool()}
        onToolChange={drawing.setActiveTool}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        selectingRange={selectingRange()}
        onToggleRange={() => {
          setSelectingRange(!selectingRange());
          setRangeStart(null);
        }}
        showChips={showChips()}
        onToggleChips={() => setShowChips(!showChips())}
        showCompare={showCompare()}
        onToggleCompare={() => setShowCompare(!showCompare())}
        comparedStocks={comparedStocks()}
        onAddComparedStock={(code) =>
          !comparedStocks().some((s) => s.ts_code === code) && loadComparedStock(code)
        }
        onRemoveComparedStock={(code) =>
          setComparedStocks((p) => p.filter((s) => s.ts_code !== code))
        }
        visibleCount={visibleCount()}
        totalCount={totalCount()}
        drawingsCount={drawing.drawings().length}
        onClearDrawings={drawing.clearAllDrawings}
      />

      <div class="flex-1 flex min-h-0">
        <KLineCanvas
          bars={adjustedBars()}
          adjustType={adjustType()}
          onCrosshairMove={handleCrosshairMove}
          onChartReady={handleChartReady}
          onChartClick={handleChartClick}
          onVisibleRangeChange={(v, t) => {
            setVisibleCount(v);
            setTotalCount(t);
          }}
          zoomIn={zoomIn}
          zoomOut={zoomOut}
        />
        <ChipChart show={showChips()} bars={adjustedBars()} />
      </div>

      <CompareChart
        show={showCompare()}
        comparedStocks={comparedStocks()}
        bars={bars()}
        adjustType={adjustType()}
        onRemoveStock={(code) => setComparedStocks((p) => p.filter((s) => s.ts_code !== code))}
      />

      <RangeStatsPanel
        stats={rangeStats()}
        onClear={() => {
          setRangeSelection(null);
          setRangeStats(null);
        }}
      />
      <AlertBanner alertLines={drawing.alertLines()} />
      <ChartOverlays loading={loading()} error={error()} tooltipText={getTooltipText()} />
      <DrawingsPanel drawings={drawing.drawings()} onDelete={drawing.deleteDrawing} />
    </div>
  );
};
