import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The desktop app is served from /desktop/ next to the phone and iPad app: it builds straight into the
// hosting folder (firebase.json rebuilds it before every deploy)
export default defineConfig({
  base: '/desktop/',
  plugins: [react()],
  build: { outDir: '../../stitch_fintech_credit_debt_manager/desktop', emptyOutDir: true, target: 'es2020' },
  server: { port: 5174 }
});
