/**
 * LoginPage.tsx — JWT 登录页面
 * Fintech Dark 风格 + Glassmorphism
 * 路径: /login
 */
import { Component, createSignal, Show, createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { authActions, isAuthenticated, authLoading, authError } from '../../stores/authStore';

export const LoginPage: Component = () => {
  const navigate = useNavigate();
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [showPassword, setShowPassword] = createSignal(false);
  const [rememberMe, setRememberMe] = createSignal(false);

  // 已登录时用 createEffect 跳转（不在渲染体同步调用 navigate）
  createEffect(() => {
    if (isAuthenticated()) {
      navigate('/market', { replace: true });
    }
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const success = await authActions.login(username(), password());
    if (success) {
      navigate('/market', { replace: true });
    }
  };

  return (
    <div class="min-h-screen bg-[#0A0E17] flex items-center justify-center relative overflow-hidden">
      {/* Background decoration */}
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div class="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
        <div class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      {/* Login card */}
      <div class="relative z-10 w-full max-w-md mx-4">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-2xl mb-4 shadow-lg shadow-indigo-500/20">
            <span class="text-3xl">📊</span>
          </div>
          <h1 class="text-3xl font-bold text-white mb-2">VeighNa Web</h1>
          <p class="text-gray-400 text-sm">量化交易系统 · 智能投资平台</p>
        </div>

        <div class="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/50">
          <h2 class="text-xl font-semibold text-white mb-6">用户登录</h2>

          {/* Error message */}
          <Show when={authError()}>
            <div
              class="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
              role="alert"
              aria-live="assertive"
            >
              <p class="text-red-400 text-sm" id="login-error">
                {authError()}
              </p>
            </div>
          </Show>

          <form onSubmit={handleSubmit} class="space-y-5">
            {/* Username */}
            <div>
              <label class="block text-sm text-gray-400 mb-2" for="username">
                用户名
              </label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">👤</span>
                <input
                  id="username"
                  type="text"
                  value={username()}
                  onInput={(e) => {
                    setUsername(e.currentTarget.value);
                    authActions.clearError();
                  }}
                  placeholder="请输入用户名"
                  required
                  autocomplete="username"
                  aria-required="true"
                  aria-invalid={!!authError()}
                  aria-describedby={authError() ? 'login-error' : undefined}
                  class="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label class="block text-sm text-gray-400 mb-2" for="password">
                密码
              </label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔒</span>
                <input
                  id="password"
                  type={showPassword() ? 'text' : 'password'}
                  value={password()}
                  onInput={(e) => {
                    setPassword(e.currentTarget.value);
                    authActions.clearError();
                  }}
                  placeholder="请输入密码"
                  required
                  autocomplete="current-password"
                  aria-required="true"
                  aria-invalid={!!authError()}
                  aria-describedby={authError() ? 'login-error' : undefined}
                  class="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-12 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword())}
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  aria-label={showPassword() ? '隐藏密码' : '显示密码'}
                  tabIndex={-1}
                >
                  {showPassword() ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div class="flex items-center justify-between">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe()}
                  onChange={(e) => setRememberMe(e.currentTarget.checked)}
                  class="w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                />
                <span class="text-sm text-gray-400">记住登录状态</span>
              </label>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={authLoading()}
              class="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:from-gray-600 disabled:to-gray-500 text-white font-medium rounded-lg shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 disabled:shadow-none transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Show when={authLoading()}>
                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                登录中...
              </Show>
              <Show when={!authLoading()}>登 录</Show>
            </button>
          </form>

          {/* Demo credentials hint */}
          <div class="mt-6 pt-6 border-t border-white/5">
            <p class="text-xs text-gray-500 text-center">
              测试账号: <span class="text-gray-400">admin</span> /{' '}
              <span class="text-gray-400">admin123</span>
            </p>
          </div>
        </div>

        <p class="text-center text-gray-600 text-xs mt-6">
          © 2026 VeighNa Quant · 安全交易 · 智慧投资
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
