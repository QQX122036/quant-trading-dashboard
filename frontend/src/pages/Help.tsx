/**
 * Help.tsx — 用户手册页面
 * 功能介绍 / 使用指南 / 快捷键列表
 */
import { Component, For } from 'solid-js';

const shortcuts = [
  { keys: ['G', 'M'], desc: '跳转市场概览' },
  { keys: ['G', 'D'], desc: '跳转仪表盘' },
  { keys: ['G', 'P'], desc: '跳转持仓管理' },
  { keys: ['G', 'T'], desc: '跳转交易记录' },
  { keys: ['G', 'B'], desc: '跳转回测分析' },
  { keys: ['G', 'F'], desc: '跳转因子管理' },
  { keys: ['G', 'S'], desc: '跳转策略管理' },
  { keys: ['Shift', '?'], desc: '打开快捷键帮助' },
  { keys: ['Esc'], desc: '关闭弹窗 / 取消操作' },
  { keys: ['F5'], desc: '刷新当前页面数据' },
  { keys: ['Ctrl', 'K'], desc: '打开命令面板' },
];

const modules = [
  {
    title: '市场概览',
    icon: '📊',
    path: '/market',
    desc: '实时行情监控，支持多股票对比、技术指标叠加、自选股管理',
  },
  {
    title: '仪表盘',
    icon: '📈',
    path: '/dashboard',
    desc: '账户总览、KPI 指标、资金曲线、成交统计',
  },
  {
    title: '持仓管理',
    icon: '💼',
    path: '/positions',
    desc: '当前持仓明细、持仓盈亏分析、持仓限制预警',
  },
  {
    title: '交易记录',
    icon: '📋',
    path: '/trades',
    desc: '历史成交明细查询，支持多条件筛选和导出',
  },
  {
    title: '回测分析',
    icon: '🔬',
    path: '/backtest',
    desc: '策略回测、绩效归因、收益风险指标统计',
  },
  {
    title: '因子管理',
    icon: '⚡',
    path: '/factors',
    desc: 'Alpha 因子库、因子分析、多因子模型',
  },
  {
    title: '策略管理',
    icon: '🤖',
    path: '/strategies',
    desc: '量化策略编辑、参数优化、实盘/回测切换',
  },
  {
    title: '舆情分析',
    icon: '💬',
    path: '/sentiment',
    desc: '新闻舆情、社交媒体情绪、事件驱动信号',
  },
  {
    title: '投资顾问',
    icon: '🧠',
    path: '/advisor',
    desc: 'AI 驱动的投资建议、风险提示、组合优化',
  },
  {
    title: '数据管理',
    icon: '🗄️',
    path: '/data',
    desc: 'K线数据、财务数据、外部数据源接入',
  },
];

const steps = [
  {
    step: '01',
    title: '登录系统',
    desc: '访问首页，输入账户信息完成认证，进入主界面。',
  },
  {
    step: '02',
    title: '添加自选股',
    desc: '在市场概览页面搜索股票代码，点击收藏按钮加入自选列表。',
  },
  {
    step: '03',
    title: '查看行情',
    desc: '选择自选股，叠加 MA、MACD、RSI 等技术指标，分析价格走势。',
  },
  {
    step: '04',
    title: '管理持仓',
    desc: '在持仓管理页面查看当前仓位、盈亏情况，支持手动平仓。',
  },
  {
    step: '05',
    title: '运行回测',
    desc: '在回测分析页面选择策略和时间范围，查看绩效报告和收益曲线。',
  },
  {
    step: '06',
    title: '订阅信号',
    desc: '在 Alpha 信号页面订阅感兴趣的因子信号，接收实时推送。',
  },
];

