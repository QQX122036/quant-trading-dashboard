/**
 * AlertBanner.tsx — 预警触发横幅
 */
import { Component, Show } from 'solid-js';
import type { AlertLine } from './DrawingTools';

export interface AlertBannerProps {
  alertLines: AlertLine[];
}

export const AlertBanner: Component<AlertBannerProps> = (props) => {
  return (
    <Show when={props.alertLines.some((a) => a.triggered)}>
      <div class="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-600 text-white rounded-lg shadow-lg animate-bounce text-sm">
        🔔 价格触发预警线！
      </div>
    </Show>
  );
};
