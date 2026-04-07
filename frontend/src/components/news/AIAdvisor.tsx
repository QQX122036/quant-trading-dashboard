/**
 * AIAdvisor.tsx — 智能投顾对话
 * 路由: /advisor
 * - ChatGPT 风格对话框
 * - 支持自然语言查询持仓/风险/市场情绪
 * - POST /api/ai/advisor { question }
 * - 回复显示: 文字 + 表格 + 图表
 */
import { Component, createSignal, For, Show, createEffect } from 'solid-js';
import { askAIAdvisor, type AdvisorResponse } from './api';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  charts?: AdvisorResponse['charts'];
  tables?: AdvisorResponse['tables'];
  timestamp: Date;
  loading?: boolean;
}

const CARD = 'bg-[#1f2937]/80 rounded-lg border border-white/10';

function AnswerTable(props: { table: NonNullable<AdvisorResponse['tables']>[0] }) {
  return (
    <div class="overflow-x-auto my-2">
      <table class="w-full text-xs border-collapse">
        <thead>
          <tr class="border-b border-white/10">
            <For each={props.table.headers}>
              {(h) => <th class="text-left px-3 py-2 text-gray-400 font-medium">{h}</th>}
            </For>
          </tr>
        </thead>
        <tbody>
          <For each={props.table.rows}>
            {(row) => (
              <tr class="border-b border-white/5 hover:bg-white/5">
                <For each={row}>
                  {(cell) => <td class="px-3 py-1.5 text-gray-300 font-mono">{cell}</td>}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}

function AnswerChart(props: { chart: NonNullable<AdvisorResponse['charts']>[0] }) {
  return (
    <div class="my-2 p-2 bg-white/5 rounded border border-white/5">
      <div class="text-xs text-gray-400 mb-2">{props.chart.title ?? '图表'}</div>
      <Show when={props.chart.type === 'table'}>
        <AnswerTable table={{ headers: (props.chart.data as Record<string, string[]>).headers || [], rows: (props.chart.data as Record<string, string[][]>).rows || [], title: props.chart.title }} />
      </Show>
      <Show when={props.chart.type !== 'table'}>
        <div class="text-xs text-gray-500 italic">
          [图表类型: {props.chart.type}] — 图表渲染区域
        </div>
      </Show>
    </div>
  );
}

function ChatMessage(props: { msg: Message }) {
  const isUser = () => props.msg.role === 'user';
  const isAssistant = () => props.msg.role === 'assistant' && !props.msg.loading;

  return (
    <div class={`flex gap-3 ${isUser() ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div class={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
        isUser() ? 'bg-blue-600 text-white' : isAssistant() ? 'bg-emerald-600 text-white' : 'bg-gray-600 text-gray-300'
      }`}>
        {isUser() ? '你' : '🤖'}
      </div>

      {/* Bubble */}
      <div class={`flex-1 max-w-[75%] ${isUser() ? 'text-right' : 'text-left'}`}>
        <div class={`inline-block rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser()
            ? 'bg-blue-600/80 text-white rounded-tr-sm'
            : isAssistant()
            ? 'bg-[#1f2937]/90 text-gray-100 rounded-tl-sm border border-white/10'
            : 'bg-gray-800/50 text-gray-400 italic'
        }`}
        style={{ "text-align": isUser() ? 'right' : 'left', "max-width": '100%' }}
        >
          <Show when={props.msg.loading}>
            <span class="inline-flex items-center gap-1">
              <span class="animate-pulse">●</span>
              <span class="animate-pulse" style={{ "animation-delay": '0.2s' }}>●</span>
              <span class="animate-pulse" style={{ "animation-delay": '0.4s' }}>●</span>
            </span>
          </Show>
          <Show when={!props.msg.loading}>
            {props.msg.content}
          </Show>
        </div>

        {/* 表格 */}
        <Show when={isAssistant() && props.msg.tables?.length}>
          <For each={props.msg.tables}>
            {(t) => (
              <div class={`mt-2 rounded-lg border border-white/10 overflow-hidden ${CARD}`}>
                <Show when={t.title}>
                  <div class="px-3 py-2 border-b border-white/5 text-xs text-gray-400 font-medium">{t.title}</div>
                </Show>
                <AnswerTable table={t} />
              </div>
            )}
          </For>
        </Show>

        {/* 图表 */}
        <Show when={isAssistant() && props.msg.charts?.length}>
          <For each={props.msg.charts}>
            {(c) => <AnswerChart chart={c} />}
          </For>
        </Show>

        {/* 时间戳 */}
        <div class="text-xs text-gray-600 mt-1">
          {props.msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

// 预设问题
const SUGGESTED_QUESTIONS = [
  '我的持仓亏了多少？',
  '贵州茅台最近有什么风险？',
  '现在的市场情绪如何？',
  '帮我分析上证指数走势',
  '推荐一些低估值的股票',
  '当前账户盈亏情况',
];

export const AIAdvisor: Component = () => {
  const [messages, setMessages] = createSignal<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '您好！我是智能投顾助手。请问有什么可以帮您的？您可以问我关于持仓分析、股票风险、市场情绪等任何问题。',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  let bottomRef: HTMLDivElement | undefined;
  let inputRef: HTMLTextAreaElement | undefined;

  function scrollToBottom() {
    setTimeout(() => bottomRef?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  createEffect(() => {
    messages(); // track
    scrollToBottom();
  });

  async function sendMessage(text?: string) {
    const question = (text ?? input()).trim();
    if (!question || loading()) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const loadingMsg: Message = {
      id: `loading-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      loading: true,
    };
    setMessages(prev => [...prev, loadingMsg]);

    try {
      const res = await askAIAdvisor(question);
      // 移除加载消息
      setMessages(prev => prev.filter(m => m.id !== loadingMsg.id));

      if (res.code === '0' && res.data) {
        const assistantMsg: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: res.data.answer,
          charts: res.data.charts,
          tables: res.data.tables,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        const errMsg: Message = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ 抱歉，查询失败: ${res.message || '未知错误'}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errMsg]);
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== loadingMsg.id));
      const errMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: '⚠️ 网络错误，请检查后端服务是否正常运行。',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div class="h-full flex flex-col overflow-hidden bg-[#0A0E17]">
      {/* ── Header ── */}
      <div class="shrink-0 px-4 pt-3 pb-2 border-b border-white/5">
        <div class="flex items-center gap-3">
          <h2 class="font-bold text-sm text-white">🤖 智能投顾</h2>
          <span class="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded border border-white/10">
            {loading() ? '思考中…' : '在线'}
          </span>
        </div>

        {/* 预设问题 */}
        <div class="flex items-center gap-2 mt-2 flex-wrap">
          <span class="text-xs text-gray-500">快捷问题:</span>
          <For each={SUGGESTED_QUESTIONS}>
            {(q) => (
              <button
                class="text-xs px-2 py-0.5 rounded border border-white/10 text-gray-400 hover:text-white hover:border-blue-500/50 bg-white/5 transition-colors"
                onClick={() => sendMessage(q)}
              >
                {q}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* ── Messages ── */}
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <For each={messages()}>
          {(msg) => <ChatMessage msg={msg} />}
        </For>
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div class="shrink-0 p-3 border-t border-white/5">
        <div class={`${CARD} flex items-end gap-2 p-2`}>
          <textarea
            ref={inputRef}
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题，按 Enter 发送，Shift+Enter 换行…"
            rows={1}
            class="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-600 resize-none focus:outline-none"
            style={{ "min-height": '36px', "max-height": '120px' }}
          />
          <button
            class={`shrink-0 px-4 py-2 rounded font-medium text-sm transition-colors ${
              loading() || !input().trim()
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
            onClick={() => sendMessage()}
            disabled={loading() || !input().trim()}
          >
            {loading() ? '…' : '发送'}
          </button>
        </div>
        <div class="text-xs text-gray-700 mt-1 text-center">
          AI 助手仅供参考，不构成投资建议
        </div>
      </div>
    </div>
  );
};
