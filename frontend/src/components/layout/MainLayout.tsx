import { Component, JSX, createMemo } from 'solid-js';
import { useLocation } from '@solidjs/router';
import { MenuBar } from './MenuBar';
import { ErrorBoundary } from '../ErrorBoundary';

interface MainLayoutProps {
  id?: string;
  children: JSX.Element;
}

export const MainLayout: Component<MainLayoutProps> = (props) => {
  const location = useLocation();
  const isLoginPage = createMemo(() => location.pathname === '/login');

  return (
    <div class="h-screen w-screen bg-[#0A0E17] text-white flex flex-col">
      {/* Top Menu Bar — hidden on login page */}
      {!isLoginPage() && <MenuBar />}

      {/* Main Content Area */}
      <main class="flex-1 overflow-auto w-full">
        <div class="min-h-full w-full">
          <ErrorBoundary>{props.children}</ErrorBoundary>
        </div>
      </main>
    </div>
  );
};
