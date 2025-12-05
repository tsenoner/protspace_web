import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Set base path for custom domain deployment
  base: '/',
  server: {
    host: '::',
    port: 8080,
    proxy: {
      // Proxy /docs/* requests to VitePress dev server
      '/docs': {
        target: 'http://localhost:5174',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  plugins: [react(), mode === 'development' && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}));
