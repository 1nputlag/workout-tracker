import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// У розробці запити /api проксюються на локальний сервер (npm run dev у каталозі server)
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
