/**
 * ErrorBoundary Test Helpers
 * Shared components used across ErrorBoundary tests.
 */

import { Component, createSignal, onMount } from 'solid-js';

// Child component that renders normally
export const NormalChild: Component = () => <span>Normal content</span>;

// Child component that throws synchronously during render
// (SolidJS ErrorBoundary catches this via catchError in memo evaluation)
export const ErrorChild: Component = () => {
  throw new Error('Test error boundary error');
};

// Child that throws after mount — for testing error boundary catches async errors
export const AsyncErrorChild: Component = () => {
  const [, setTick] = createSignal(0);
  onMount(() => {
    // Delay error to after mount so boundary is established first
    setTimeout(() => {
      throw new Error('Async test error');
    }, 10);
  });
  return <span>Async child loading...</span>;
};
