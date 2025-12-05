import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Set base path for custom domain deployment
  base: '/',
  // Define environment variables
  define: {
    'import.meta.env.VITE_DOCS_URL': JSON.stringify(
      mode === 'production' ? '/docs/' : 'http://localhost:5174/docs/',
    ),
  },
  server: {
    host: '::',
    port: 8080,
  },
  plugins: [react(), mode === 'development' && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}));
