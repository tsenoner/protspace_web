import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dts from 'vite-plugin-dts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      include: ['src/**/*'],
      exclude: ['src/**/*.test.ts'],
      rollupTypes: false, // Faster, don't bundle all types
      copyDtsFiles: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ProtspaceUtils',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'esm.js' : 'js'}`,
    },
    rollupOptions: {
      external: ['lit', 'd3', 'd3-scale-chromatic', 'html2canvas', 'html2canvas-pro', 'jspdf'],
      output: {
        globals: {
          lit: 'Lit',
          d3: 'D3',
          'd3-scale-chromatic': 'D3ScaleChromatic',
          html2canvas: 'html2canvas',
          'html2canvas-pro': 'html2canvas',
          jspdf: 'jspdf',
        },
      },
    },
  },
});
