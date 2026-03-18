import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      tsconfigPath: './tsconfig.json',
      insertTypesEntry: true,
      include: ['src/**/*'],
      exclude: ['src/**/*.test.ts'],
      rollupTypes: false,
      copyDtsFiles: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['lit', 'd3', '@protspace/utils'],
      output: {
        globals: {
          lit: 'Lit',
          d3: 'D3',
        },
      },
    },
  },
});
