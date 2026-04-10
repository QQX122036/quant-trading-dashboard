/**
 * DevPanels.tsx — DEV-only 开发工具面板整合
 *
 * 将 ErrorTrackerPanel、PerformanceAlerts、VitalBadge 整合为单一 chunk，
 * 通过 App.tsx 中的条件导入（import.meta.env.DEV）实现：
 *   ✅ DEV: 正常加载 ~900 行开发工具
 *   ❌ PROD: Tree-shaking 完全剔除，零体积影响
 *
 * 组合原因：三者都是纯 DEV 工具，且常同时使用，
 * 合并为单个 chunk 可避免小块碎片化。
 */
import { Component, Suspense } from 'solid-js';
import { ErrorTrackerPanel } from '../common/ErrorTrackerPanel';
import { PerformanceAlerts, VitalBadge } from './PerformanceAlerts';

const DevPanelLoader = () => null;

const DevPanels: Component = () => (
  <Suspense fallback={<DevPanelLoader />}>
    {/* 前端错误追踪面板 */}
    <ErrorTrackerPanel defaultOpen={true} />
    {/* 性能预警面板 */}
    <PerformanceAlerts defaultOpen={false} />
    {/* Web Vitals 实时徽章 */}
    <VitalBadge />
  </Suspense>
);

export default DevPanels;
