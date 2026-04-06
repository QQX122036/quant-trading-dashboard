// News & Sentiment API — 追加到 useApi.ts

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  publish_time: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  sentiment_score: number; // 0-100, >50 bullish
  ts_code?: string;
  url?: string;
  summary?: string;
}

export interface SentimentSummary {
  ts_code: string;
  bullish_pct: number;
  bearish_pct: number;
  neutral_pct: number;
  sentiment_index: number; // 0-100
  news_count: number;
  date: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  exchange: 'SSE' | 'SZSE';
  announcement_type: string; // 业绩预告 | 年报 | 分红 | 并购 | 股权变动 | 其他
  ts_code?: string;
  publish_time: string;
  is_important: boolean; // 重点公告
  url?: string;
  summary?: string;
}

export interface AdvisorResponse {
  answer: string;
  charts?: Array<{ type: 'table' | 'line' | 'bar'; data: unknown; title?: string }>;
  tables?: Array<{ headers: string[]; rows: string[][]; title?: string }>;
}

// GET /api/news/sentiment?ts_code=600519.SH
export async function fetchNewsSentiment(
  ts_code?: string
): Promise<ApiResponse<{ summary: SentimentSummary; news: NewsItem[] }>> {
  const params = ts_code ? `?ts_code=${encodeURIComponent(ts_code)}` : '';
  return apiFetch<{ summary: SentimentSummary; news: NewsItem[] }>(`/api/news/sentiment${params}`);
}

// GET /api/news/announcements?ts_code=xxx&type=年报
export async function fetchAnnouncements(
  ts_code?: string,
  announcement_type?: string
): Promise<ApiResponse<{ items: AnnouncementItem[]; total: number }>> {
  const p = new URLSearchParams();
  if (ts_code) p.set('ts_code', ts_code);
  if (announcement_type) p.set('type', announcement_type);
  const qs = p.toString();
  return apiFetch<{ items: AnnouncementItem[]; total: number }>(
    `/api/news/announcements${qs ? `?${qs}` : ''}`
  );
}

// POST /api/ai/advisor { question }
export async function askAIAdvisor(
  question: string,
  context?: { ts_code?: string; portfolio_summary?: string }
): Promise<ApiResponse<AdvisorResponse>> {
  return apiFetch<AdvisorResponse>('/api/ai/advisor', {
    method: 'POST',
    body: JSON.stringify({ question, ...context }),
  });
}
