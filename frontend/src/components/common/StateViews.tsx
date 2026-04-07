import { Component, JSX } from 'solid-js';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export const LoadingSpinner: Component<LoadingSpinnerProps> = (props) => {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3',
  };
  const size = props.size ?? 'md';

  return (
    <div class="flex flex-col items-center justify-center gap-3">
      <div class={`${sizeClasses[size]} border-blue-400/30 border-t-blue-400 rounded-full animate-spin`} />
      {props.text && <span class="text-sm text-gray-400">{props.text}</span>}
    </div>
  );
};

interface SkeletonProps {
  rows?: number;
  height?: string;
}

export const Skeleton: Component<SkeletonProps> = (props) => {
  const rows = props.rows ?? 5;
  const height = props.height ?? 'h-4';

  return (
    <div class="space-y-2 animate-pulse">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} class={`bg-gray-700/50 rounded ${height}`} />
      ))}
    </div>
  );
};

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: Component<EmptyStateProps> = (props) => {
  const icon = props.icon ?? '📭';

  return (
    <div class="flex flex-col items-center justify-center h-full gap-3 py-12">
      <span class="text-4xl opacity-50">{icon}</span>
      <h3 class="text-lg font-medium text-gray-300">{props.title}</h3>
      {props.description && (
        <p class="text-sm text-gray-500 max-w-sm text-center">{props.description}</p>
      )}
      {props.action && (
        <button
          class="mt-2 px-4 py-2 text-sm rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400"
          onClick={props.action.onClick}
        >
          {props.action.label}
        </button>
      )}
    </div>
  );
};

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: Component<ErrorStateProps> = (props) => {
  return (
    <div class="flex flex-col items-center justify-center h-full gap-3 py-12">
      <span class="text-4xl opacity-50">⚠️</span>
      <h3 class="text-lg font-medium text-red-400">加载失败</h3>
      {props.message && (
        <p class="text-sm text-gray-500 max-w-sm text-center">{props.message}</p>
      )}
      {props.onRetry && (
        <button
          class="mt-2 px-4 py-2 text-sm rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400"
          onClick={props.onRetry}
        >
          🔄 重试
        </button>
      )}
    </div>
  );
};
