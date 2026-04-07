/**
 * marketStore.ts — 市场数据状态管理
 * 管理 MarketOverview 页面的所有市场数据
 */
import { createStore } from 'solid-js/store';
import * as api from '../hooks/useApi';
import type { IndexBarItem, SectorItem, HotStockItem, MarketBreadthData, SentimentType } from '../types/api';

// ── Types ───────────────────────────────────────────────────

export interface IndexCardData {
  ts_code: string;
  name: string;
  displayName: string;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  loading: boolean;
  error: string | null;
}

export interface MarketState {
  indices: IndexCardData[];
  sectors: SectorItem[];
  hotStocks: HotStockItem[];
  marketBreadth: MarketBreadthData | null;
  sentiment: SentimentType;
  loading: boolean;
  lastUpdate: string | null;
}

// ── Store ──────────────────────────────────────────────────

const defaultIndices: IndexCardData[] = api.MAJOR_INDICES.map((idx) => ({
  ...idx,
  price: 0,
  change: 0,
  changePercent: 0,
  loading: true,
  error: null,
}));

const [marketState, setMarketState] = createStore<MarketState>({
  indices: defaultIndices,
  sectors: [],
  hotStocks: [],
  marketBreadth: null,
  sentiment: 'neutral',
  loading: true,
  lastUpdate: null,
});

export { marketState };

// ── Helpers ─────────────────────────────────────────────────

function getErrorMsg(e: unknown): string {
  if (e && typeof e === 'object') {
    const err = e as Record<string, unknown>;
    return (err.message as string) || String(e);
  }
  return String(e);
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// 计算单日涨跌额（从日K数据）
function calcChangeFromBars(bars: IndexBarItem[]): { price: number; change: number; changePercent: number } {
  if (!bars || bars.length === 0) return { price: 0, change: 0, changePercent: 0 };
  const latest = bars[0];
  const prev = bars[1];
  const price = latest.close;
  let change = 0;
  let changePercent = 0;
  if (prev && prev.close) {
    change = price - prev.close;
    changePercent = (change / prev.close) * 100;
  } else if (latest.change_pct !== null && latest.change_pct !== undefined) {
    changePercent = latest.change_pct;
    change = price * (changePercent / 100);
  }
  return { price, change, changePercent };
}

// ── Actions ─────────────────────────────────────────────────

export const marketActions = {
  /** 加载单个指数的最新数据 */
  async loadIndex(ts_code: string) {
    const today = formatDate(new Date());
    const startDate = formatDate(new Date(Date.now() - 30 * 24 * 3600 * 1000)); // 30 days back
    const endDate = today;

    // Find the index entry
    const idxEntry = api.MAJOR_INDICES.find((i) => i.ts_code === ts_code);
    if (!idxEntry) return;

    setMarketState(
      'indices',
      (i) => i.ts_code === ts_code,
      { loading: true, error: null }
    );

    try {
      const res = await api.fetchIndexBars(ts_code, startDate, endDate);
      if ((res.code === '0' || Number(res.code)===0) && res.data && res.data.items && res.data.items.length > 0) {
        // 按日期降序排序（最新的在前）
        const bars = res.data.items.sort((a, b) => b.trade_date.localeCompare(a.trade_date));
        const { price, change, changePercent } = calcChangeFromBars(bars);
        setMarketState(
          'indices',
          (i) => i.ts_code === ts_code,
          { price, change, changePercent, loading: false, error: null }
        );
      } else {
        setMarketState(
          'indices',
          (i) => i.ts_code === ts_code,
          { loading: false, error: '暂无数据' }
        );
      }
    } catch (e: unknown) {
      setMarketState(
        'indices',
        (i) => i.ts_code === ts_code,
        { loading: false, error: getErrorMsg(e) }
      );
    }
  },

  /**
   * 加载所有主要指数（错开请求，避免同时发起6个请求导致 429）
   * 每个指数间隔 100ms 发起，减少并发压力
   */
  async loadAllIndices() {
    const STAGGER_MS = 100;
    const indices = api.MAJOR_INDICES;
    // 先标记所有为 loading
    for (const idx of indices) {
      setMarketState(
        'indices',
        (i) => i.ts_code === idx.ts_code,
        { loading: true, error: null }
      );
    }
    // 逐个加载（串行 + 错时）
    for (let i = 0; i < indices.length; i++) {
      // 立即触发，不等上一个完成，只是错开初始时间
      void marketActions.loadIndex(indices[i].ts_code);
      if (i < indices.length - 1) {
        await new Promise((res) => setTimeout(res, STAGGER_MS));
      }
    }
    // 等待所有完成
    setMarketState('lastUpdate', new Date().toLocaleTimeString('zh-CN'));
  },

  /** 加载板块排行 */
  async loadSectorRanking() {
    try {
      const res = await api.fetchSectorRanking(undefined);
      if ((res.code === '0' || Number(res.code)===0) && res.data) {
        setMarketState('sectors', res.data.items);
      }
    } catch (e) {
      console.warn('[MarketStore] Failed to load sector ranking:', e);
    }
  },

  /** 加载热门股票 */
  async loadHotStocks() {
    try {
      const res = await api.fetchHotStocks(undefined);
      if ((res.code === '0' || Number(res.code)===0) && res.data) {
        setMarketState('hotStocks', res.data.items);
      }
    } catch (e) {
      console.warn('[MarketStore] Failed to load hot stocks:', e);
    }
  },

  /** 加载市场宽度 */
  async loadMarketBreadth() {
    try {
      const res = await api.fetchMarketBreadth();
      if ((res.code === '0' || Number(res.code)===0) && res.data) {
        setMarketState('marketBreadth', res.data);
        setMarketState('sentiment', api.calcSentiment(res.data.up_ratio));
      }
    } catch (e) {
      console.warn('[MarketStore] Failed to load market breadth:', e);
    }
  },

  /** 加载全部市场概览数据 */
  async loadAll() {
    setMarketState('loading', true);
    try {
      await Promise.allSettled([
        marketActions.loadAllIndices(),
        marketActions.loadSectorRanking(),
        marketActions.loadHotStocks(),
        marketActions.loadMarketBreadth(),
      ]);
    } catch (e) {
      console.error('[MarketStore] Failed to load all data:', e);
    } finally {
      setMarketState('loading', false);
      setMarketState('lastUpdate', new Date().toLocaleTimeString('zh-CN'));
    }
  },

  /** 刷新单类数据（定时调用） */
  async refresh() {
    await Promise.allSettled([
      marketActions.loadAllIndices(),
      marketActions.loadMarketBreadth(),
    ]);
    setMarketState('lastUpdate', new Date().toLocaleTimeString('zh-CN'));
  },
};
