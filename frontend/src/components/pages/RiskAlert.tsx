/**
 * RiskAlert - 风险预警系统主页面
 *
 * 功能模块：
 * 1. VaR/CVaR 风险价值指标
 * 2. 最大回撤预测
 * 3. 板块集中度 HHI
 * 4. 流动性风险
 * 5. 保证金/MarginCall
 * 6. Pre-trade 下单前风控检查
 * 7. 紧急止损协议
 * 8. 预警规则管理
 */

import { Component, createSignal, onMount, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { apiFetch, type ApiResponse } from '../../hooks/useApi';

interface AlertRulesResponse {
  rules?: Array<{
    id: number;
    ts_code: string;
    alert_type: string;
    status?: string;
    [key: string]: unknown;
  }>;
}

const RiskAlert: Component = () => {
  // ── State ─────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = createSignal<
    'overview' | 'pretrade' | 'rules' | 'margin' | 'liquidity'
  >('overview');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  // VaR
  const [varData, setVarData] = createSignal<any>(null);
  // Drawdown
  const [ddData, setDdData] = createSignal<any>(null);
  // Sector HHI
  const [hhiData, setHhiData] = createSignal<any>(null);
  // Liquidity
  const [liqData, setLiqData] = createSignal<any>(null);
  // Margin
  const [marginData, setMarginData] = createSignal<any>(null);
  // Pre-check
  const [precheckTsCode, setPrecheckTsCode] = createSignal('600519.SH');
  const [precheckDir, setPrecheckDir] = createSignal<'long' | 'short'>('long');
  const [precheckVolume, setPrecheckVolume] = createSignal(100);
  const [precheckPrice, setPrecheckPrice] = createSignal<number | null>(null);
  const [precheckResult, setPrecheckResult] = createSignal<any>(null);
  // Alert rules
  const [alertRules, setAlertRules] = createSignal<any[]>([]);
  const [ruleType, setRuleType] = createSignal<'price' | 'change' | 'volume' | 'pnl'>('price');
  // Emergency
  const [emergencyData, setEmergencyData] = createSignal<any>(null);

  // ── Load risk overview data ────────────────────────────────────────────────
  const loadRiskOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const [varRes, ddRes, hhiRes] = await Promise.allSettled([
        apiFetch('/api/risk/var?confidence=0.95&lookback_days=252&account_id=sim_default'),
        apiFetch('/api/risk/max-drawdown?account_id=sim_default&simulations=5000'),
        apiFetch('/api/risk/sector-hhi?account_id=sim_default'),
      ]);

      if (varRes.status === 'fulfilled' && varRes.value?.code === 0) {
        setVarData(varRes.value);
      }
      if (ddRes.status === 'fulfilled' && ddRes.value?.success) {
        setDdData(ddRes.value);
      }
      if (hhiRes.status === 'fulfilled' && hhiRes.value?.success) {
        setHhiData(hhiRes.value);
      }
    } catch (e: any) {
      setError(e.message || '加载风控数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadMarginData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/risk/margin?account_id=sim_default');
      if (res?.success) setMarginData(res);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const loadLiquidityData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/risk/liquidity?account_id=sim_default');
      if (res?.success) setLiqData(res);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const loadEmergency = async () => {
    try {
      const res = await apiFetch('/api/risk/emergency?account_id=sim_default');
      if (res?.success) setEmergencyData(res);
    } catch {}
  };

  const loadAlertRules = async () => {
    try {
      const res = await apiFetch<AlertRulesResponse>('/api/alerts/rules');
      if (res?.code === 0) setAlertRules(res.data?.rules || []);
    } catch {}
  };

  // ── Precheck ──────────────────────────────────────────────────────────────
  const runPrecheck = async () => {
    setPrecheckResult(null);
    try {
      const body = {
        ts_code: precheckTsCode(),
        direction: precheckDir(),
        volume: precheckVolume(),
        price: precheckPrice(),
        account_id: 'sim_default',
      };
      const res = await apiFetch('/api/risk/precheck', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setPrecheckResult(res?.data || res);
    } catch (e: any) {
      setPrecheckResult({ pass: false, reason: e.message });
    }
  };

  // ── Alert rule creation ────────────────────────────────────────────────────
  const createAlertRule = async () => {
    let payload: any = { ts_code: precheckTsCode() };
    if (ruleType() === 'price') {
      payload = { ...payload, high_price: precheckPrice(), low_price: precheckPrice() };
    } else if (ruleType() === 'change') {
      payload = { ...payload, change_pct: 9.0 };
    } else if (ruleType() === 'volume') {
      payload = { ...payload, volume_multiplier: 3.0 };
    }
    try {
      const endpoint = `/api/alerts/${ruleType()}`;
      const res = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      if (res?.code === 0) {
        await loadAlertRules();
      }
    } catch {}
  };

  const deleteAlertRule = async (ruleId: number) => {
    try {
      await apiFetch(`/api/alerts/rules/${ruleId}`, { method: 'DELETE' });
      await loadAlertRules();
    } catch {}
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const riskColor = (val: number, thresholds: [number, string][]): string => {
    for (const [threshold, color] of thresholds) {
      if (val >= threshold) return color;
    }
    return '#52c41a';
  };

  const varColor = (pct: number) =>
    riskColor(pct, [
      [0.05, '#ff4d4f'],
      [0.03, '#fa8c16'],
      [0.01, '#faad14'],
      [0.005, '#52c41a'],
    ]);
  const ddColor = (pct: number) =>
    riskColor(pct, [
      [0.3, '#ff4d4f'],
      [0.2, '#fa8c16'],
      [0.1, '#faad14'],
      [0.05, '#52c41a'],
    ]);
  const hhiColor = (val: number) =>
    riskColor(val, [
      [0.5, '#ff4d4f'],
      [0.25, '#fa8c16'],
      [0.15, '#faad14'],
      [0.0, '#52c41a'],
    ]);
  const marginColor = (ratio: number) =>
    riskColor(ratio, [
      [1.0, '#ff4d4f'],
      [0.8, '#ff4d4f'],
      [0.6, '#fa8c16'],
      [0.0, '#52c41a'],
    ]);

  const levelBadge = (level: string): JSX.Element => {
    const colors: Record<string, string> = {
      very_high: '#ff4d4f',
      high: '#fa8c16',
      medium: '#faad14',
      low: '#52c41a',
      unknown: '#d9d9d9',
    };
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          'border-radius': '4px',
          background: colors[level] || '#d9d9d9',
          color: '#fff',
          'font-size': '12px',
        }}
      >
        {level === 'very_high'
          ? '极高'
          : level === 'high'
            ? '高'
            : level === 'medium'
              ? '中'
              : level === 'low'
                ? '低'
                : '未知'}
      </span>
    );
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  onMount(() => {
    loadRiskOverview();
    loadAlertRules();
    loadEmergency();
  });

  // ── Tab panels ─────────────────────────────────────────────────────────────
  const OverviewPanel = () => (
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '16px' }}>
      {/* VaR Card */}
      <div
        style={{
          background: '#141414',
          'border-radius': '12px',
          padding: '20px',
          border: '1px solid #303030',
        }}
      >
        <div
          style={{
            display: 'flex',
            'justify-content': 'space-between',
            'align-items': 'center',
            'margin-bottom': '16px',
          }}
        >
          <h3 style={{ color: '#fff', margin: 0 }}>📉 VaR 风险价值</h3>
          <Show when={varData()}>
            <span
              style={{
                color: varColor(varData()?.var_pct || 0),
                'font-size': '24px',
                'font-weight': 'bold',
              }}
            >
              {((varData()?.var_pct || 0) * 100).toFixed(2)}%
            </span>
          </Show>
        </div>
        <Show when={varData()} fallback={<span style={{ color: '#888' }}>加载中...</span>}>
          <div style={{ display: 'grid', 'grid-template-columns': 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
              <div style={{ color: '#888', 'font-size': '12px' }}>VaR (95%置信)</div>
              <div style={{ color: '#fff', 'font-size': '18px', 'font-weight': 'bold' }}>
                ¥{varData()?.var_absolute?.toLocaleString()}
              </div>
            </div>
            <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
              <div style={{ color: '#888', 'font-size': '12px' }}>CVaR (条件风险)</div>
              <div style={{ color: '#fff', 'font-size': '18px', 'font-weight': 'bold' }}>
                ¥{varData()?.cvar_absolute?.toLocaleString()}
              </div>
            </div>
            <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
              <div style={{ color: '#888', 'font-size': '12px' }}>组合价值</div>
              <div style={{ color: '#fff', 'font-size': '18px', 'font-weight': 'bold' }}>
                ¥{varData()?.portfolio_value?.toLocaleString()}
              </div>
            </div>
            <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
              <div style={{ color: '#888', 'font-size': '12px' }}>历史观测</div>
              <div style={{ color: '#fff', 'font-size': '18px', 'font-weight': 'bold' }}>
                {varData()?.hist_observations}
              </div>
            </div>
            <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
              <div style={{ color: '#888', 'font-size': '12px' }}>波动率 (年化)</div>
              <div style={{ color: '#fff', 'font-size': '18px', 'font-weight': 'bold' }}>
                {(varData()?.volatility * 100).toFixed(2)}%
              </div>
            </div>
            <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
              <div style={{ color: '#888', 'font-size': '12px' }}>计算方法</div>
              <div style={{ color: '#fff', 'font-size': '18px', 'font-weight': 'bold' }}>
                {varData()?.method}
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* Max Drawdown Card */}
      <div
        style={{
          background: '#141414',
          'border-radius': '12px',
          padding: '20px',
          border: '1px solid #303030',
        }}
      >
        <div
          style={{
            display: 'flex',
            'justify-content': 'space-between',
            'align-items': 'center',
            'margin-bottom': '16px',
          }}
        >
          <h3 style={{ color: '#fff', margin: 0 }}>📊 最大回撤预测</h3>
          <Show when={ddData()}>
            <span
              style={{
                color: ddColor(ddData()?.predicted_max_drawdown || 0),
                'font-size': '24px',
                'font-weight': 'bold',
              }}
            >
              {(ddData()?.predicted_max_drawdown * 100).toFixed(2)}%
            </span>
          </Show>
        </div>
        <Show when={ddData()} fallback={<span style={{ color: '#888' }}>加载中...</span>}>
          <div style={{ display: 'grid', 'grid-template-columns': 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
              <div style={{ color: '#888', 'font-size': '12px' }}>预测最大回撤</div>
              <div style={{ color: '#fff', 'font-size': '18px', 'font-weight': 'bold' }}>
                {(ddData()?.predicted_max_drawdown * 100).toFixed(2)}%
              </div>
            </div>
            <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
              <div style={{ color: '#888', 'font-size': '12px' }}>当前回撤</div>
              <div style={{ color: '#fff', 'font-size': '18px', 'font-weight': 'bold' }}>
                {(ddData()?.current_drawdown * 100).toFixed(2)}%
              </div>
            </div>
            <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
              <div style={{ color: '#888', 'font-size': '12px' }}>最坏情况 (1%)</div>
              <div style={{ color: '#ff4d4f', 'font-size': '18px', 'font-weight': 'bold' }}>
                {(ddData()?.worst_case * 100).toFixed(2)}%
              </div>
            </div>
            <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
              <div style={{ color: '#888', 'font-size': '12px' }}>蒙特卡洛模拟</div>
              <div style={{ color: '#fff', 'font-size': '18px', 'font-weight': 'bold' }}>
                {ddData()?.simulations?.toLocaleString()} 次
              </div>
            </div>
            <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
              <div style={{ color: '#888', 'font-size': '12px' }}>组合价值</div>
              <div style={{ color: '#fff', 'font-size': '18px', 'font-weight': 'bold' }}>
                ¥{ddData()?.portfolio_value?.toLocaleString()}
              </div>
            </div>
            <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
              <div style={{ color: '#888', 'font-size': '12px' }}>平均回撤</div>
              <div style={{ color: '#fff', 'font-size': '18px', 'font-weight': 'bold' }}>
                {(ddData()?.average_drawdown * 100).toFixed(2)}%
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* Sector HHI Card */}
      <div
        style={{
          background: '#141414',
          'border-radius': '12px',
          padding: '20px',
          border: '1px solid #303030',
        }}
      >
        <div
          style={{
            display: 'flex',
            'justify-content': 'space-between',
            'align-items': 'center',
            'margin-bottom': '16px',
          }}
        >
          <h3 style={{ color: '#fff', margin: 0 }}>🏭 板块集中度 HHI</h3>
          <Show when={hhiData()}>
            <span
              style={{
                color: hhiColor(hhiData()?.hhi || 0),
                'font-size': '24px',
                'font-weight': 'bold',
              }}
            >
              {hhiData()?.hhi?.toFixed(4)}
            </span>
          </Show>
        </div>
        <Show when={hhiData()} fallback={<span style={{ color: '#888' }}>加载中...</span>}>
          <div
            style={{
              display: 'flex',
              'align-items': 'center',
              gap: '12px',
              'margin-bottom': '16px',
            }}
          >
            <span>风险等级: {levelBadge(hhiData()?.hhi_level || 'unknown')}</span>
            <Show when={hhiData()?.concentration_warning}>
              <span style={{ color: '#ff4d4f', 'font-size': '12px' }}>⚠️ 集中度过高警告</span>
            </Show>
          </div>
          <div style={{ display: 'grid', 'grid-template-columns': 'repeat(5, 1fr)', gap: '8px' }}>
            <For each={hhiData()?.top_sectors || []}>
              {(sector: any) => (
                <div
                  style={{
                    background: '#1e1e1e',
                    padding: '10px',
                    'border-radius': '8px',
                    'text-align': 'center',
                  }}
                >
                  <div style={{ color: '#888', 'font-size': '11px' }}>{sector.sector}</div>
                  <div style={{ color: '#fff', 'font-size': '16px', 'font-weight': 'bold' }}>
                    {sector.weight?.toFixed(1)}%
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Emergency Stop-Loss Card */}
      <div
        style={{
          background: '#141414',
          'border-radius': '12px',
          padding: '20px',
          border: '1px solid #303030',
        }}
      >
        <h3 style={{ color: '#fff', margin: '0 0 16px 0' }}>🚨 紧急止损协议</h3>
        <Show when={emergencyData()} fallback={<span style={{ color: '#888' }}>加载中...</span>}>
          <div style={{ display: 'grid', 'grid-template-columns': 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
              <div style={{ color: '#888', 'font-size': '12px' }}>熔断触发</div>
              <div
                style={{
                  color: emergencyData()?.circuit_breaker_triggered ? '#ff4d4f' : '#52c41a',
                  'font-size': '18px',
                  'font-weight': 'bold',
                }}
              >
                {emergencyData()?.circuit_breaker_triggered ? '⚠️ 是' : '✅ 否'}
              </div>
            </div>
            <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
              <div style={{ color: '#888', 'font-size': '12px' }}>强减仓触发</div>
              <div
                style={{
                  color: emergencyData()?.forced_reduction_triggered ? '#ff4d4f' : '#52c41a',
                  'font-size': '18px',
                  'font-weight': 'bold',
                }}
              >
                {emergencyData()?.forced_reduction_triggered ? '⚠️ 是' : '✅ 否'}
              </div>
            </div>
            <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
              <div style={{ color: '#888', 'font-size': '12px' }}>黑天鹅事件</div>
              <div
                style={{
                  color: emergencyData()?.black_swan_triggered ? '#ff4d4f' : '#52c41a',
                  'font-size': '18px',
                  'font-weight': 'bold',
                }}
              >
                {emergencyData()?.black_swan_triggered ? '⚠️ 是' : '✅ 否'}
              </div>
            </div>
          </div>
          <Show when={(emergencyData()?.black_swan_events || []).length > 0}>
            <div style={{ 'margin-top': '12px' }}>
              <For each={emergencyData()?.black_swan_events || []}>
                {(ev: any) => (
                  <div
                    style={{
                      background: '#2a1a1a',
                      padding: '8px 12px',
                      'border-radius': '6px',
                      'margin-bottom': '6px',
                      border: '1px solid #5a1a1a',
                    }}
                  >
                    <span style={{ color: '#ff4d4f' }}>
                      黑天鹅: {ev.date} 收益 {ev.return_pct?.toFixed(2)}% Z={ev.z_score?.toFixed(2)}{' '}
                      [{ev.severity}]
                    </span>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );

  const PretradePanel = () => (
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '16px' }}>
      <div
        style={{
          background: '#141414',
          'border-radius': '12px',
          padding: '20px',
          border: '1px solid #303030',
        }}
      >
        <h3 style={{ color: '#fff', margin: '0 0 16px 0' }}>🔍 下单前风控检查</h3>
        <div
          style={{
            display: 'grid',
            'grid-template-columns': '200px 1fr 1fr 1fr',
            gap: '12px',
            'align-items': 'end',
          }}
        >
          <div>
            <label
              style={{
                color: '#888',
                'font-size': '12px',
                display: 'block',
                'margin-bottom': '4px',
              }}
              for="ra-ts-code"
            >
              股票代码
            </label>
            <input
              id="ra-ts-code"
              type="text"
              value={precheckTsCode()}
              onInput={(e) => setPrecheckTsCode(e.currentTarget.value)}
              placeholder="600519.SH"
              style={{
                background: '#1e1e1e',
                border: '1px solid #303030',
                color: '#fff',
                padding: '8px 12px',
                'border-radius': '6px',
                width: '100%',
                'font-size': '14px',
              }}
              aria-label="风控检查股票代码"
            />
          </div>
          <div>
            <label
              style={{
                color: '#888',
                'font-size': '12px',
                display: 'block',
                'margin-bottom': '4px',
              }}
              for="ra-direction"
            >
              方向
            </label>
            <select
              id="ra-direction"
              value={precheckDir()}
              onChange={(e) => setPrecheckDir(e.currentTarget.value as 'long' | 'short')}
              style={{
                background: '#1e1e1e',
                border: '1px solid #303030',
                color: '#fff',
                padding: '8px 12px',
                'border-radius': '6px',
                width: '100%',
                'font-size': '14px',
              }}
            >
              <option value="long">买入 (long)</option>
              <option value="short">卖出 (short)</option>
            </select>
          </div>
          <div>
            <label
              style={{
                color: '#888',
                'font-size': '12px',
                display: 'block',
                'margin-bottom': '4px',
              }}
              for="ra-volume"
            >
              数量
            </label>
            <input
              id="ra-volume"
              type="number"
              value={precheckVolume()}
              onInput={(e) => setPrecheckVolume(parseInt(e.currentTarget.value) || 0)}
              placeholder="100"
              style={{
                background: '#1e1e1e',
                border: '1px solid #303030',
                color: '#fff',
                padding: '8px 12px',
                'border-radius': '6px',
                width: '100%',
                'font-size': '14px',
              }}
              aria-label="风控检查数量"
            />
          </div>
          <div>
            <label
              style={{
                color: '#888',
                'font-size': '12px',
                display: 'block',
                'margin-bottom': '4px',
              }}
              for="ra-price"
            >
              价格 (可选)
            </label>
            <input
              id="ra-price"
              type="number"
              value={precheckPrice() ?? ''}
              onInput={(e) =>
                setPrecheckPrice(e.currentTarget.value ? parseFloat(e.currentTarget.value) : null)
              }
              placeholder="市价"
              style={{
                background: '#1e1e1e',
                border: '1px solid #303030',
                color: '#fff',
                padding: '8px 12px',
                'border-radius': '6px',
                width: '100%',
                'font-size': '14px',
              }}
              aria-label="风控检查价格（可选）"
            />
          </div>
        </div>
        <button
          onClick={runPrecheck}
          style={{
            'margin-top': '12px',
            padding: '10px 24px',
            background: '#1890ff',
            color: '#fff',
            border: 'none',
            'border-radius': '6px',
            cursor: 'pointer',
            'font-size': '14px',
            'font-weight': 'bold',
          }}
        >
          执行风控检查
        </button>

        <Show when={precheckResult()}>
          <div
            style={{
              'margin-top': '16px',
              background: '#1e1e1e',
              padding: '16px',
              'border-radius': '8px',
              border: `2px solid ${precheckResult()?.pass ? '#52c41a' : '#ff4d4f'}`,
            }}
          >
            <div
              style={{
                color: precheckResult()?.pass ? '#52c41a' : '#ff4d4f',
                'font-size': '18px',
                'font-weight': 'bold',
                'margin-bottom': '12px',
              }}
            >
              {precheckResult()?.pass
                ? '✅ 允许下单'
                : `❌ 拒绝: ${precheckResult()?.reason || '未知原因'}`}
            </div>
            <Show when={precheckResult()?.checks}>
              <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
                <For each={Object.entries(precheckResult()?.checks || {})}>
                  {([key, val]: [string, any]) => (
                    <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                      <span
                        style={{
                          color: val?.passed !== false ? '#52c41a' : '#ff4d4f',
                          'font-size': '14px',
                        }}
                      >
                        {val?.passed !== false ? '✅' : '❌'}
                      </span>
                      <span style={{ color: '#fff', 'font-size': '13px' }}>
                        {key}: {val?.message || JSON.stringify(val)}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );

  const MarginPanel = () => (
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '16px' }}>
      <div
        style={{
          background: '#141414',
          'border-radius': '12px',
          padding: '20px',
          border: '1px solid #303030',
        }}
      >
        <div
          style={{
            display: 'flex',
            'justify-content': 'space-between',
            'align-items': 'center',
            'margin-bottom': '16px',
          }}
        >
          <h3 style={{ color: '#fff', margin: 0 }}>💳 保证金 / MarginCall 预警</h3>
          <button
            onClick={loadMarginData}
            style={{
              padding: '6px 16px',
              background: '#1890ff',
              color: '#fff',
              border: 'none',
              'border-radius': '6px',
              cursor: 'pointer',
              'font-size': '12px',
            }}
          >
            🔄 刷新
          </button>
        </div>
        <Show
          when={marginData()}
          fallback={
            <div style={{ 'text-align': 'center', color: '#888', padding: '40px' }}>
              <div>点击刷新加载保证金数据</div>
            </div>
          }
        >
          <div
            style={{
              display: 'grid',
              'grid-template-columns': 'repeat(4, 1fr)',
              gap: '12px',
              'margin-bottom': '16px',
            }}
          >
            <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
              <div style={{ color: '#888', 'font-size': '12px' }}>保证金总额</div>
              <div style={{ color: '#fff', 'font-size': '18px', 'font-weight': 'bold' }}>
                ¥{marginData()?.total_margin?.toLocaleString()}
              </div>
            </div>
            <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
              <div style={{ color: '#888', 'font-size': '12px' }}>账户权益</div>
              <div style={{ color: '#fff', 'font-size': '18px', 'font-weight': 'bold' }}>
                ¥{marginData()?.account_equity?.toLocaleString()}
              </div>
            </div>
            <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
              <div style={{ color: '#888', 'font-size': '12px' }}>保证金率</div>
              <div
                style={{
                  color: marginColor(marginData()?.margin_ratio || 0),
                  'font-size': '18px',
                  'font-weight': 'bold',
                }}
              >
                {(marginData()?.margin_ratio * 100).toFixed(2)}%
              </div>
            </div>
            <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
              <div style={{ color: '#888', 'font-size': '12px' }}>MarginCall</div>
              <div
                style={{
                  color: marginData()?.margin_call_triggered ? '#ff4d4f' : '#52c41a',
                  'font-size': '18px',
                  'font-weight': 'bold',
                }}
              >
                {marginData()?.margin_call_triggered ? '⚠️ 触发' : '✅ 未触发'}
              </div>
            </div>
          </div>
          <Show when={(marginData()?.margin_items || []).length > 0}>
            <table style={{ width: '100%', 'border-collapse': 'collapse' }}>
              <thead>
                <tr
                  style={{
                    color: '#888',
                    'font-size': '12px',
                    'border-bottom': '1px solid #303030',
                  }}
                >
                  <th style={{ padding: '8px', 'text-align': 'left' }}>股票</th>
                  <th style={{ padding: '8px', 'text-align': 'left' }}>方向</th>
                  <th style={{ padding: '8px', 'text-align': 'right' }}>数量</th>
                  <th style={{ padding: '8px', 'text-align': 'right' }}>价格</th>
                  <th style={{ padding: '8px', 'text-align': 'right' }}>保证金</th>
                  <th style={{ padding: '8px', 'text-align': 'right' }}>保证金比例</th>
                </tr>
              </thead>
              <tbody>
                <For each={marginData()?.margin_items || []}>
                  {(item: any) => (
                    <tr
                      style={{
                        color: '#fff',
                        'font-size': '13px',
                        'border-bottom': '1px solid #222',
                      }}
                    >
                      <td style={{ padding: '8px' }}>{item.ts_code}</td>
                      <td
                        style={{
                          padding: '8px',
                          color: item.direction === 'long' ? '#ff6b6b' : '#51cf66',
                        }}
                      >
                        {item.direction}
                      </td>
                      <td style={{ padding: '8px', 'text-align': 'right' }}>
                        {item.volume?.toLocaleString()}
                      </td>
                      <td style={{ padding: '8px', 'text-align': 'right' }}>
                        ¥{item.price?.toFixed(2)}
                      </td>
                      <td style={{ padding: '8px', 'text-align': 'right' }}>
                        ¥{item.margin_required?.toLocaleString()}
                      </td>
                      <td style={{ padding: '8px', 'text-align': 'right' }}>
                        {(item.margin_ratio * 100).toFixed(1)}%
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </Show>
        </Show>
      </div>
    </div>
  );

  const LiquidityPanel = () => (
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '16px' }}>
      <div
        style={{
          background: '#141414',
          'border-radius': '12px',
          padding: '20px',
          border: '1px solid #303030',
        }}
      >
        <div
          style={{
            display: 'flex',
            'justify-content': 'space-between',
            'align-items': 'center',
            'margin-bottom': '16px',
          }}
        >
          <h3 style={{ color: '#fff', margin: 0 }}>💧 流动性风险分析</h3>
          <button
            onClick={loadLiquidityData}
            style={{
              padding: '6px 16px',
              background: '#1890ff',
              color: '#fff',
              border: 'none',
              'border-radius': '6px',
              cursor: 'pointer',
              'font-size': '12px',
            }}
          >
            🔄 刷新
          </button>
        </div>
        <Show
          when={liqData()}
          fallback={
            <div style={{ 'text-align': 'center', color: '#888', padding: '40px' }}>
              <div>点击刷新加载流动性数据</div>
            </div>
          }
        >
          <div
            style={{
              display: 'grid',
              'grid-template-columns': 'repeat(3, 1fr)',
              gap: '12px',
              'margin-bottom': '16px',
            }}
          >
            <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
              <div style={{ color: '#888', 'font-size': '12px' }}>低流动性持仓</div>
              <div style={{ color: '#ff4d4f', 'font-size': '18px', 'font-weight': 'bold' }}>
                {liqData()?.illiquid_positions}
              </div>
            </div>
            <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
              <div style={{ color: '#888', 'font-size': '12px' }}>最差比例</div>
              <div style={{ color: '#fa8c16', 'font-size': '18px', 'font-weight': 'bold' }}>
                {liqData()?.worst_ratio?.toFixed(2)}x
              </div>
            </div>
            <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
              <div style={{ color: '#888', 'font-size': '12px' }}>平均比例</div>
              <div style={{ color: '#faad14', 'font-size': '18px', 'font-weight': 'bold' }}>
                {liqData()?.avg_ratio?.toFixed(2)}x
              </div>
            </div>
          </div>
          <Show when={(liqData()?.liquidity_items || []).length > 0}>
            <table style={{ width: '100%', 'border-collapse': 'collapse' }}>
              <thead>
                <tr
                  style={{
                    color: '#888',
                    'font-size': '12px',
                    'border-bottom': '1px solid #303030',
                  }}
                >
                  <th style={{ padding: '8px', 'text-align': 'left' }}>股票</th>
                  <th style={{ padding: '8px', 'text-align': 'right' }}>持仓量</th>
                  <th style={{ padding: '8px', 'text-align': 'right' }}>20日均量</th>
                  <th style={{ padding: '8px', 'text-align': 'right' }}>占比</th>
                  <th style={{ padding: '8px', 'text-align': 'right' }}>预计变现天数</th>
                  <th style={{ padding: '8px', 'text-align': 'center' }}>预警</th>
                </tr>
              </thead>
              <tbody>
                <For each={liqData()?.liquidity_items || []}>
                  {(item: any) => (
                    <tr
                      style={{
                        color: '#fff',
                        'font-size': '13px',
                        'border-bottom': '1px solid #222',
                      }}
                    >
                      <td style={{ padding: '8px' }}>{item.ts_code}</td>
                      <td style={{ padding: '8px', 'text-align': 'right' }}>
                        {item.position_volume?.toLocaleString()}
                      </td>
                      <td style={{ padding: '8px', 'text-align': 'right' }}>
                        {item.adv_20d?.toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: '8px',
                          'text-align': 'right',
                          color:
                            item.ratio > 1 ? '#ff4d4f' : item.ratio > 0.2 ? '#fa8c16' : '#52c41a',
                        }}
                      >
                        {item.ratio?.toFixed(2)}x
                      </td>
                      <td style={{ padding: '8px', 'text-align': 'right' }}>
                        {item.days_to_liquidate === 999 ? '>999' : item.days_to_liquidate}
                      </td>
                      <td style={{ padding: '8px', 'text-align': 'center' }}>
                        {item.warning ? (
                          <span style={{ color: '#ff4d4f' }}>⚠️</span>
                        ) : (
                          <span style={{ color: '#52c41a' }}>✅</span>
                        )}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </Show>
        </Show>
      </div>
    </div>
  );

  const RulesPanel = () => (
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '16px' }}>
      {/* Create Rule */}
      <div
        style={{
          background: '#141414',
          'border-radius': '12px',
          padding: '20px',
          border: '1px solid #303030',
        }}
      >
        <h3 style={{ color: '#fff', margin: '0 0 16px 0' }}>➕ 创建预警规则</h3>
        <div
          style={{
            display: 'grid',
            'grid-template-columns': '150px 1fr',
            gap: '12px',
            'align-items': 'end',
          }}
        >
          <div>
            <label
              style={{
                color: '#888',
                'font-size': '12px',
                display: 'block',
                'margin-bottom': '4px',
              }}
            >
              预警类型
            </label>
            <select
              value={ruleType()}
              onChange={(e) => setRuleType(e.currentTarget.value as any)}
              style={{
                background: '#1e1e1e',
                border: '1px solid #303030',
                color: '#fff',
                padding: '8px 12px',
                'border-radius': '6px',
                width: '100%',
                'font-size': '14px',
              }}
            >
              <option value="price">价格预警</option>
              <option value="change">涨跌幅预警</option>
              <option value="volume">成交量预警</option>
              <option value="pnl">盈亏预警</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              value={precheckTsCode()}
              onInput={(e) => setPrecheckTsCode(e.currentTarget.value)}
              placeholder="股票代码"
              style={{
                flex: 1,
                background: '#1e1e1e',
                border: '1px solid #303030',
                color: '#fff',
                padding: '8px 12px',
                'border-radius': '6px',
                'font-size': '14px',
              }}
            />
            <button
              onClick={createAlertRule}
              style={{
                padding: '8px 24px',
                background: '#1890ff',
                color: '#fff',
                border: 'none',
                'border-radius': '6px',
                cursor: 'pointer',
                'font-size': '14px',
                'font-weight': 'bold',
              }}
            >
              创建规则
            </button>
          </div>
        </div>
      </div>

      {/* Existing Rules */}
      <div
        style={{
          background: '#141414',
          'border-radius': '12px',
          padding: '20px',
          border: '1px solid #303030',
        }}
      >
        <div
          style={{
            display: 'flex',
            'justify-content': 'space-between',
            'align-items': 'center',
            'margin-bottom': '16px',
          }}
        >
          <h3 style={{ color: '#fff', margin: 0 }}>📋 预警规则列表</h3>
          <button
            onClick={loadAlertRules}
            style={{
              padding: '6px 16px',
              background: '#333',
              color: '#fff',
              border: 'none',
              'border-radius': '6px',
              cursor: 'pointer',
              'font-size': '12px',
            }}
          >
            🔄 刷新
          </button>
        </div>
        <Show when={alertRules().length === 0}>
          <div style={{ 'text-align': 'center', color: '#888', padding: '40px' }}>暂无预警规则</div>
        </Show>
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
          <For each={alertRules()}>
            {(rule: any) => (
              <div
                style={{
                  background: '#1e1e1e',
                  padding: '12px 16px',
                  'border-radius': '8px',
                  display: 'flex',
                  'justify-content': 'space-between',
                  'align-items': 'center',
                }}
              >
                <div>
                  <span style={{ color: '#fff', 'font-size': '14px', 'font-weight': 'bold' }}>
                    {rule.ts_code}
                  </span>
                  <span
                    style={{
                      'margin-left': '12px',
                      color: '#888',
                      'font-size': '12px',
                      background: '#2a2a2a',
                      padding: '2px 8px',
                      'border-radius': '4px',
                    }}
                  >
                    {rule.alert_type === 'price'
                      ? '价格'
                      : rule.alert_type === 'change'
                        ? '涨跌幅'
                        : rule.alert_type === 'volume'
                          ? '成交量'
                          : '盈亏'}
                  </span>
                  <span style={{ 'margin-left': '8px', color: '#52c41a', 'font-size': '12px' }}>
                    {rule.status}
                  </span>
                </div>
                <button
                  onClick={() => deleteAlertRule(rule.id)}
                  style={{
                    padding: '4px 12px',
                    background: '#ff4d4f',
                    color: '#fff',
                    border: 'none',
                    'border-radius': '4px',
                    cursor: 'pointer',
                    'font-size': '12px',
                  }}
                >
                  删除
                </button>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  const tabs = [
    { key: 'overview', label: '📊 风控总览' },
    { key: 'pretrade', label: '🔍 交易前检查' },
    { key: 'margin', label: '💳 保证金' },
    { key: 'liquidity', label: '💧 流动性' },
    { key: 'rules', label: '📋 预警规则' },
  ] as const;

  return (
    <div style={{ padding: '24px', 'max-width': '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          'justify-content': 'space-between',
          'align-items': 'center',
          'margin-bottom': '24px',
        }}
      >
        <div>
          <h1 style={{ color: '#fff', margin: 0, 'font-size': '24px' }}>风险预警系统</h1>
          <p style={{ color: '#888', margin: '4px 0 0', 'font-size': '13px' }}>
            VaR · 最大回撤 · 板块集中度 · 流动性 · 保证金
          </p>
        </div>
        <button
          onClick={loadRiskOverview}
          style={{
            padding: '8px 20px',
            background: '#1890ff',
            color: '#fff',
            border: 'none',
            'border-radius': '6px',
            cursor: 'pointer',
            'font-size': '14px',
          }}
        >
          🔄 刷新全部
        </button>
      </div>

      <Show when={error()}>
        <div
          style={{
            background: '#2a1a1a',
            border: '1px solid #5a1a1a',
            padding: '12px',
            'border-radius': '8px',
            color: '#ff4d4f',
            'margin-bottom': '16px',
          }}
        >
          {error()}
        </div>
      </Show>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          'margin-bottom': '20px',
          background: '#1a1a1a',
          padding: '4px',
          'border-radius': '10px',
          width: 'fit-content',
        }}
      >
        <For each={tabs}>
          {(tab) => (
            <button
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 20px',
                background: activeTab() === tab.key ? '#1890ff' : 'transparent',
                color: activeTab() === tab.key ? '#fff' : '#888',
                border: 'none',
                'border-radius': '6px',
                cursor: 'pointer',
                'font-size': '14px',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          )}
        </For>
      </div>

      {/* Tab Content */}
      <Show when={activeTab() === 'overview'}>
        <OverviewPanel />
      </Show>
      <Show when={activeTab() === 'pretrade'}>
        <PretradePanel />
      </Show>
      <Show when={activeTab() === 'margin'}>
        <MarginPanel />
      </Show>
      <Show when={activeTab() === 'liquidity'}>
        <LiquidityPanel />
      </Show>
      <Show when={activeTab() === 'rules'}>
        <RulesPanel />
      </Show>
    </div>
  );
};

export default RiskAlert;
