import ec from '@/lib/echarts';
import type { EChartsType } from '@/lib/echarts';
import { Component, createSignal, createMemo, onMount, onCleanup, For } from 'solid-js';
import {
  createSolidTable,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/solid-table';
import { state } from '../../stores';
import { useMarketWS } from '../../hooks/useWebSocket';
import { fetchPositions } from '../../hooks/useApi';
import { logger } from '../../lib/logger';
import { formatPrice } from '../../utils/format';
import { directionBg, pnlColor } from '../../utils/color';
import type { PositionData } from '../../types/vnpy';

// ── Sector inferrer (mirrors PortfolioOverview) ──────────────
const SECTOR_COLORS: Record<string, string> = {
  白酒: '#60A5FA',
  银行: '#34D399',
  科技: '#6366F1',
  医药: '#F87171',
  消费: '#FBBF24',
  新能源: '#38BDF8',
  房地产: '#FB923C',
  券商: '#A78BFA',
  军工: '#E879F9',
  其他: '#6B7280',
};
const SECTOR_COLOR_LIST = Object.values(SECTOR_COLORS);

function inferSector(symbol: string): string {
  const s2s: Record<string, string> = {
    '000': '消费',
    '001': '消费',
    '002': '科技',
    '003': '医药',
    '300': '医药',
    '301': '科技',
    '688': '科技',
    '688001': '白酒',
    '600519': '白酒',
    '600036': '银行',
    '600000': '银行',
    '601318': '券商',
    '600016': '银行',
  };
  return s2s[symbol] ?? '其他';
}

type PositionRow = PositionData;

// ── Column helper ───────────────────────────────────────────
const colHelper = createColumnHelper<PositionRow>();

// ── Threshold for highlight ──────────────────────────────────
const HIGH_POSITION_PCT = 10; // % of total market value

export const PositionMonitor: Component = () => {
  useMarketWS();

  const [sorting, setSorting] = createSignal<{ id: string; desc: boolean }[]>([]);
  const [showCharts, setShowCharts] = createSignal(true);
  const [selectedSector, setSelectedSector] = createSignal<string | null>(null);

  // ── Derived data ─────────────────────────────────────────
  const positionRows = createMemo<PositionRow[]>(() => Object.values(state.positions.items));

  const totalMarketValue = createMemo(() =>
    positionRows().reduce((sum, p) => sum + p.volume * (p.price || 0), 0)
  );

  const totalPnl = createMemo(() => positionRows().reduce((sum, p) => sum + (p.pnl || 0), 0));

  // Per-stock position weight (% of total MV)
  const stockWeightRows = createMemo(() =>
    positionRows()
      .map((p) => ({
        ...p,
        mv: p.volume * (p.price || 0),
        weight: 0,
      }))
      .map((p) => ({
        ...p,
        weight: totalMarketValue() > 0 ? (p.mv / totalMarketValue()) * 100 : 0,
      }))
      .filter((p) => p.mv > 0)
      .sort((a, b) => b.weight - a.weight)
  );

  // High-weight positions (>HIGH_POSITION_PCT %)
  const highWeightPositions = createMemo(() =>
    stockWeightRows().filter((p) => p.weight >= HIGH_POSITION_PCT)
  );

  // Industry distribution for pie chart
  const industryPieData = createMemo(() => {
    const map = new Map<string, number>();
    for (const p of positionRows()) {
      const mv = p.volume * (p.price || 0);
      if (mv <= 0) continue;
      const sector = inferSector(p.symbol);
      map.set(sector, (map.get(sector) ?? 0) + mv);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  });

  // ── Table columns ─────────────────────────────────────────
  const columns = [
    colHelper.accessor('symbol', {
      header: '合约',
      size: 90,
      cell: (info) => <span class="text-xs text-[var(--text-primary)]">{info.getValue()}</span>,
    }),
    colHelper.accessor('exchange', {
      header: '交易所',
      size: 60,
      cell: (info) => <span class="text-xs text-[var(--text-secondary)]">{info.getValue()}</span>,
    }),
    colHelper.accessor('direction', {
      header: '方向',
      size: 55,
      cell: (info) => {
        const val = info.getValue();
        return (
          <span
            class={`inline-block px-1 py-0.5 rounded text-[10px] font-bold ${directionBg(val)}`}
          >
            {val}
          </span>
        );
      },
    }),
    colHelper.accessor('volume', {
      header: '数量',
      size: 65,
      cell: (info) => (
        <span class="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
          {info.getValue()}
        </span>
      ),
    }),
    colHelper.accessor('yd_position', {
      header: '昨仓',
      size: 55,
      cell: (info) => (
        <span class="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
          {info.getValue()}
        </span>
      ),
    }),
    colHelper.accessor('frozen', {
      header: '冻结',
      size: 55,
      cell: (info) => (
        <span class="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
          {info.getValue()}
        </span>
      ),
    }),
    colHelper.accessor('price', {
      header: '均价',
      size: 90,
      cell: (info) => (
        <span class="text-xs font-mono tabular-nums text-[var(--text-primary)]">
          {formatPrice(info.getValue())}
        </span>
      ),
    }),
    colHelper.display({
      id: 'weight',
      header: '占比',
      size: 60,
      cell: (info) => {
        const row = info.row.original;
        const mv = row.volume * (row.price || 0);
        const weight = totalMarketValue() > 0 ? (mv / totalMarketValue()) * 100 : 0;
        const isHigh = weight >= HIGH_POSITION_PCT;
        return (
          <span
            class={`text-xs font-mono tabular-nums ${isHigh ? 'text-amber-400 font-bold' : 'text-[var(--text-secondary)]'}`}
            title={isHigh ? `⚠️ 高集中度持仓 ${weight.toFixed(1)}%` : ''}
          >
            {weight.toFixed(1)}%
          </span>
        );
      },
    }),
    colHelper.accessor('pnl', {
      header: '盈亏',
      size: 90,
      cell: (info) => {
        const pnl = info.getValue();
        return (
          <span class={`text-xs font-mono tabular-nums ${pnlColor(pnl)}`}>
            {pnl >= 0 ? '+' : ''}
            {formatPrice(pnl)}
          </span>
        );
      },
    }),
  ];

  const table = createSolidTable<PositionRow>({
    get data() {
      return positionRows();
    },
    columns,
    state: { sorting: sorting() },
    onSortingChange: (updater) => {
      const val = typeof updater === 'function' ? updater(sorting()) : updater;
      setSorting(val as typeof sorting extends () => infer R ? R : never);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const sortIcon = (colId: string) => {
    const s = sorting().find((s) => s.id === colId);
    if (!s) return '↕';
    return s.desc ? '↓' : '↑';
  };

  // ── ECharts refs ─────────────────────────────────────────
  let pieContainer: HTMLDivElement | undefined;
  let weightContainer: HTMLDivElement | undefined;
  let pieChart: EChartsType | undefined;
  let weightChart: EChartsType | undefined;

  // ── Pie chart (industry distribution) ───────────────────
  function buildPieOption() {
    const data = industryPieData();
    if (data.length === 0) return null;
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1f2937',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number; percent: number; color: string };
          const mv = p.value;
          const mvStr = mv >= 1e8 ? `${(mv / 1e8).toFixed(1)}亿` : `${(mv / 1e4).toFixed(0)}万`;
          return `<span style="color:${p.color}">●</span> ${p.name} <b>${mvStr}</b> (${p.percent.toFixed(1)}%)`;
        },
      },
      legend: {
        orient: 'vertical',
        right: 8,
        top: 'middle',
        textStyle: { color: '#9CA3AF', fontSize: 11 },
        itemWidth: 10,
        itemHeight: 10,
        formatter: (name: string) => {
          const item = data.find((d) => d.name === name);
          if (!item) return name;
          const total = data.reduce((s, d) => s + d.value, 0);
          const pct = ((item.value / total) * 100).toFixed(0);
          return `${name} ${pct}%`;
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 4, borderColor: '#0A0E17', borderWidth: 2 },
          label: { show: false },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' },
            label: { show: true, fontSize: 12, fontWeight: 'bold', color: '#fff' },
          },
          data: data.map((d, i) => ({
            name: d.name,
            value: d.value,
            itemStyle: { color: SECTOR_COLOR_LIST[i % SECTOR_COLOR_LIST.length] },
          })),
        },
      ],
    };
  }

  // Sector detail data
  const sectorPositions = createMemo(() => {
    const sector = selectedSector();
    if (!sector) return [];
    return positionRows()
      .filter((p) => inferSector(p.symbol) === sector)
      .map((p) => ({
        ...p,
        mv: p.volume * (p.price || 0),
        weight:
          totalMarketValue() > 0 ? ((p.volume * (p.price || 0)) / totalMarketValue()) * 100 : 0,
      }))
      .sort((a, b) => b.mv - a.mv);
  });

  const sectorTotalMV = createMemo(() => sectorPositions().reduce((s, p) => s + p.mv, 0));

  const sectorTotalPnl = createMemo(() => sectorPositions().reduce((s, p) => s + (p.pnl || 0), 0));

  // ── Horizontal bar chart (single-stock weight) ────────────
  function buildWeightBarOption() {
    const rows = stockWeightRows().slice(0, 12); // top 12
    if (rows.length === 0) return null;
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#1f2937',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: (params: unknown) => {
          const arr = params as Array<{
            name: string;
            value: number;
            itemStyle: { color: string };
          }>;
          if (!arr?.length) return '';
          const p = arr[0];
          const mv = rows.find((r) => r.symbol === p.name)?.mv ?? 0;
          const mvStr = mv >= 1e8 ? `${(mv / 1e8).toFixed(1)}亿` : `${(mv / 1e4).toFixed(0)}万`;
          return `<b>${p.name}</b><br/>市值: ${mvStr}<br/>占比: <b>${p.value.toFixed(1)}%</b>`;
        },
      },
      grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        max: Math.max(100, ...rows.map((r) => r.weight)) * 1.1,
        axisLabel: { color: '#6B7280', fontSize: 10, formatter: (v: number) => `${v.toFixed(0)}%` },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      yAxis: {
        type: 'category',
        data: rows.map((r) => r.symbol),
        axisLabel: { color: '#9CA3AF', fontSize: 11 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: rows.map((r) => ({
            value: r.weight,
            itemStyle: {
              color:
                r.weight >= HIGH_POSITION_PCT
                  ? new ec.graphic.LinearGradient(0, 0, 1, 0, [
                      { offset: 0, color: '#F59E0B' },
                      { offset: 1, color: '#EF4444' },
                    ])
                  : new ec.graphic.LinearGradient(0, 0, 1, 0, [
                      { offset: 0, color: '#3B82F6' },
                      { offset: 1, color: '#6366F1' },
                    ]),
              borderRadius: [0, 4, 4, 0],
            },
          })),
          barMaxWidth: 16,
          label: {
            show: true,
            position: 'right',
            formatter: (params: unknown) => {
              const p = params as { value: number };
              return `${p.value.toFixed(1)}%`;
            },
            color: '#9CA3AF',
            fontSize: 10,
          },
        },
      ],
    };
  }

  let initRetryCount = 0;
  const MAX_INIT_RETRIES = 10;

  function initCharts() {
    if (!showCharts()) return;

    // 检查 DOM 元素是否存在
    if (!pieContainer || !weightContainer) {
      if (initRetryCount < MAX_INIT_RETRIES) {
        initRetryCount++;
        setTimeout(initCharts, 100);
      } else {
        console.warn('[PositionMonitor] 达到最大重试次数，停止初始化图表');
      }
      return;
    }

    // 检查 DOM 元素是否有正确的尺寸
    if (pieContainer.clientWidth === 0 || weightContainer.clientWidth === 0) {
      if (initRetryCount < MAX_INIT_RETRIES) {
        initRetryCount++;
        setTimeout(initCharts, 100);
      } else {
        console.warn('[PositionMonitor] DOM 元素尺寸一直为 0，停止初始化图表');
      }
      return;
    }

    // 重置重试计数
    initRetryCount = 0;

    if (!pieChart) {
      pieChart = ec.init(pieContainer, 'dark');
      // Click on pie sector → show detail
      pieChart.on('click', (params: unknown) => {
        const p = params as { name: string };
        if (p?.name) {
          setSelectedSector((prev) => (prev === p.name ? null : p.name));
        }
      });
    }
    if (!weightChart) {
      weightChart = ec.init(weightContainer, 'dark');
    }

    const pieOpt = buildPieOption();
    if (pieChart && pieOpt) {
      pieChart.setOption(pieOpt, true);
    }
    const barOpt = buildWeightBarOption();
    if (weightChart && barOpt) {
      weightChart.setOption(barOpt, true);
    }
  }

  function resizeCharts() {
    pieChart?.resize();
    weightChart?.resize();
  }

  // ── Lifecycle ─────────────────────────────────────────────
  onMount(async () => {
    try {
      const res = await fetchPositions();
      if (res.code === '0' && res.data?.positions) {
        for (const pos of res.data.positions) {
          state.positions.items[pos.vt_positionid] = pos;
        }
      }
    } catch (e) {
      logger.warn('[PositionMonitor] fetchPositions error', { error: e });
    }

    // Small delay to ensure containers are sized
    setTimeout(initCharts, 50);
    window.addEventListener('resize', resizeCharts);
  });

  onCleanup(() => {
    window.removeEventListener('resize', resizeCharts);
    pieChart?.dispose();
    weightChart?.dispose();
  });

  // Re-render charts when data changes
  const _chartUpdater = createMemo(() => {
    positionRows(); // track
    setTimeout(() => {
      initCharts();
      resizeCharts();
    }, 30);
    return null;
  });

  // ── Render helpers ────────────────────────────────────────
  const headerRows = table.getHeaderGroups();
  const rowModel = table.getRowModel();

  const highCount = () => highWeightPositions().length;

  return (
    <div class="h-full flex flex-col overflow-hidden relative">
      {/* ── Toolbar ─────────────────────────────────────── */}
      <div class="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-color)]">
        <div class="flex items-center gap-3">
          <button
            onClick={() => {
              setShowCharts((v) => !v);
              if (!showCharts()) {
                pieChart?.dispose();
                pieChart = undefined;
                weightChart?.dispose();
                weightChart = undefined;
              } else {
                setTimeout(initCharts, 30);
              }
            }}
            class="text-xs px-2 py-0.5 rounded border border-white/10 hover:bg-white/5 transition-colors text-[var(--text-secondary)]"
          >
            {showCharts() ? '隐藏' : '显示'}分布图
          </button>

          {/* High-position warning badge */}
          {highCount() > 0 && (
            <span class="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <span>⚠️</span>
              <span>
                {highCount()} 只持仓 &gt;{HIGH_POSITION_PCT}%
              </span>
            </span>
          )}
        </div>

        <div class="flex items-center gap-4 text-xs">
          <span class="text-[var(--text-muted)]">总盈亏:</span>
          <span class={`font-bold tabular-nums ${pnlColor(totalPnl())}`}>
            {totalPnl() >= 0 ? '+' : ''}
            {formatPrice(totalPnl())}
          </span>
        </div>
      </div>

      {/* ── Main content: table + charts ────────────────── */}
      <div class="flex-1 flex overflow-hidden min-h-0">
        {/* Table panel */}
        <div
          class={`flex-1 overflow-auto ${showCharts() ? 'border-r border-[var(--border-color)]' : ''}`}
        >
          <table class="w-full border-collapse text-xs">
            <thead class="sticky top-0 z-10 bg-[var(--bg-tertiary)]">
              <For each={headerRows}>
                {(headerGroup) => (
                  <tr>
                    <For each={headerGroup.headers}>
                      {(header) => (
                        <th
                          class="px-1.5 py-2 text-[var(--text-muted)] font-normal border-b border-[var(--border-color)] whitespace-nowrap cursor-pointer select-none"
                          style={{ width: `${header.getSize()}px` }}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <span class="inline-flex items-center gap-0.5">
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                            <span class="text-[10px]">{sortIcon(header.column.id)}</span>
                          </span>
                        </th>
                      )}
                    </For>
                  </tr>
                )}
              </For>
            </thead>
            <tbody>
              {rowModel.rows.length === 0 ? (
                <tr>
                  <td colspan={columns.length} class="text-center py-8 text-[var(--text-muted)]">
                    暂无持仓
                  </td>
                </tr>
              ) : (
                rowModel.rows.map((row) => {
                  const rowMV = row.original.volume * (row.original.price || 0);
                  const rowWeight = totalMarketValue() > 0 ? (rowMV / totalMarketValue()) * 100 : 0;
                  const isHigh = rowWeight >= HIGH_POSITION_PCT;
                  return (
                    <tr
                      class={`border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors ${isHigh ? 'bg-amber-500/5' : ''}`}
                    >
                      <For each={row.getVisibleCells()}>
                        {(cell) => (
                          <td class="px-1.5 py-1.5" style={{ width: `${cell.column.getSize()}px` }}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        )}
                      </For>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Charts panel */}
        {showCharts() && (
          <div class="w-72 flex flex-col shrink-0 overflow-hidden">
            {/* Sector pie chart */}
            <div class="flex-1 min-h-0 flex flex-col">
              <div class="px-3 py-1.5 text-xs text-[var(--text-muted)] border-b border-[var(--border-color)]">
                行业分布
              </div>
              <div
                class="flex-1 min-h-0 w-full"
                ref={pieContainer!}
                style={{ 'min-height': '200px' }}
              />
            </div>

            {/* Stock weight bar chart */}
            <div class="flex-1 min-h-0 flex flex-col">
              <div class="px-3 py-1.5 text-xs text-[var(--text-muted)] border-b border-[var(--border-color)]">
                单股持仓占比 Top12
              </div>
              <div
                class="flex-1 min-h-0 w-full"
                ref={weightContainer!}
                style={{ 'min-height': '200px' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Sector Detail Panel ─────────────────────────────── */}
      {selectedSector() && (
        <div class="absolute inset-0 z-20 bg-[#0A0E17]/95 flex items-center justify-center p-6">
          <div class="bg-[#111827] rounded-xl border border-white/20 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-[var(--text-primary)]">{selectedSector()}</span>
                <span class="text-xs text-[var(--text-muted)]">行业持仓明细</span>
                <span class="px-1.5 py-0.5 text-[10px] rounded-full bg-white/10 text-[var(--text-secondary)]">
                  {sectorPositions().length} 只
                </span>
              </div>
              <div class="flex items-center gap-4 text-xs">
                <span class="text-[var(--text-muted)]">行业市值:</span>
                <span class="font-bold tabular-nums text-[var(--text-primary)]">
                  {sectorTotalMV() >= 1e8
                    ? `${(sectorTotalMV() / 1e8).toFixed(2)}亿`
                    : `${(sectorTotalMV() / 1e4).toFixed(0)}万`}
                </span>
                <span class="text-[var(--text-muted)]">行业盈亏:</span>
                <span class={`font-bold tabular-nums ${pnlColor(sectorTotalPnl())}`}>
                  {sectorTotalPnl() >= 0 ? '+' : ''}
                  {formatPrice(sectorTotalPnl())}
                </span>
                <button
                  onClick={() => setSelectedSector(null)}
                  class="ml-2 w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            {/* Detail table */}
            <div class="flex-1 overflow-auto">
              <table class="w-full border-collapse text-xs">
                <thead class="sticky top-0 z-10 bg-[var(--bg-tertiary)]">
                  <tr>
                    <th class="px-3 py-2 text-left text-[var(--text-muted)] font-normal border-b border-[var(--border-color)]">
                      合约
                    </th>
                    <th class="px-3 py-2 text-right text-[var(--text-muted)] font-normal border-b border-[var(--border-color)]">
                      数量
                    </th>
                    <th class="px-3 py-2 text-right text-[var(--text-muted)] font-normal border-b border-[var(--border-color)]">
                      均价
                    </th>
                    <th class="px-3 py-2 text-right text-[var(--text-muted)] font-normal border-b border-[var(--border-color)]">
                      市值
                    </th>
                    <th class="px-3 py-2 text-right text-[var(--text-muted)] font-normal border-b border-[var(--border-color)]">
                      占比
                    </th>
                    <th class="px-3 py-2 text-right text-[var(--text-muted)] font-normal border-b border-[var(--border-color)]">
                      盈亏
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <For each={sectorPositions()}>
                    {(p) => (
                      <tr class="border-b border-[var(--border-color)] hover:bg-white/5 transition-colors">
                        <td class="px-3 py-2 text-[var(--text-primary)]">{p.symbol}</td>
                        <td class="px-3 py-2 text-right text-[var(--text-secondary)] font-mono tabular-nums">
                          {p.volume}
                        </td>
                        <td class="px-3 py-2 text-right text-[var(--text-secondary)] font-mono tabular-nums">
                          {formatPrice(p.price || 0)}
                        </td>
                        <td class="px-3 py-2 text-right text-[var(--text-secondary)] font-mono tabular-nums">
                          {p.mv >= 1e8
                            ? `${(p.mv / 1e8).toFixed(2)}亿`
                            : p.mv >= 1e4
                              ? `${(p.mv / 1e4).toFixed(0)}万`
                              : p.mv.toFixed(0)}
                        </td>
                        <td class="px-3 py-2 text-right text-[var(--text-secondary)] font-mono tabular-nums">
                          {p.weight.toFixed(1)}%
                        </td>
                        <td
                          class={`px-3 py-2 text-right font-mono tabular-nums ${pnlColor(p.pnl || 0)}`}
                        >
                          {(p.pnl || 0) >= 0 ? '+' : ''}
                          {formatPrice(p.pnl || 0)}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Footer summary */}
      <div class="flex items-center justify-end gap-4 px-3 py-1.5 border-t border-[var(--border-color)] text-xs">
        <span class="text-[var(--text-muted)]">持仓市值:</span>
        <span class="text-sm font-bold tabular-nums text-[var(--text-primary)]">
          {totalMarketValue() >= 1e8
            ? `${(totalMarketValue() / 1e8).toFixed(2)}亿`
            : totalMarketValue() >= 1e4
              ? `${(totalMarketValue() / 1e4).toFixed(0)}万`
              : totalMarketValue().toFixed(0)}
        </span>
      </div>
    </div>
  );
};
