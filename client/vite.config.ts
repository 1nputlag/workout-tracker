/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// У розробці запити /api проксюються на локальний сервер (npm run dev у каталозі server)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': 'http://localhost:3000' } },
  preview: { proxy: { '/api': 'http://localhost:3000' } },
  test: { include: ['src/**/*.test.ts'] },
});
