/**
 * KlineOverlay.tsx — loading/error banner overlay
 * Extracted from KlineChart.tsx
 */
import { Component, Show } from 'solid-js';

interface KlineOverlayProps {
  loading: boolean;
  error: string | null;
}

export const KlineOverlay: Component<KlineOverlayProps> = (props) => {
  return (
    <>
      <Show when={props.loading}>
        <div class="absolute inset-0 z-10 flex items-center justify-center bg-[#0A0E17]/80">
          <span class="text-gray-400 text-sm">加载中...</span>
        </div>
      </Show>
      <Show when={props.error}>
        <div class="absolute top-2 left-2 z-10 px-2 py-1 bg-red-900/80 rounded text-xs text-red-300">
          {props.error}
        </div>
      </Show>
    </>
  );
};
