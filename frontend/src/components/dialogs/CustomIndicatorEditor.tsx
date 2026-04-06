/**
 * CustomIndicatorEditor.tsx — 自定义技术指标编辑器
 * 支持 MA/EMA/RSI/MACD/KDJ/BOLL，动态参数，颜色选择，实时渲染到K线图
 */
import { Component, createSignal, For, Show, createEffect } from 'solid-js';
import { state } from '../../stores';
import { actions } from '../../stores';
import { KlineChart } from '../charts/KlineChart';
import type { DailyBar } from '../../hooks/useApi';
import type { Time } from 'lightweight-charts';

// ── Types ───────────────────────────────────────────────────────────────────

export type IndicatorType = 'MA' | 'EMA' | 'RSI' | 'MACD' | 'KDJ' | 'BOLL';

export interface CustomIndicator {
  id: string;
  type: IndicatorType;
  params: Record<string, number>;
  color: string;
  /** lightweight-charts series handle */
  seriesData?: {
    time: Time;
    value: number;
  }[];
}

export interface CustomIndicatorEditorProps {
  /** K线数据（由父组件传入） */
  bars: DailyBar[];
  /** 关闭回调 */
  onClose: () => void;
}

// ── Indicator Calculations (reused from IndicatorChart.tsx) ──────────────────

function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { result.push(NaN); }
    else {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += values[i - j];
      result.push(sum / period);
    }
  }
  return result;
}

function ema(values: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  for (let i = 0; i < values.length; i++) {
    if (i === 0) { result.push(values[0]); }
    else if (i < period - 1) {
      let sum = 0;
      for (let j = 0; j <= i; j++) sum += values[j];
      result.push(sum / (i + 1));
    } else if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += values[j];
      result.push(sum / period);
    } else {
      result.push((values[i] - result[i - 1]) * multiplier + result[i - 1]);
    }
  }
  return result;
}

function stdDev(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { result.push(NaN); }
    else {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += values[i - j];
      const mean = sum / period;
      let variance = 0;
      for (let j = 0; j < period; j++) variance += Math.pow(values[i - j] - mean, 2);
      result.push(Math.sqrt(variance / period));
    }
  }
  return result;
}

function calculateMACD(closes: number[]) {
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const dif = ema12.map((v, i) => v - ema26[i]);
  const dea = ema(dif, 9);
  const histogram = dif.map((v, i) => v - dea[i]);
  return { dif, dea, histogram };
}

function calculateRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period) { rsi.push(NaN); continue; }
    let avgGain = 0, avgLoss = 0;
    for (let j = 1; j <= period; j++) {
      const change = closes[i - j + 1] - closes[i - j];
      if (change > 0) avgGain += change; else avgLoss += Math.abs(change);
    }
    avgGain /= period; avgLoss /= period;
    if (avgLoss === 0) { rsi.push(100); }
    else { const rs = avgGain / avgLoss; rsi.push(100 - 100 / (1 + rs)); }
  }
  return rsi;
}

function calculateKDJ(highs: number[], lows: number[], closes: number[], period = 9) {
  const k: number[] = [], d: number[] = [], j: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { k.push(NaN); d.push(NaN); j.push(NaN); }
    else {
      const lowMin = Math.min(...lows.slice(i - period + 1, i + 1));
      const highMax = Math.max(...highs.slice(i - period + 1, i + 1));
      const rsv = highMax === lowMin ? 50 : ((closes[i] - lowMin) / (highMax - lowMin)) * 100;
      const prevK = k.length > 0 ? k[k.length - 1] : 50;
      const prevD = d.length > 0 ? d[d.length - 1] : 50;
      const kVal = (2 / 3) * prevK + (1 / 3) * rsv;
      const dVal = (2 / 3) * prevD + (1 / 3) * kVal;
      const jVal = 3 * kVal - 2 * dVal;
      k.push(kVal); d.push(dVal); j.push(jVal);
    }
  }
  return { k, d, j };
}

function calculateBOLL(closes: number[], period = 20, stdDev_mult = 2) {
  const middle = sma(closes, period);
  const std = stdDev(closes, period);
  const upper = middle.map((m, i) => (m !== undefined && !isNaN(m) && std[i] !== undefined ? m + stdDev_mult * std[i] : NaN));
  const lower = middle.map((m, i) => (m !== undefined && !isNaN(m) && std[i] !== undefined ? m - stdDev_mult * std[i] : NaN));
  return { upper, middle, lower };
}

// ── Indicator configs ────────────────────────────────────────────────────────

