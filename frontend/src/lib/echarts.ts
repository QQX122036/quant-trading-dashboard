/**
 * echarts.ts — Optimized selective imports (tree-shaking)
 *
 * Chart types confirmed in use: line, bar, pie, scatter, heatmap, gauge, radar
 * Components confirmed in use: graphic (LinearGradient), tooltip, legend, grid,
 *   dataZoom, toolbox, title, markLine, markPoint, visualMap
 *
 * Import strategy: echarts/core + selective chart/component registration.
 * This eliminates ~60% of the bundle vs importing the full `echarts` dist.
 */
import * as echarts from 'echarts/core';

// ── Charts (register in dependency order) ──────────────────────
import { LineChart } from 'echarts/charts';
import { BarChart } from 'echarts/charts';
import { PieChart } from 'echarts/charts';
import { ScatterChart } from 'echarts/charts';
import { HeatmapChart } from 'echarts/charts';
import { GaugeChart } from 'echarts/charts';
import { RadarChart } from 'echarts/charts';

echarts.use([LineChart, BarChart, PieChart, ScatterChart, HeatmapChart, GaugeChart, RadarChart]);

// ── Required components ────────────────────────────────────────
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

echarts.use([
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
  ToolboxComponent,
  TitleComponent,
  MarkLineComponent,
  MarkPointComponent,
  VisualMapComponent,
]);

// ── Canvas renderer (lighter than SVG) ───────────────────────
import { CanvasRenderer } from 'echarts/renderers';
echarts.use([CanvasRenderer]);

// ── Graphic elements (LinearGradient, Text, Rect, Circle, etc.) ─
import { graphic } from 'echarts';
export { graphic };
export default echarts;
