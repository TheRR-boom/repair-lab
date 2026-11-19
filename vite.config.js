import { defineConfig } from 'vite';

// Базовая сборка: относительные пути, чтобы dist/ открывался и из Capacitor
// (https://localhost), и просто из файла на устройстве.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1600,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});