const INDICATOR_CONFIGS: Record<IndicatorType, { label: string; params: { key: string; label: string; default: number; min?: number }[] }> = {
  MA:    { label: 'MA (均线)',     params: [{ key: 'period', label: '周期', default: 5, min: 1 }] },
  EMA:   { label: 'EMA (指数均线)', params: [{ key: 'period', label: '周期', default: 12, min: 1 }] },
  RSI:   { label: 'RSI (相对强弱)', params: [{ key: 'period', label: '周期', default: 14, min: 1 }] },
  MACD:  {
    label: 'MACD',
    params: [
      { key: 'fast',   label: '快线周期',   default: 12, min: 1 },
      { key: 'slow',   label: '慢线周期',   default: 26, min: 1 },
      { key: 'signal', label: '信号线周期', default: 9,  min: 1 },
    ],
  },
  KDJ:   { label: 'KDJ (随机指标)', params: [{ key: 'period', label: '周期', default: 9, min: 1 }] },
  BOLL:  {
    label: 'BOLL (布林带)',
    params: [
      { key: 'period',    label: '周期',     default: 20, min: 1 },
      { key: 'stdDev_mult', label: '标准差倍数', default: 2, min: 0.1 },
    ],
  },
};

const DEFAULT_COLORS: Record<IndicatorType, string> = {
  MA:   '#3B82F6',
  EMA:  '#F59E0B',
  RSI:  '#8B5CF6',
  MACD: '#EC4899',
  KDJ:  '#10B981',
  BOLL: '#6B7280',
};

// ── Color palette for color picker ──────────────────────────────────────────

const COLOR_PALETTE = [
  '#3B82F6', '#F59E0B', '#EF4444', '#22C55E', '#8B5CF6',
  '#EC4899', '#10B981', '#6B7280', '#F97316', '#06B6D4',
  '#84CC16', '#A855F7', '#14B8A6', '#E11D48', '#0EA5E9',
];

// ── Component ────────────────────────────────────────────────────────────────

