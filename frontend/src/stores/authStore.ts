/**
 * authStore.ts — 登录状态管理
 * 管理 JWT token、用户登录状态、路由守卫
 */
import { createSignal, createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { login as apiLogin, logout as apiLogout, getAuthToken } from '../hooks/useApi';

// ── Types ─────────────────────────────────────────────────

export interface User {
  user_id: string;
  username?: string;
}

// ── Auth State ─────────────────────────────────────────────

const [isAuthenticated, setIsAuthenticated] = createSignal(!!getAuthToken());
const [currentUser, setCurrentUser] = createSignal<User | null>(null);
const [authLoading, setAuthLoading] = createSignal(false);
const [authError, setAuthError] = createSignal<string | null>(null);

// ── Persist auth state to signal on app load ──────────────

// Re-sync signal when localStorage might change externally (e.g., other tabs)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'auth_token') {
      setIsAuthenticated(!!getAuthToken());
    }
  });
}

// ── Auth Actions ───────────────────────────────────────────

export const authActions = {
  /**
   * 登录 - 调用 /api/auth/login
   * @param username 用户名
   * @param password 密码
   * @returns true=成功, false=失败
   */
  async login(username: string, password: string): Promise<boolean> {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await apiLogin(username, password);
      if (res.code === '0' && res.data?.access_token) {
        setCurrentUser({ user_id: res.data.user_id, username });
        setIsAuthenticated(true);
        return true;
      } else {
        setAuthError(res.message || '登录失败，请检查用户名和密码');
        return false;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // 后端未实现时给出友好提示
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('net::ERR')
      ) {
        setAuthError('无法连接后端服务，请确保服务器已启动');
      } else {
        setAuthError(msg || '登录失败，请检查用户名和密码');
      }
      return false;
    } finally {
      setAuthLoading(false);
    }
  },

  /**
   * 登出 - 清除 token 和状态
   */
  logout(): void {
    apiLogout();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
  },

  /**
   * 清除错误状态
   */
  clearError(): void {
    setAuthError(null);
  },
};

// ── Exports ───────────────────────────────────────────────

export { isAuthenticated, currentUser, authLoading, authError };

// ── Route Guard Hook ──────────────────────────────────────

/**
 * useAuthGuard - 路由守卫 hook
 * 在组件中使用: useAuthGuard() — 未登录自动跳转 /login
 */
export function useAuthGuard() {
  const navigate = useNavigate();

  createEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login', { replace: true });
    }
  });

  return isAuthenticated;
}

/**
 * useRequireAuth - 替代方案：返回 auth 状态供调用方处理
 */
export function useRequireAuth() {
  return isAuthenticated;
}
