import { defineConfig } from 'vite';
export default defineConfig({
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': { target: `http://127.0.0.1:${process.env.QUEUE_PORT || 8797}`, changeOrigin: false } } },
  build: { target: 'es2022' }
});
