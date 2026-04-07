import { Component, JSX } from 'solid-js';
import { MenuBar } from './MenuBar';
import { ErrorBoundary } from '../ErrorBoundary';

interface MainLayoutProps {
  children: JSX.Element;
}

export const MainLayout: Component<MainLayoutProps> = (props) => {
  return (
    <div class="h-screen w-screen bg-[#0A0E17] text-white overflow-hidden flex flex-col">
      {/* Top Menu Bar */}
      <MenuBar />

      {/* Main Content Area */}
      <main class="flex-1 min-h-0">
        <div class="h-full w-full">
          <ErrorBoundary>
            {props.children}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
};
