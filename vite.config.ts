import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({ rollupTypes: false, exclude: ['tests/**'] }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'Glymo',
      formats: ['es', 'cjs'],
      fileName: (format) => format === 'es' ? 'glymo.mjs' : 'glymo.js',
    },
    rollupOptions: {
      external: ['@mediapipe/tasks-vision', 'three', /^three\//],
    },
    target: 'es2022',
    minify: 'esbuild',
    sourcemap: true,
  },
});
