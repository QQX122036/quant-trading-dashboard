/**
 * RouteGuard.tsx — 路由守卫组件
 * 保护需要登录的路由，未登录时重定向到 /login
 */
import { Component, Show, createEffect } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { isAuthenticated } from '../../stores/authStore';

interface AuthGuardProps {
  children: any;
  /** 重定向目标路径，默认 /login */
  redirectTo?: string;
}

export const RouteGuard: Component<AuthGuardProps> = (props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = props.redirectTo ?? '/login';

  // 监听认证状态变化
  createEffect(() => {
    if (!isAuthenticated()) {
      const currentPath = location.pathname;
      const loginWithRedirect = `${redirectTo}?redirect=${encodeURIComponent(currentPath)}`;
      navigate(loginWithRedirect, { replace: true });
    }
  });

  // 如果已登录，渲染 children；否则显示 loading
  return (
    <Show when={isAuthenticated()} fallback={<GuardLoading />}>
      {props.children}
    </Show>
  );
};

/** 路由守卫 loading 态 */
const GuardLoading: Component = () => (
  <div class="flex items-center justify-center h-[60vh]">
    <div class="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
  </div>
);

export default RouteGuard;
