/**
 * RiskAlert - 风险预警系统主页面
 *
 * OOM 防护措施：
 * 1. AbortController 请求取消机制（页面卸载/重新加载时取消未完成请求）
 * 2. 独立卡片级加载状态（互不影响，不会一个失败全部阻塞）
 * 3. 懒加载非首屏数据（Tab切换时才加载对应数据）
 * 4. 分页/数据量限制（HHI 板块最多显示10个）
 * 5. 顺序加载而非全并发（VaR→Drawdown→HHI，每次间隔300ms）
 */

import { Component, createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

// ── apiFetch with AbortController ────────────────────────────────────────────
async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
  signal?: AbortSignal
): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
    signal,
  });
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ code: `HTTP_${res.status}`, message: res.statusText }));
    throw err;
  }
  return res.json() as Promise<T>;
}

// ── Component ───────────────────────────────────────────────────────────────
const RiskAlert: Component = () => {
  const [activeTab, setActiveTab] = createSignal<
    'overview' | 'pretrade' | 'rules' | 'margin' | 'liquidity'
  >('overview');

  // Per-card loading states
  const [loadingVar, setLoadingVar] = createSignal(false);
  const [loadingDd, setLoadingDd] = createSignal(false);
  const [loadingHhi, setLoadingHhi] = createSignal(false);
  const [loadingEmergency, setLoadingEmergency] = createSignal(false);
  const [loadingMargin, setLoadingMargin] = createSignal(false);
  const [loadingLiq, setLoadingLiq] = createSignal(false);
  const [loadingRules, setLoadingRules] = createSignal(false);

  // Per-card error states
  const [errorVar, setErrorVar] = createSignal('');
  const [errorDd, setErrorDd] = createSignal('');
  const [errorHhi, setErrorHhi] = createSignal('');

  // Data states
  const [varData, setVarData] = createSignal<any>(null);
  const [ddData, setDdData] = createSignal<any>(null);
  const [hhiData, setHhiData] = createSignal<any>(null);
  const [emergencyData, setEmergencyData] = createSignal<any>(null);
  const [marginData, setMarginData] = createSignal<any>(null);
  const [liqData, setLiqData] = createSignal<any>(null);
  const [alertRules, setAlertRules] = createSignal<any[]>([]);

  // Pre-check
  const [precheckTsCode, setPrecheckTsCode] = createSignal('600519.SH');
  const [precheckDir, setPrecheckDir] = createSignal<'long' | 'short'>('long');
  const [precheckVolume, setPrecheckVolume] = createSignal(100);
  const [precheckPrice, setPrecheckPrice] = createSignal<number | null>(null);
  const [precheckResult, setPrecheckResult] = createSignal<any>(null);
  const [precheckLoading, setPrecheckLoading] = createSignal(false);

  // Rule creation
  const [ruleType, setRuleType] = createSignal<'price' | 'change' | 'volume' | 'pnl'>('price');

  // Global abort controller — cancelled on component destroy
  const controller = new AbortController();

  onCleanup(() => {
    controller.abort('component unmounted');
  });

  // ── Individual data loaders ───────────────────────────────────────────────

  const loadVar = async () => {
    setLoadingVar(true);
    setErrorVar('');
    try {
      const data = await apiFetch(
        '/api/risk/var?confidence=0.95&lookback_days=252&account_id=sim_default',
        {},
        controller.signal
      );
      if (data?.code === 0 || data?.success) setVarData(data);
    } catch (e: any) {
      if (e.name !== 'AbortError') setErrorVar(e.message || 'VaR 数据加载失败');
    } finally {
      setLoadingVar(false);
    }
  };

  const loadDrawdown = async () => {
    setLoadingDd(true);
    setErrorDd('');
    try {
      const data = await apiFetch(
        '/api/risk/max-drawdown?account_id=sim_default&simulations=5000',
        {},
        controller.signal
      );
      if (data?.success) setDdData(data);
    } catch (e: any) {
      if (e.name !== 'AbortError') setErrorDd(e.message || '回撤数据加载失败');
    } finally {
      setLoadingDd(false);
    }
  };

  const loadHhi = async () => {
    setLoadingHhi(true);
    setErrorHhi('');
    try {
      const data = await apiFetch(
        '/api/risk/sector-hhi?account_id=sim_default',
        {},
        controller.signal
      );
      if (data?.success) setHhiData(data);
    } catch (e: any) {
      if (e.name !== 'AbortError') setErrorHhi(e.message || 'HHI数据加载失败');
    } finally {
      setLoadingHhi(false);
    }
  };

  const loadEmergency = async () => {
    setLoadingEmergency(true);
    try {
      const data = await apiFetch(
        '/api/risk/emergency?account_id=sim_default',
        {},
        controller.signal
      );
      if (data?.success) setEmergencyData(data);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('[RiskAlert] emergency数据加载失败:', e.message);
      }
    } finally {
      setLoadingEmergency(false);
    }
  };

  const loadMarginData = async () => {
    setLoadingMargin(true);
    try {
      const data = await apiFetch('/api/risk/margin?account_id=sim_default', {}, controller.signal);
      if (data?.success) setMarginData(data);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('[RiskAlert] margin数据加载失败:', e.message);
      }
    } finally {
      setLoadingMargin(false);
    }
  };

  const loadLiquidityData = async () => {
    setLoadingLiq(true);
    try {
      const data = await apiFetch(
        '/api/risk/liquidity?account_id=sim_default',
        {},
        controller.signal
      );
      if (data?.success) setLiqData(data);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('[RiskAlert] liquidity数据加载失败:', e.message);
      }
    } finally {
      setLoadingLiq(false);
    }
  };

  const loadAlertRules = async () => {
    setLoadingRules(true);
    try {
      const res: any = await apiFetch('/api/alerts/rules', {}, controller.signal);
      if (res?.code === 0) setAlertRules(res.data?.rules || []);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('[RiskAlert] alertRules加载失败:', e.message);
      }
    } finally {
      setLoadingRules(false);
    }
  };

  // Sequential overview load (prevents burst of 3 simultaneous heavy requests)
  const loadRiskOverview = async () => {
    await loadVar();
    await new Promise((r) => setTimeout(r, 300));
    await loadDrawdown();
    await new Promise((r) => setTimeout(r, 300));
    await loadHhi();
  };

  // ── Pre-check ─────────────────────────────────────────────────────────────
  const runPrecheck = async () => {
    setPrecheckResult(null);
    setPrecheckLoading(true);
    try {
      const body = {
        ts_code: precheckTsCode(),
        direction: precheckDir(),
        volume: precheckVolume(),
        price: precheckPrice(),
        account_id: 'sim_default',
      };
      const res: any = await apiFetch(
        '/api/risk/precheck',
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
        controller.signal
      );
      setPrecheckResult(res?.data || res);
    } catch (e: any) {
      if (e.name !== 'AbortError') setPrecheckResult({ pass: false, reason: e.message });
    } finally {
      setPrecheckLoading(false);
    }
  };

  // ── Alert rules ──────────────────────────────────────────────────────────
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
      const res: any = await apiFetch(
        `/api/alerts/${ruleType()}`,
        { method: 'POST', body: JSON.stringify(payload) },
        controller.signal
      );
      if (res?.code === 0) await loadAlertRules();
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('[RiskAlert] 创建预警规则失败:', e.message);
      }
    }
  };

  const deleteAlertRule = async (ruleId: number) => {
    try {
      await apiFetch(`/api/alerts/rules/${ruleId}`, { method: 'DELETE' }, controller.signal);
      await loadAlertRules();
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('[RiskAlert] 删除预警规则失败:', e.message);
      }
    }
  };

  // ── Lifecycle ────────────────────────────────────────────────────────────
  onMount(() => {
    loadRiskOverview();
    loadAlertRules();
    loadEmergency();
  });

  // ── Helpers ──────────────────────────────────────────────────────────────
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

  // Plain function returning JSX.Element (not a Component)
  const skeletonRows = (): JSX.Element => (
    <div style={{ display: 'grid', 'grid-template-columns': 'repeat(3, 1fr)', gap: '12px' }}>
      {[0, 1, 2].map(() => (
        <div
          style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px', height: '60px' }}
        >
          <div
            style={{
              background: '#2a2a2a',
              height: '12px',
              'border-radius': '4px',
              width: '60%',
              'margin-bottom': '8px',
            }}
          />
          <div
            style={{ background: '#2a2a2a', height: '18px', 'border-radius': '4px', width: '80%' }}
          />
        </div>
      ))}
    </div>
  );

  // ── Tab panels ──────────────────────────────────────────────────────────

  const OverviewPanel = (): JSX.Element => (
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
          <Show when={varData() && !loadingVar()}>
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
        <Show when={loadingVar()}>{skeletonRows()}</Show>
        <Show when={errorVar()}>
          <div
            style={{
              color: '#ff4d4f',
              padding: '12px',
              background: '#2a1a1a',
              'border-radius': '8px',
              'font-size': '13px',
            }}
          >
            ⚠️ {errorVar()}{' '}
            <button
              onClick={loadVar}
              style={{
                'margin-left': '12px',
                background: '#333',
                color: '#fff',
                border: 'none',
                padding: '4px 12px',
                'border-radius': '4px',
                cursor: 'pointer',
              }}
            >
              重试
            </button>
          </div>
        </Show>
        <Show when={varData() && !loadingVar()}>
          <div style={{ display: 'grid', 'grid-template-columns': 'repeat(3, 1fr)', gap: '12px' }}>
            <For
              each={[
                ['VaR (95%置信)', `¥${varData()?.var_absolute?.toLocaleString() ?? '—'}`],
                ['CVaR (条件风险)', `¥${varData()?.cvar_absolute?.toLocaleString() ?? '—'}`],
                ['组合价值', `¥${varData()?.portfolio_value?.toLocaleString() ?? '—'}`],
                ['历史观测', String(varData()?.hist_observations?.toLocaleString() ?? '—')],
                ['波动率 (年化)', `${((varData()?.volatility || 0) * 100).toFixed(2)}%`],
                ['计算方法', varData()?.method || 'historical'],
              ]}
            >
              {([label, value]) => (
                <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
                  <div style={{ color: '#888', 'font-size': '12px' }}>{label}</div>
                  <div style={{ color: '#fff', 'font-size': '18px', 'font-weight': 'bold' }}>
                    {value}
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
        <Show when={!varData() && !loadingVar() && !errorVar()}>
          <div style={{ 'text-align': 'center', color: '#888', padding: '20px' }}>
            <button
              onClick={loadVar}
              style={{
                background: '#1890ff',
                color: '#fff',
                border: 'none',
                padding: '8px 20px',
                'border-radius': '6px',
                cursor: 'pointer',
              }}
            >
              加载 VaR 数据
            </button>
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
          <Show when={ddData() && !loadingDd()}>
            <span
              style={{
                color: ddColor(ddData()?.predicted_max_drawdown || 0),
                'font-size': '24px',
                'font-weight': 'bold',
              }}
            >
              {((ddData()?.predicted_max_drawdown || 0) * 100).toFixed(2)}%
            </span>
          </Show>
        </div>
        <Show when={loadingDd()}>{skeletonRows()}</Show>
        <Show when={errorDd()}>
          <div
            style={{
              color: '#ff4d4f',
              padding: '12px',
              background: '#2a1a1a',
              'border-radius': '8px',
              'font-size': '13px',
            }}
          >
            ⚠️ {errorDd()}{' '}
            <button
              onClick={loadDrawdown}
              style={{
                'margin-left': '12px',
                background: '#333',
                color: '#fff',
                border: 'none',
                padding: '4px 12px',
                'border-radius': '4px',
                cursor: 'pointer',
              }}
            >
              重试
            </button>
          </div>
        </Show>
        <Show when={ddData() && !loadingDd()}>
          <div style={{ display: 'grid', 'grid-template-columns': 'repeat(3, 1fr)', gap: '12px' }}>
            <For
              each={[
                ['预测最大回撤', `${((ddData()?.predicted_max_drawdown || 0) * 100).toFixed(2)}%`],
                ['当前回撤', `${((ddData()?.current_drawdown || 0) * 100).toFixed(2)}%`],
                ['最坏情况 (1%)', `${((ddData()?.worst_case || 0) * 100).toFixed(2)}%`],
                ['蒙特卡洛模拟', `${(ddData()?.simulations || 0).toLocaleString()} 次`],
                ['组合价值', `¥${(ddData()?.portfolio_value || 0).toLocaleString()}`],
                ['平均回撤', `${((ddData()?.average_drawdown || 0) * 100).toFixed(2)}%`],
              ]}
            >
              {([label, value]) => (
                <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
                  <div style={{ color: '#888', 'font-size': '12px' }}>{label}</div>
                  <div
                    style={{
                      color: label.includes('最坏') ? '#ff4d4f' : '#fff',
                      'font-size': '18px',
                      'font-weight': 'bold',
                    }}
                  >
                    {value}
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
        <Show when={!ddData() && !loadingDd() && !errorDd()}>
          <div style={{ 'text-align': 'center', color: '#888', padding: '20px' }}>
            <button
              onClick={loadDrawdown}
              style={{
                background: '#1890ff',
                color: '#fff',
                border: 'none',
                padding: '8px 20px',
                'border-radius': '6px',
                cursor: 'pointer',
              }}
            >
              加载回撤数据
            </button>
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
          <Show when={hhiData() && !loadingHhi()}>
            <span
              style={{
                color: hhiColor(hhiData()?.hhi || 0),
                'font-size': '24px',
                'font-weight': 'bold',
              }}
            >
              {(hhiData()?.hhi || 0).toFixed(4)}
            </span>
          </Show>
        </div>
        <Show when={loadingHhi()}>{skeletonRows()}</Show>
        <Show when={errorHhi()}>
          <div
            style={{
              color: '#ff4d4f',
              padding: '12px',
              background: '#2a1a1a',
              'border-radius': '8px',
              'font-size': '13px',
            }}
          >
            ⚠️ {errorHhi()}{' '}
            <button
              onClick={loadHhi}
              style={{
                'margin-left': '12px',
                background: '#333',
                color: '#fff',
                border: 'none',
                padding: '4px 12px',
                'border-radius': '4px',
                cursor: 'pointer',
              }}
            >
              重试
            </button>
          </div>
        </Show>
        <Show when={hhiData() && !loadingHhi()}>
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
          {/* Paginated: show max 10 sectors to avoid OOM */}
          <div style={{ display: 'grid', 'grid-template-columns': 'repeat(5, 1fr)', gap: '8px' }}>
            <For each={(hhiData()?.top_sectors || []).slice(0, 10)}>
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
          <Show when={(hhiData()?.top_sectors?.length || 0) > 10}>
            <div
              style={{
                color: '#888',
                'font-size': '12px',
                'margin-top': '8px',
                'text-align': 'center',
              }}
            >
              显示前 10 个板块，共 {hhiData()?.top_sectors?.length} 个
            </div>
          </Show>
        </Show>
        <Show when={!hhiData() && !loadingHhi() && !errorHhi()}>
          <div style={{ 'text-align': 'center', color: '#888', padding: '20px' }}>
            <button
              onClick={loadHhi}
              style={{
                background: '#1890ff',
                color: '#fff',
                border: 'none',
                padding: '8px 20px',
                'border-radius': '6px',
                cursor: 'pointer',
              }}
            >
              加载 HHI 数据
            </button>
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
        <Show when={loadingEmergency()}>{skeletonRows()}</Show>
        <Show when={emergencyData() && !loadingEmergency()}>
          <div style={{ display: 'grid', 'grid-template-columns': 'repeat(3, 1fr)', gap: '12px' }}>
            <For
              each={[
                ['熔断触发', emergencyData()?.circuit_breaker_triggered],
                ['强减仓触发', emergencyData()?.forced_reduction_triggered],
                ['黑天鹅事件', emergencyData()?.black_swan_triggered],
              ]}
            >
              {([label, triggered]) => (
                <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
                  <div style={{ color: '#888', 'font-size': '12px' }}>{label}</div>
                  <div
                    style={{
                      color: triggered ? '#ff4d4f' : '#52c41a',
                      'font-size': '18px',
                      'font-weight': 'bold',
                    }}
                  >
                    {triggered ? '⚠️ 是' : '✅ 否'}
                  </div>
                </div>
              )}
            </For>
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

  const PretradePanel = (): JSX.Element => (
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
            >
              股票代码
            </label>
            <input
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
            >
              方向
            </label>
            <select
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
            >
              数量
            </label>
            <input
              type="number"
              value={precheckVolume()}
              onInput={(e) => setPrecheckVolume(parseInt(e.currentTarget.value) || 0)}
              style={{
                background: '#1e1e1e',
                border: '1px solid #303030',
                color: '#fff',
                padding: '8px 12px',
                'border-radius': '6px',
                width: '100%',
                'font-size': '14px',
              }}
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
            >
              价格 (可选)
            </label>
            <input
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
            />
          </div>
        </div>
        <button
          onClick={runPrecheck}
          disabled={precheckLoading()}
          style={{
            'margin-top': '12px',
            padding: '10px 24px',
            background: precheckLoading() ? '#444' : '#1890ff',
            color: '#fff',
            border: 'none',
            'border-radius': '6px',
            cursor: precheckLoading() ? 'not-allowed' : 'pointer',
            'font-size': '14px',
            'font-weight': 'bold',
          }}
        >
          {precheckLoading() ? '检查中...' : '执行风控检查'}
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

  const MarginPanel = (): JSX.Element => (
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
              background: loadingMargin() ? '#444' : '#1890ff',
              color: '#fff',
              border: 'none',
              'border-radius': '6px',
              cursor: loadingMargin() ? 'not-allowed' : 'pointer',
              'font-size': '12px',
            }}
          >
            {loadingMargin() ? '加载中...' : '🔄 刷新'}
          </button>
        </div>
        <Show when={!marginData() && !loadingMargin()}>
          <div style={{ 'text-align': 'center', color: '#888', padding: '40px' }}>
            点击刷新加载保证金数据
          </div>
        </Show>
        <Show when={loadingMargin()}>{skeletonRows()}</Show>
        <Show when={marginData() && !loadingMargin()}>
          <div
            style={{
              display: 'grid',
              'grid-template-columns': 'repeat(4, 1fr)',
              gap: '12px',
              'margin-bottom': '16px',
            }}
          >
            <For
              each={[
                ['保证金总额', `¥${marginData()?.total_margin?.toLocaleString() ?? '—'}`],
                ['账户权益', `¥${marginData()?.account_equity?.toLocaleString() ?? '—'}`],
                [
                  '保证金率',
                  `${((marginData()?.margin_ratio || 0) * 100).toFixed(2)}%`,
                  marginData()?.margin_ratio,
                ],
                [
                  'MarginCall',
                  marginData()?.margin_call_triggered ? '⚠️ 触发' : '✅ 未触发',
                  marginData()?.margin_call_triggered,
                ],
              ]}
            >
              {([label, value, color]) => (
                <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
                  <div style={{ color: '#888', 'font-size': '12px' }}>{label}</div>
                  <div
                    style={{
                      color:
                        typeof color === 'number'
                          ? marginColor(color)
                          : color === true
                            ? '#ff4d4f'
                            : color === false
                              ? '#52c41a'
                              : '#fff',
                      'font-size': '18px',
                      'font-weight': 'bold',
                    }}
                  >
                    {value}
                  </div>
                </div>
              )}
            </For>
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
                  <For each={['股票', '方向', '数量', '价格', '保证金', '保证金比例']}>
                    {(h) => (
                      <th
                        style={{
                          padding: '8px',
                          'text-align': h === '股票' || h === '方向' ? 'left' : 'right',
                        }}
                      >
                        {h}
                      </th>
                    )}
                  </For>
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

  const LiquidityPanel = (): JSX.Element => (
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
              background: loadingLiq() ? '#444' : '#1890ff',
              color: '#fff',
              border: 'none',
              'border-radius': '6px',
              cursor: loadingLiq() ? 'not-allowed' : 'pointer',
              'font-size': '12px',
            }}
          >
            {loadingLiq() ? '加载中...' : '🔄 刷新'}
          </button>
        </div>
        <Show when={!liqData() && !loadingLiq()}>
          <div style={{ 'text-align': 'center', color: '#888', padding: '40px' }}>
            点击刷新加载流动性数据
          </div>
        </Show>
        <Show when={loadingLiq()}>{skeletonRows()}</Show>
        <Show when={liqData() && !loadingLiq()}>
          <div
            style={{
              display: 'grid',
              'grid-template-columns': 'repeat(3, 1fr)',
              gap: '12px',
              'margin-bottom': '16px',
            }}
          >
            <For
              each={[
                ['低流动性持仓', liqData()?.illiquid_positions ?? 0, '#ff4d4f'],
                ['最差比例', `${(liqData()?.worst_ratio || 0).toFixed(2)}x`, '#fa8c16'],
                ['平均比例', `${(liqData()?.avg_ratio || 0).toFixed(2)}x`, '#faad14'],
              ]}
            >
              {([label, value, color]) => (
                <div style={{ background: '#1e1e1e', padding: '12px', 'border-radius': '8px' }}>
                  <div style={{ color: '#888', 'font-size': '12px' }}>{label}</div>
                  <div
                    style={{ color: color as string, 'font-size': '18px', 'font-weight': 'bold' }}
                  >
                    {value}
                  </div>
                </div>
              )}
            </For>
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
                  {['股票', '持仓量', '20日均量', '占比', '预计变现天数', '预警'].map((h, i) => (
                    <th style={{ padding: '8px', 'text-align': i === 0 ? 'left' : 'right' }}>
                      {h}
                    </th>
                  ))}
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
                        {(item.ratio || 0).toFixed(2)}x
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

  const RulesPanel = (): JSX.Element => (
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
              background: loadingRules() ? '#444' : '#333',
              color: '#fff',
              border: 'none',
              'border-radius': '6px',
              cursor: loadingRules() ? 'not-allowed' : 'pointer',
              'font-size': '12px',
            }}
          >
            {loadingRules() ? '加载中...' : '🔄 刷新'}
          </button>
        </div>
        <Show when={alertRules().length === 0 && !loadingRules()}>
          <div style={{ 'text-align': 'center', color: '#888', padding: '40px' }}>暂无预警规则</div>
        </Show>
        <Show when={loadingRules()}>
          <div style={{ color: '#888', padding: '20px', 'text-align': 'center' }}>加载中...</div>
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

  // ── Render ───────────────────────────────────────────────────────────────
  const tabs = [
    { key: 'overview' as const, label: '📊 风控总览' },
    { key: 'pretrade' as const, label: '🔍 交易前检查' },
    { key: 'margin' as const, label: '💳 保证金' },
    { key: 'liquidity' as const, label: '💧 流动性' },
    { key: 'rules' as const, label: '📋 预警规则' },
  ];

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
      <Show when={activeTab() === 'overview'}>{OverviewPanel()}</Show>
      <Show when={activeTab() === 'pretrade'}>{PretradePanel()}</Show>
      <Show when={activeTab() === 'margin'}>{MarginPanel()}</Show>
      <Show when={activeTab() === 'liquidity'}>{LiquidityPanel()}</Show>
      <Show when={activeTab() === 'rules'}>{RulesPanel()}</Show>
    </div>
  );
};

export default RiskAlert;
