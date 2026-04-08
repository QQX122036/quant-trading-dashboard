/**
 * logger.ts — 前端统一日志模块
 *
 * 功能：
 * - 分级日志：debug / info / warn / error / critical
 * - 结构化输出：{ level, module, message, data, timestamp, duration? }
 * - 多输出目标：console + errorStore（生产环境上报）
 * - 模块标记：自动从 caller 文件名提取模块名
 * - DEV 彩色输出 / PROD 静默上报
 *
 * 使用方式：
 *   import { logger } from '~/lib/logger';
 *   logger.info('K线加载完成', { symbol: '600519.SH', bars: 500 });
 *   logger.error('API请求失败', { path: '/api/data/daily-bar', error: e });
 */

import { getErrorTracker } from '../stores/errorStore';

// ── Types ───────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';
export type LogTransport = 'console' | 'errorStore' | 'all';

export interface LogEntry {
  level: LogLevel;
  module: string; // 呼叫方文件名，如 "KlineChart"
  message: string;
  data?: unknown;
  timestamp: number;
  durationMs?: number; // 可选耗时字段
}

// ── Constants ──────────────────────────────────────────────────────────────

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  critical: 4,
};

const LEVEL_STYLE: Record<LogLevel, { color: string; bg: string; label: string }> = {
  debug: { color: '#9CA3AF', bg: '', label: 'DEBUG' },
  info: { color: '#60A5FA', bg: '', label: 'INFO' },
  warn: { color: '#FBBF24', bg: '', label: 'WARN' },
  error: { color: '#F87171', bg: '', label: 'ERROR' },
  critical: { color: '#FFFFFF', bg: '#DC2626', label: 'CRITICAL' },
};

const MODULE_NAME_CACHE = new Map<string, string>();

// ── Module name extractor ─────────────────────────────────────────────────

/**
 * 从堆栈帧提取调用方文件名作为模块名
 * 如 /path/to/KlineChart.tsx → "KlineChart"
 */
