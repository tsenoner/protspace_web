import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';
import { PORTS } from '../config/urls';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Set base path for custom domain deployment
  base: '/',
  server: {
    host: '::',
    port: PORTS.app,
    // Proxy /docs requests to the VitePress dev server in development
    // This makes dev behavior match production (both use relative paths)
    proxy: {
      '/docs': {
        target: `http://localhost:${PORTS.docs}`,
        changeOrigin: true,
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
