import { defineConfig, loadEnv } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(__dirname), '');
  const DEV_HOST = env.VITE_DEV_HOST || '192.168.2.105';
  const DEV_PORT = Number(env.VITE_DEV_PORT) || 5173;
  const BACKEND_URL = `http://${DEV_HOST}:8501`;

  return {
    plugins: [solid(), tailwindcss()],
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
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('echarts')) return 'echarts';
              if (id.includes('lightweight-charts')) return 'lightweight-charts';
              if (id.includes('pdfmake') || id.includes('jspdf')) return 'pdf';
              if (id.includes('@solidjs') || id.includes('solid-js')) return 'solid';
              if (id.includes('echarts') || id.includes('zrender')) return 'echarts';
            }
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
  };
});
