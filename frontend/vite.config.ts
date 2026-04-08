import { defineConfig, loadEnv } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import { compression } from 'vite-plugin-compression2';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
/// <reference types="vitest" />

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(__dirname), '');
  const DEV_HOST = env.VITE_DEV_HOST || '192.168.2.105';
  const DEV_PORT = Number(env.VITE_DEV_PORT) || 5173;
  const BACKEND_URL = `http://${DEV_HOST}:8501`;

  return {
    plugins: [
      solid(),
      tailwindcss(),
      // Pre-compress artifacts with gzip for faster delivery
      compression({
        algorithm: 'gzip',
        threshold: 512,
      }),
    ],

    server: {
      host: DEV_HOST,
      port: DEV_PORT,
      strictPort: false,
      proxy: {
        '/api': {
          target: BACKEND_URL,
          changeOrigin: true,
          rewrite: (path: string) => path,
        },
        '/ws': {
          target: `ws://${DEV_HOST}:8501`,
          ws: true,
        },
      },
    },

    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },

    build: {
      target: 'esnext',
      sourcemap: false,
      // Persistent build cache across dev sessions
      cacheDir: '.vite-cache',
      // Gzip-compressed asset sizes (KB) — warn for chunks > 300KB
      chunkSizeWarningLimit: 300,
      // Split vendor chunks for better caching
      rollupOptions: {
        output: {
          // Hash filenames for long-term caching
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            // echarts — ~346KB gzip, separate chunk for streaming charts
            if (id.includes('echarts') || id.includes('zrender')) return 'vendor-echarts';
            // lightweight-charts — ~120KB gzip, separate for trading view
            if (id.includes('lightweight-charts')) return 'vendor-lightweight-charts';
            // pdf libs — ~200KB gzip, on-demand export only
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf';
            // solid core + router — kept in initial load (~40KB gzip)
            if (id.includes('@solidjs') || id.includes('solid-js')) return 'vendor-solid';
            // other vendor libs — group together
            return 'vendor-misc';
          },
        },
      },
    },

    // Dev-time dependency pre-bundling cache
    optimizeDeps: {
      include: [
        'echarts',
        'solid-js',
        '@solidjs/router',
      ],
    },

    test: {
      globals: true,
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.d.ts',
          'src/vite-env.d.ts',
          'src/test/**',
          'src/stores/index.ts',
          'src/stores/apiStore.ts',
          'src/stores/marketStore.ts',
          'src/stores/loadingStore.ts',
          'src/stores/authStore.ts',
        ],
      },
    },
  };
});
