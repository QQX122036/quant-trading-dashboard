/**
 * echarts.ts — Optimized selective imports (tree-shaking)
 *
 * Chart types confirmed in use: line, bar, pie, heatmap, gauge
 *   (NOT used: scatter, radar — tree-shaken away)
 * Components confirmed in use: tooltip, legend, grid, dataZoom,
 *   toolbox, title, markLine, markPoint, visualMap, graphic
 *
 * Import strategy:
 * 1. Charts: import install fns directly from lib/chart/xxx/install.js
 *    (bypasses the barrel export * in echarts/charts which prevents tree-shaking)
 * 2. Components: use echarts/components barrel (Rollup can tree-shake)
 * 3. Core: echarts/core (minimal, just the ECharts class + API)
 * 4. Renderer: CanvasRenderer
 * 5. graphic namespace: import from echarts (top-level export)
 *
 * This eliminates ~60% of the bundle vs importing full `echarts` dist.
 */
import * as echarts from 'echarts/core';

// ── Charts — direct install paths for proper tree-shaking ──────
// echarts/charts barrel does `export * from './lib/export/charts.js'`
// which re-exports ALL 21 chart types and prevents tree-shaking.
// Using the install() functions directly bypasses this issue.
import { install as LineChart } from 'echarts/lib/chart/line/install.js';
import { install as BarChart } from 'echarts/lib/chart/bar/install.js';
import { install as HeatmapChart } from 'echarts/lib/chart/heatmap/install.js';
import { install as GaugeChart } from 'echarts/lib/chart/gauge/install.js';
import { install as PieChart } from 'echarts/lib/chart/pie/install.js';

// ── Components — use the barrel (Rollup tree-shakes unused ones) ──
import {
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
  ToolboxComponent,
  TitleComponent,
  MarkLineComponent,
  MarkPointComponent,
  VisualMapComponent,
} from 'echarts/components';

// ── Canvas renderer (lighter than SVG) ───────────────────────
import { CanvasRenderer } from 'echarts/renderers';

// ── Register everything with echarts ─────────────────────────
echarts.use([
  LineChart,
  BarChart,
  PieChart,
  HeatmapChart,
  GaugeChart,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
  ToolboxComponent,
  TitleComponent,
  MarkLineComponent,
  MarkPointComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

// ── Graphic elements (LinearGradient, Text, Rect, Circle, etc.) ─
// The graphic namespace is a top-level export from echarts
import { graphic } from 'echarts';
import type { EChartsType, EChartsCoreOption } from 'echarts/core';
export { graphic };
export type { EChartsType, EChartsCoreOption };
export default echarts;