const Help: Component = () => {
  return (
    <div class="h-full overflow-auto p-6 bg-[#0A0E17] space-y-8">
      {/* ── Page Header ─────────────────────────────────── */}
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-lg">
          📖
        </div>
        <div>
          <h1 class="text-xl font-bold text-white">用户手册</h1>
          <p class="text-sm text-gray-500">功能介绍 / 使用指南 / 快捷键速查</p>
        </div>
      </div>

      {/* ── 功能介绍 ─────────────────────────────────────── */}
      <section class="space-y-4">
        <div class="flex items-center gap-2">
          <span class="text-indigo-400 text-sm font-semibold tracking-wider uppercase">
            功能介绍
          </span>
          <div class="flex-1 h-px bg-white/10" />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <For each={modules}>
            {(mod) => (
              <a
                href={mod.path}
                class="group bg-[#111827] border border-white/10 rounded-xl p-4 hover:border-indigo-500/50 transition-all hover:shadow-lg hover:shadow-indigo-500/10"
              >
                <div class="flex items-start gap-3">
                  <span class="text-2xl mt-0.5">{mod.icon}</span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                      <span class="font-semibold text-white group-hover:text-indigo-300 transition-colors">
                        {mod.title}
                      </span>
                      <span class="text-[10px] text-gray-600 group-hover:text-indigo-400 transition-colors">
                        →
                      </span>
                    </div>
                    <p class="text-xs text-gray-500 mt-1 leading-relaxed">{mod.desc}</p>
                  </div>
                </div>
              </a>
            )}
          </For>
        </div>
      </section>

      {/* ── 使用指南 ─────────────────────────────────────── */}
      <section class="space-y-4">
        <div class="flex items-center gap-2">
          <span class="text-indigo-400 text-sm font-semibold tracking-wider uppercase">
            使用指南
          </span>
          <div class="flex-1 h-px bg-white/10" />
        </div>

        <div class="bg-[#111827] border border-white/10 rounded-xl p-6">
          <div class="relative">
            {/* Vertical timeline line */}
            <div class="absolute left-6 top-2 bottom-2 w-px bg-gradient-to-b from-indigo-500 via-purple-500 to-indigo-500/20" />

            <div class="space-y-6">
              <For each={steps}>
                {(item) => (
                  <div class="relative flex items-start gap-5 pl-0">
                    {/* Step number circle */}
                    <div class="relative z-10 w-10 h-10 rounded-full bg-[#0A0E17] border-2 border-indigo-500 flex items-center justify-center flex-shrink-0">
                      <span class="text-indigo-400 text-xs font-bold">{item.step}</span>
                    </div>

                    <div class="flex-1 pt-1.5 pb-2">
                      <div class="text-sm font-semibold text-white">{item.title}</div>
                      <div class="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </section>

      {/* ── 快捷键列表 ───────────────────────────────────── */}
      <section class="space-y-4">
        <div class="flex items-center gap-2">
          <span class="text-indigo-400 text-sm font-semibold tracking-wider uppercase">
            快捷键列表
          </span>
          <div class="flex-1 h-px bg-white/10" />
          <span class="text-xs text-gray-600">
            按{' '}
            <kbd class="px-1.5 py-0.5 rounded bg-white/10 text-gray-400 text-[10px] font-mono">
              Shift+?
            </kbd>{' '}
            随时唤起
          </span>
        </div>

        <div class="bg-[#111827] border border-white/10 rounded-xl overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-white/10">
                <th class="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  快捷键
                </th>
                <th class="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  功能
                </th>
              </tr>
            </thead>
            <tbody>
              <For each={shortcuts}>
                {(s, i) => (
                  <tr
                    class={`border-b border-white/5 ${i() % 2 === 0 ? 'bg-white/[0.01]' : ''} hover:bg-white/5 transition-colors`}
                  >
                    <td class="py-2.5 px-5">
                      <div class="flex items-center gap-1.5">
                        <For each={s.keys}>
                          {(key) => (
                            <kbd class="px-2 py-1 rounded bg-white/10 text-indigo-300 text-xs font-mono border border-white/10 shadow-sm">
                              {key}
                            </kbd>
                          )}
                        </For>
                      </div>
                    </td>
                    <td class="py-2.5 px-5 text-gray-400 text-xs">{s.desc}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <div class="text-center py-4 text-xs text-gray-700">
        VeighNa Web · 量化交易看板 · 如有问题请联系项目负责人 Ayden
      </div>
    </div>
  );
};

export default Help;