function extractModuleName(depth: number): string {
  const cacheKey = `depth:${depth}`;
  if (MODULE_NAME_CACHE.has(cacheKey)) {
    return MODULE_NAME_CACHE.get(cacheKey)!;
  }

  const stack = new Error().stack ?? '';
  // 匹配堆栈帧：at 模块名 (file:line:col) 或 at file:line:col
  const frames = stack.split('\n').slice(3); // skip Error, extractModuleName, getLogger
  const targetFrame = frames[depth] ?? frames[frames.length - 1] ?? '';

  // 优先匹配具名函数后的路径
  const pathMatch = targetFrame.match(/(?:at\s+[^(]+\()?([^\s(]+):(\d+):\d+/);
  if (pathMatch) {
    const fullPath = pathMatch[1]; // e.g. /path/to/KlineChart.tsx
    const parts = fullPath.split('/');
    const fileName = parts[parts.length - 1]; // e.g. KlineChart.tsx
    const moduleName = fileName.replace(/\.(tsx?|jsx?)$/, ''); // e.g. KlineChart
    MODULE_NAME_CACHE.set(cacheKey, moduleName);
    return moduleName;
  }

  MODULE_NAME_CACHE.set(cacheKey, 'App');
  return 'App';
}

// ── Logger Class ──────────────────────────────────────────────────────────

class Logger {
  private minLevel: LogLevel;
  private transport: LogTransport;
  private dev: boolean;

  constructor() {
    this.dev = import.meta.env.DEV;
    // In dev, show debug+; in prod, show info+
    this.minLevel = this.dev ? 'debug' : 'info';
    this.transport = 'all';
  }

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Set transport target
   */
  setTransport(t: LogTransport): void {
    this.transport = t;
  }

  // ── Core log method ────────────────────────────────────────────────────

  log(level: LogLevel, message: string, data?: unknown, durationMs?: number): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) {
      return; // Skip below min level
    }

    const module = extractModuleName(2); // depth 2: log() → public method → caller
    const entry: LogEntry = {
      level,
      module,
      message,
      data,
      timestamp: Date.now(),
      durationMs,
    };

    // Console output (DEV always, PROD conditionally)
    if (this.transport === 'console' || this.transport === 'all') {
      this.writeToConsole(entry);
    }

    // ErrorStore上报 (PROD only, or errors/warnings in DEV)
    if (this.transport === 'errorStore' || this.transport === 'all') {
      if (!this.dev || level === 'error' || level === 'critical' || level === 'warn') {
        this.writeToErrorStore(entry);
      }
    }
  }

  private writeToConsole(entry: LogEntry): void {
    const { level, module, message, data, timestamp, durationMs } = entry;
    const style = LEVEL_STYLE[level];
    const bg = style.bg ? `background:${style.bg};` : '';
    const time = new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const prefix = `%c[${time}] %c[${style.label}] %c[${module}]`;
    const prefixStyles = [
      'color:#6B7280', // timestamp gray
      `${bg}color:${style.color};font-weight:bold`, // level color
      'color:#A78BFA', // module purple
    ];
    const durationStr = durationMs !== undefined ? ` (+${durationMs}ms)` : '';

    if (this.dev) {
      // DEV: grouped structured output
      console.groupCollapsed(
        `${prefix} %c${message}${durationStr}`,
        ...prefixStyles,
        'color:inherit'
      );
      if (data !== undefined) {
        console.dir(data, { colors: true, depth: 4 });
      }
      if (durationMs !== undefined) {
        console.log(`  duration: ${durationMs}ms`);
      }
      console.trace('stack'); // help locate caller
      console.groupEnd();
    } else {
      // PROD: compact single-line
      const marker = `${bg}color:${style.color}`;
      console.log(
        `%c[${time}]%c[${style.label}]%c[${module}]%c ${message}${durationStr}`,
        'color:#6B7280',
        `${marker};font-weight:bold`,
        'color:#A78BFA',
        'color:inherit',
        data ?? ''
      );
    }
  }

  private writeToErrorStore(entry: LogEntry): void {
    try {
      const tracker = getErrorTracker();
      if (!tracker) return;

      const { level, module, message, data, timestamp, durationMs } = entry;

      const meta: Record<string, unknown> = {
        module,
        timestamp,
        ...(durationMs !== undefined && { durationMs }),
        ...(data !== undefined && { data }),
      };

      const sourceMap: Record<LogLevel, string> = {
        debug: 'performance',
        info: 'component',
        warn: 'component',
        error: 'component',
        critical: 'window.onerror',
      };

      if (level === 'error' || level === 'critical') {
        tracker.trackJsError({
          level: level === 'critical' ? 'critical' : 'error',
          source: sourceMap[level] as any,
          message: `[${module}] ${message}`,
          stack: data instanceof Error ? data.stack : undefined,
          meta,
        });
      } else if (level === 'warn') {
        tracker.trackJsError({
          level: 'warning',
          source: sourceMap[level] as any,
          message: `[${module}] ${message}`,
          meta,
        });
      }
      // debug/info not sent to errorStore (too noisy)
    } catch {
      // Silently ignore errorStore failures
    }
  }

  // ── Public API ────────────────────────────────────────────────────────

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  critical(message: string, data?: unknown): void {
    this.log('critical', message, data);
  }

  /**
   * Timed operation — logs duration automatically
   * Usage: logger.timed('API请求', () => fetch(...))
   */
  async timed<T>(message: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.info(`${message} ✓`, { durationMs: Math.round(duration * 100) / 100 });
      return result;
    } catch (e) {
      const duration = performance.now() - start;
      this.error(`${message} ✗`, { durationMs: Math.round(duration * 100) / 100, error: e });
      throw e;
    }
  }

  /**
   * Create a child logger with a fixed module name
   * Usage: const log = logger.child('KlineChart');
   */
  child(module: string): ChildLogger {
    return new ChildLogger(this, module);
  }
}

// ── Child Logger ──────────────────────────────────────────────────────────

export class ChildLogger {
  constructor(
    private parent: Logger,
    private module: string
  ) {}

  debug(message: string, data?: unknown): void {
    this.parent.log('debug', `[${this.module}] ${message}`, data);
  }

  info(message: string, data?: unknown): void {
    this.parent.log('info', `[${this.module}] ${message}`, data);
  }

  warn(message: string, data?: unknown): void {
    this.parent.log('warn', `[${this.module}] ${message}`, data);
  }

  error(message: string, data?: unknown): void {
    this.parent.log('error', `[${this.module}] ${message}`, data);
  }

  critical(message: string, data?: unknown): void {
    this.parent.log('critical', `[${this.module}] ${message}`, data);
  }

  async timed<T>(message: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.info(`${message} ✓`, { durationMs: Math.round(duration * 100) / 100 });
      return result;
    } catch (e) {
      const duration = performance.now() - start;
      this.error(`${message} ✗`, { durationMs: Math.round(duration * 100) / 100, error: e });
      throw e;
    }
  }

  child(subModule: string): ChildLogger {
    return new ChildLogger(this.parent, `${this.module}:${subModule}`);
  }
}

// ── Singleton Export ──────────────────────────────────────────────────────

export const logger = new Logger();
