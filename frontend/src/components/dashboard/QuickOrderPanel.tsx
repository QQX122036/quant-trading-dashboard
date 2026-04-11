/**
 * QuickOrderPanel.tsx — 快捷下单区
 * - 代码输入 + 方向（买入/卖出）+ 价格 + 数量
 * - 一键市价单按钮
 * - 对接 POST /api/order/send
 */
import { Component, createSignal, createEffect, Show } from 'solid-js';
import { state } from '../../stores';
import { submitOrder } from '../../hooks/useApi';
import { fetchPositions } from '../../hooks/useApi';
import type { SendOrderReq } from '../../hooks/useApi';

const GATEWAY = 'DUCKDB_SIM';

export const QuickOrderPanel: Component<{ symbol: string }> = (props) => {
  const [code, setCode] = createSignal(props.symbol.split('.')[0] || '');
  const [exchange, setExchange] = createSignal(props.symbol.includes('.SZ') ? 'SZE' : 'SSE');
  const [direction, setDirection] = createSignal<'long' | 'short'>('long');
  const [price, setPrice] = createSignal('');
  const [volume, setVolume] = createSignal('');
  const [orderType, setOrderType] = createSignal<'limit' | 'market'>('limit');
  const [submitting, setSubmitting] = createSignal(false);
  const [result, setResult] = createSignal<{ success: boolean; message: string } | null>(null);

  // 当 symbol 变化时更新 code
  createEffect(() => {
    const sym = props.symbol;
    setCode(sym.split('.')[0] || '');
    setExchange(sym.includes('.SZ') ? 'SZE' : 'SSE');
  });

  async function handleSubmit() {
    const p = parseFloat(price());
    const v = parseInt(volume());
    if (!code() || v <= 0) {
      setResult({ success: false, message: '请填写完整信息' });
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const req: SendOrderReq = {
        symbol: code(),
        exchange: exchange(),
        direction: direction(),
        offset: 'open',
        type: orderType() === 'market' ? '市价' : '限价',
        price: orderType() === 'market' ? 0 : p,
        volume: v,
        gateway: GATEWAY,
      };
      const res = await submitOrder(req);
      if (res.code === '0') {
        setResult({ success: true, message: `委托成功: ${res.data?.vt_orderid}` });
        setTimeout(() => {
          setResult(null);
        }, 3000);
        // 刷新持仓
        const posRes = await fetchPositions(GATEWAY);
        if (posRes.code === '0' && posRes.data?.positions) {
          for (const pos of posRes.data.positions) {
            state.positions.items[pos.vt_positionid] = pos;
          }
        }
      } else {
        setResult({ success: false, message: res.message || '委托失败' });
      }
    } catch (e: unknown) {
      setResult({ success: false, message: String(e) });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarket() {
    setOrderType('market');
    setPrice('0');
    await handleSubmit();
  }

  return (
    <div class="h-full flex flex-col p-3">
      <div class="text-xs font-semibold text-gray-300 mb-3">快捷下单</div>

      {/* 合约信息 */}
      <div class="bg-white/5 rounded p-2 mb-3">
        <div class="text-[10px] text-gray-500 mb-1">当前合约</div>
        <div class="text-sm font-bold text-white">{props.symbol}</div>
      </div>

      {/* 代码 + 交易所 */}
      <div class="flex gap-2 mb-2">
        <div class="flex-1">
          <label class="text-[10px] text-gray-500 block mb-0.5" for="qo-code">
            代码
          </label>
          <input
            id="qo-code"
            class="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            placeholder="600519"
            value={code()}
            onInput={(e) => setCode(e.currentTarget.value)}
            aria-label="股票代码"
          />
        </div>
        <div>
          <label class="text-[10px] text-gray-500 block mb-0.5" for="qo-exchange">
            交易所
          </label>
          <select
            id="qo-exchange"
            class="bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
            value={exchange()}
            onChange={(e) => setExchange(e.currentTarget.value as 'SSE' | 'SZE')}
          >
            <option value="SSE">上交所</option>
            <option value="SZE">深交所</option>
          </select>
        </div>
      </div>

      {/* 方向 */}
      <div class="mb-2">
        <span class="text-[10px] text-gray-500 block mb-0.5" id="qo-dir-label">
          方向
        </span>
        <div class="flex gap-1" role="group" aria-labelledby="qo-dir-label">
          <button
            class="flex-1 py-1 rounded text-xs font-bold transition-colors"
            classList={{
              'bg-green-600 text-white': direction() === 'long',
              'bg-white/10 text-gray-400 hover:bg-white/20': direction() !== 'long',
            }}
            onClick={() => setDirection('long')}
            aria-pressed={direction() === 'long'}
          >
            买入
          </button>
          <button
            class="flex-1 py-1 rounded text-xs font-bold transition-colors"
            classList={{
              'bg-red-600 text-white': direction() === 'short',
              'bg-white/10 text-gray-400 hover:bg-white/20': direction() !== 'short',
            }}
            onClick={() => setDirection('short')}
            aria-pressed={direction() === 'short'}
          >
            卖出
          </button>
        </div>
      </div>

      {/* 价格 */}
      <div class="mb-2">
        <label class="text-[10px] text-gray-500 block mb-0.5" for="qo-price">
          价格
        </label>
        <input
          id="qo-price"
          type="number"
          class="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
          placeholder={orderType() === 'market' ? '市价' : '0.00'}
          value={price()}
          onInput={(e) => setPrice(e.currentTarget.value)}
          disabled={orderType() === 'market'}
          aria-label="下单价格"
        />
      </div>

      {/* 数量 */}
      <div class="mb-3">
        <label class="text-[10px] text-gray-500 block mb-0.5" for="qo-volume">
          数量 (手)
        </label>
        <input
          id="qo-volume"
          type="number"
          class="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
          placeholder="100"
          value={volume()}
          onInput={(e) => setVolume(e.currentTarget.value)}
          aria-label="下单数量"
        />
      </div>

      {/* 结果提示 */}
      <Show when={result()}>
        <div
          class={`mb-2 text-[10px] px-2 py-1 rounded ${result()!.success ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}
          role="status"
          aria-live="polite"
        >
          {result()!.message}
        </div>
      </Show>

      {/* 按钮组 */}
      <div class="flex flex-col gap-1.5 mt-auto">
        <button
          class="w-full py-2 rounded text-xs font-bold bg-green-600 hover:bg-green-500 text-white disabled:opacity-50 transition-colors"
          onClick={handleSubmit}
          disabled={submitting()}
          aria-busy={submitting()}
        >
          {submitting() ? '提交中...' : '限价委托'}
        </button>
        <button
          class="w-full py-2 rounded text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors"
          onClick={handleMarket}
          disabled={submitting()}
          aria-busy={submitting()}
        >
          一键市价
        </button>
      </div>
    </div>
  );
};
