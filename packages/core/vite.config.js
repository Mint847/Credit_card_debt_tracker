import { defineConfig } from 'vite';

// Builds the core as one classic browser script (IIFE) that the phone/iPad app inlines.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/browser.js',
      name: 'SerendibCore',
      formats: ['iife'],
      fileName: () => 'core.js'
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    target: 'es2017'
  },
  test: {
    environment: 'node',
    setupFiles: ['test/setup.js']
  }
});