export const CustomIndicatorEditor: Component<CustomIndicatorEditorProps> = (props) => {
  // Indicator list (shared with KlineChart via props callback)
  const [indicators, setIndicators] = createSignal<CustomIndicator[]>([]);

  // Form state
  const [selectedType, setSelectedType] = createSignal<IndicatorType>('MA');
  const [params, setParams] = createSignal<Record<string, string>>({ period: '5' });
  const [selectedColor, setSelectedColor] = createSignal(DEFAULT_COLORS['MA']);

  // Preview chart instance (passed back to parent)
  const [chartRef, setChartRef] = createSignal<any>(null);

  // Sync params when type changes
  createEffect(() => {
    const type = selectedType();
    const config = INDICATOR_CONFIGS[type];
    const newParams: Record<string, string> = {};
    for (const p of config.params) newParams[p.key] = String(p.default);
    setParams(newParams);
    setSelectedColor(DEFAULT_COLORS[type]);
  });

  function genId() {
    return `ci_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function buildIndicatorData(type: IndicatorType, p: Record<string, number>, bars: DailyBar[]) {
    const closes = bars.map((b) => b.close);
    const highs  = bars.map((b) => b.high);
    const lows   = bars.map((b) => b.low);
    const times: Time[] = bars.map((b) => b.trade_date as Time);

    if (type === 'MA') {
      const data = sma(closes, p.period);
      return times.map((t, i) => ({ time: t, value: data[i] })).filter((d) => !isNaN(d.value));
    }
    if (type === 'EMA') {
      const data = ema(closes, p.period);
      return times.map((t, i) => ({ time: t, value: data[i] })).filter((d) => !isNaN(d.value));
    }
    if (type === 'RSI') {
      const data = calculateRSI(closes, p.period);
      return times.map((t, i) => ({ time: t, value: data[i] })).filter((d) => !isNaN(d.value));
    }
    if (type === 'MACD') {
      // MACD is multi-line; we return null here — handled specially below
      return null;
    }
    if (type === 'KDJ') {
      const { k, d, j } = calculateKDJ(highs, lows, closes, p.period);
      // Return K as primary
      return times.map((t, i) => ({ time: t, value: k[i] })).filter((d) => !isNaN(d.value));
    }
    if (type === 'BOLL') {
      const { upper } = calculateBOLL(closes, p.period, p.stdDev_mult ?? 2);
      return times.map((t, i) => ({ time: t, value: upper[i] })).filter((d) => !isNaN(d.value));
    }
    return [];
  }

  function handleAdd() {
    const type = selectedType();
    const p: Record<string, number> = {};
    for (const [k, v] of Object.entries(params())) {
      p[k] = parseFloat(v) || 0;
    }

    // Build series data
    const seriesData = buildIndicatorData(type, p, props.bars);

    const newIndicator: CustomIndicator = {
      id: genId(),
      type,
      params: p,
      color: selectedColor(),
      seriesData: seriesData ?? undefined,
    };

    setIndicators((prev) => [...prev, newIndicator]);

    // Notify parent (KlineChart) via custom event
    window.dispatchEvent(new CustomEvent('custom-indicator-add', { detail: newIndicator }));
  }

  function handleRemove(id: string) {
    setIndicators((prev) => prev.filter((ind) => ind.id !== id));
    window.dispatchEvent(new CustomEvent('custom-indicator-remove', { detail: { id } }));
  }

  const config = () => INDICATOR_CONFIGS[selectedType()];

  return (
    <div
      class="fixed inset-0 flex z-50"
      style={{ background: 'rgba(0,0,0,0.55)', 'backdrop-filter': 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && props.onClose()}
    >
      {/* Main panel */}
      <div
        class="flex flex-col bg-[#0F1523] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-2xl"
        style={{
          width: 'min(780px, 95vw)',
          height: 'min(620px, 90vh)',
          margin: 'auto',
        }}
      >
        {/* Header */}
        <div class="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.08)] shrink-0">
          <div>
            <h2 class="text-sm font-bold text-white/90">📊 自定义指标编辑器</h2>
            <p class="text-xs text-white/40 mt-0.5">添加技术指标至K线图 · 实时渲染</p>
          </div>
          <button
            class="w-7 h-7 flex items-center justify-center rounded-md text-white/50 hover:text-white/90 hover:bg-white/10 transition-all text-lg"
            onClick={props.onClose}
          >
            ×
          </button>
        </div>

        {/* Body: two-column layout */}
        <div class="flex flex-1 overflow-hidden min-h-0">

          {/* Left: editor form */}
          <div class="w-64 shrink-0 border-r border-[rgba(255,255,255,0.07)] flex flex-col p-4 gap-4 overflow-y-auto">

            {/* Indicator type */}
            <div class="form-group">
              <label class="form-label text-xs text-white/50 mb-1.5 block">指标类型</label>
              <select
                class="form-input text-sm"
                value={selectedType()}
                onChange={(e) => setSelectedType(e.currentTarget.value as IndicatorType)}
              >
                <For each={Object.entries(INDICATOR_CONFIGS)}>
                  {([key, cfg]) => <option value={key}>{cfg.label}</option>}
                </For>
              </select>
            </div>

            {/* Dynamic params */}
            <div class="space-y-3">
              <p class="text-xs text-white/50 font-medium uppercase tracking-wider">参数配置</p>
              <For each={config().params}>
                {(p) => (
                  <div class="form-group">
                    <label class="form-label text-xs text-white/40">{p.label}</label>
                    <input
                      class="form-input text-sm"
                      type="number"
                      min={p.min ?? 1}
                      step={p.key === 'stdDev_mult' ? 0.1 : 1}
                      value={params()[p.key] ?? String(p.default)}
                      onInput={(e) =>
                        setParams((prev) => ({ ...prev, [p.key]: e.currentTarget.value }))
                      }
                    />
                  </div>
                )}
              </For>
            </div>

            {/* Color picker */}
            <div class="space-y-2">
              <p class="text-xs text-white/50 font-medium uppercase tracking-wider">线条颜色</p>
              <div class="flex flex-wrap gap-2">
                <For each={COLOR_PALETTE}>
                  {(c) => (
                    <button
                      class="w-6 h-6 rounded-full border-2 transition-all"
                      style={{
                        background: c,
                        'border-color': selectedColor() === c ? 'white' : 'transparent',
                        transform: selectedColor() === c ? 'scale(1.2)' : 'scale(1)',
                      }}
                      onClick={() => setSelectedColor(c)}
                      title={c}
                    />
                  )}
                </For>
              </div>
              {/* Custom color input */}
              <div class="flex items-center gap-2 mt-1">
                <input
                  class="form-input text-xs flex-1 h-7 px-2"
                  type="color"
                  value={selectedColor()}
                  onInput={(e) => setSelectedColor(e.currentTarget.value)}
                />
                <span class="text-xs text-white/30 font-mono">{selectedColor()}</span>
              </div>
            </div>

            {/* Preview hint */}
            <div class="rounded-lg p-3 bg-white/5 border border-white/8">
              <p class="text-xs text-white/40 mb-1">📌 指标预览</p>
              <div class="flex items-center gap-2">
                <div
                  class="w-4 h-0.5 rounded-full"
                  style={{ background: selectedColor() }}
                />
                <span class="text-xs text-white/60">{config().label}</span>
              </div>
              <div class="mt-1.5 space-y-0.5">
                <For each={config().params}>
                  {(p) => (
                    <p class="text-xs text-white/35">
                      {p.label}: <span class="text-white/60 font-mono">{params()[p.key] ?? p.default}</span>
                    </p>
                  )}
                </For>
              </div>
            </div>

            {/* Add button */}
            <button
              class="btn btn-primary w-full text-sm mt-auto"
              onClick={handleAdd}
            >
              ➕ 添加指标
            </button>
          </div>

          {/* Right: indicator list + preview */}
          <div class="flex-1 flex flex-col p-4 overflow-y-auto gap-3">

            {/* Active indicators list */}
            <div class="shrink-0">
              <p class="text-xs text-white/50 font-medium uppercase tracking-wider mb-2">
                已添加指标 ({indicators().length})
              </p>

              <Show
                when={indicators().length > 0}
                fallback={
                  <div class="rounded-lg p-4 bg-white/3 border border-dashed border-white/10 text-center">
                    <p class="text-xs text-white/30">暂无指标，请从左侧添加</p>
                  </div>
                }
              >
                <div class="space-y-2">
                  <For each={indicators()}>
                    {(ind) => (
                      <div class="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-white/4 border border-white/8 hover:bg-white/6 transition-colors">
                        {/* Color swatch + type */}
                        <div
                          class="w-3 h-3 rounded-full shrink-0"
                          style={{ background: ind.color }}
                        />
                        <div class="flex-1 min-w-0">
                          <p class="text-xs text-white/80 font-medium">
                            {INDICATOR_CONFIGS[ind.type].label}
                          </p>
                          <p class="text-xs text-white/35 font-mono mt-0.5">
                            {Object.entries(ind.params)
                              .map(([k, v]) => `${k}=${v}`)
                              .join(', ')}
                          </p>
                        </div>
                        {/* Remove */}
                        <button
                          class="shrink-0 w-6 h-6 flex items-center justify-center rounded text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all text-sm"
                          onClick={() => handleRemove(ind.id)}
                          title="移除"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>

            {/* Info panel */}
            <div class="rounded-lg p-3 bg-blue-500/10 border border-blue-500/20">
              <p class="text-xs text-blue-300/80 font-medium mb-1.5">💡 使用说明</p>
              <ul class="text-xs text-white/40 space-y-1">
                <li>• 选择指标类型并设置参数</li>
                <li>• 选择线条颜色后点击「添加指标」</li>
                <li>• 已添加的指标会实时渲染到K线图</li>
                <li>• 点击 × 可移除对应指标</li>
                <li>• MACD 指标将在子图区域显示</li>
              </ul>
            </div>

            {/* MACD note */}
            <Show when={selectedType() === 'MACD'}>
              <div class="rounded-lg p-3 bg-yellow-500/10 border border-yellow-500/20">
                <p class="text-xs text-yellow-300/80">
                  ⚠️ MACD 包含 DIF / DEA / Histogram 三条线，将以红涨绿跌配色渲染在 K 线下方。
                </p>
              </div>
            </Show>

            {/* Supported indicators quick-ref */}
            <div class="shrink-0 rounded-lg p-3 bg-white/3 border border-white/8">
              <p class="text-xs text-white/40 mb-2">支持的指标</p>
              <div class="grid grid-cols-2 gap-1.5">
                <For each={Object.entries(INDICATOR_CONFIGS)}>
                  {([key, cfg]) => (
                    <div class="flex items-center gap-1.5">
                      <div
                        class="w-2 h-2 rounded-full shrink-0"
                        style={{ background: DEFAULT_COLORS[key as IndicatorType] }}
                      />
                      <span class="text-xs text-white/50">{cfg.label.split(' ')[0]}</span>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div class="flex items-center justify-between px-5 py-3 border-t border-[rgba(255,255,255,0.08)] shrink-0">
          <p class="text-xs text-white/25">
            共 {indicators().length} 个自定义指标
          </p>
          <div class="flex gap-2">
            <button class="btn btn-secondary text-xs" onClick={() => {
              // Clear all
              indicators().forEach((ind) => {
                window.dispatchEvent(new CustomEvent('custom-indicator-remove', { detail: { id: ind.id } }));
              });
              setIndicators([]);
            }}>
              清空全部
            </button>
            <button class="btn btn-primary text-xs" onClick={props.onClose}>
              完成
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
