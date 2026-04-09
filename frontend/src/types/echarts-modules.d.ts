/**
 * ECharts internal module declarations for tree-shaking imports
 * These declare the types for direct chart install functions
 */
declare module 'echarts/lib/chart/line/install.js' {
  import { EChartsExtensionInstallRegisters } from 'echarts';
  export function install(registers: EChartsExtensionInstallRegisters): void;
}
declare module 'echarts/lib/chart/bar/install.js' {
  import { EChartsExtensionInstallRegisters } from 'echarts';
  export function install(registers: EChartsExtensionInstallRegisters): void;
}
declare module 'echarts/lib/chart/heatmap/install.js' {
  import { EChartsExtensionInstallRegisters } from 'echarts';
  export function install(registers: EChartsExtensionInstallRegisters): void;
}
declare module 'echarts/lib/chart/gauge/install.js' {
  import { EChartsExtensionInstallRegisters } from 'echarts';
  export function install(registers: EChartsExtensionInstallRegisters): void;
}
declare module 'echarts/lib/chart/pie/install.js' {
  import { EChartsExtensionInstallRegisters } from 'echarts';
  export function install(registers: EChartsExtensionInstallRegisters): void;
}
