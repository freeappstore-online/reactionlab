import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { serviceWorkerPlugin } from './build/sw-plugin';

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorkerPlugin()],
  build: {
    target: 'es2022',
    // One stylesheet + one entry chunk keeps the critical path to two requests,
    // which matters for the 3G first-load budget.
    cssCodeSplit: false,
    modulePreload: { polyfill: false },
  },
  server: {
    port: 5173,
  },
});
