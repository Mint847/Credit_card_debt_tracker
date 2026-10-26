import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The desktop app is served from /desktop/ next to the phone and iPad app
export default defineConfig({
  base: '/desktop/',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2020' },
  server: { port: 5174 }
});
