import { Component, Show } from 'solid-js';
import { state, actions } from '../../stores';

export const AboutDialog: Component = () => {
  return (
    <Show when={state.ui.showAboutDialog}>
      <div
        class="dialog-overlay"
        onClick={(e) => e.target === e.currentTarget && actions.ui.toggleDialog('about')}
      >
        <div class="dialog-panel" style={{ 'min-width': '400px' }}>
          <div class="dialog-header">
            <span class="text-sm font-bold text-[var(--text-primary)]">关于 VeighNa Web</span>
            <button
              class="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg leading-none"
              onClick={() => actions.ui.toggleDialog('about')}
            >
              ×
            </button>
          </div>

          <div class="dialog-body space-y-4">
            {/* Logo & Title */}
            <div class="flex flex-col items-center gap-2 py-4">
              <svg class="w-16 h-16" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="6" fill="#1e1e1e" />
                <path
                  d="M8 22 L12 14 L16 18 L20 10 L24 16"
                  stroke="#ff4b4b"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M8 24 L12 20 L16 22 L20 18 L24 20"
                  stroke="#00ffff"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  opacity="0.7"
                />
              </svg>
              <span class="text-lg font-bold text-[var(--text-primary)]">VeighNa Web</span>
              <span class="text-[var(--text-muted)] text-xs">量化交易看板 v1.0</span>
            </div>

            {/* Version Info */}
            <div class="bg-[#1f2937] rounded-lg p-3 space-y-2">
              <div class="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                版本信息
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-[var(--text-muted)]">VeighNa 框架</span>
                <span class="text-[var(--text-primary)] font-mono">vnpy 4.3.0</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-[var(--text-muted)]">数据存储</span>
                <span class="text-[var(--text-primary)] font-mono">DuckDB</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-[var(--text-muted)]">前端版本</span>
                <span class="text-[var(--text-primary)] font-mono">v1.0.0</span>
              </div>
            </div>

            {/* Tech Stack */}
            <div class="bg-[#1f2937] rounded-lg p-3 space-y-2">
              <div class="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                技术栈
              </div>
              <div class="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <div class="flex justify-between text-xs">
                  <span class="text-[var(--text-muted)]">前端框架</span>
                  <span class="text-[var(--text-primary)]">SolidJS 2.x</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-[var(--text-muted)]">构建工具</span>
                  <span class="text-[var(--text-primary)]">Vite 6.x</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-[var(--text-muted)]">样式方案</span>
                  <span class="text-[var(--text-primary)]">TailwindCSS 4</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-[var(--text-muted)]">图表库</span>
                  <span class="text-[var(--text-primary)]">lightweight-charts</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-[var(--text-muted)]">数据可视化</span>
                  <span class="text-[var(--text-primary)]">ECharts 5</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-[var(--text-muted)]">通信协议</span>
                  <span class="text-[var(--text-primary)]">WebSocket + REST</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-[var(--text-muted)]">后端框架</span>
                  <span class="text-[var(--text-primary)]">FastAPI</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-[var(--text-muted)]">数据引擎</span>
                  <span class="text-[var(--text-primary)]">DuckDB</span>
                </div>
              </div>
            </div>

            {/* Manual Link */}
            <div class="bg-[#1f2937] rounded-lg p-3">
              <div class="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                帮助
              </div>
              <a
                href="/help"
                class="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <span>📖</span>
                <span>使用手册</span>
                <span class="ml-auto text-gray-600">→</span>
              </a>
            </div>

            {/* Team */}
            <div class="bg-[#1f2937] rounded-lg p-3 space-y-2">
              <div class="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                开发团队
              </div>
              <div class="space-y-1.5">
                <div class="flex justify-between text-xs">
                  <span class="text-[var(--text-muted)]">项目负责人</span>
                  <span class="text-[var(--text-primary)]">Ayden</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-[var(--text-muted)]">前端开发</span>
                  <span class="text-[var(--text-primary)]">Frontend Agent</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-[var(--text-muted)]">后端开发</span>
                  <span class="text-[var(--text-primary)]">Coder Agent</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-[var(--text-muted)]">策略开发</span>
                  <span class="text-[var(--text-primary)]">Quant Agent</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-[var(--text-muted)]">系统架构</span>
                  <span class="text-[var(--text-primary)]">OpenClaw Multi-Agent</span>
                </div>
              </div>
            </div>
          </div>

          <div class="dialog-footer">
            <button class="btn btn-primary" onClick={() => actions.ui.toggleDialog('about')}>
              确定
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};
