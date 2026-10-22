import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'artifact' ? [viteSingleFile()] : [])],
  build: {
    target: 'es2022', outDir: mode === 'artifact' ? 'dist-preview' : 'dist', copyPublicDir: mode !== 'artifact',
    chunkSizeWarningLimit: 1200,
    // il database di abilità e poteri cambia di rado: in un file a parte resta in cache tra un aggiornamento e l'altro
    rollupOptions: mode === 'artifact' ? {} : { output: { manualChunks: (id) => (/[\\/]src[\\/]data[\\/][^\\/]+\.json$/.test(id) ? 'database' : undefined) } },
  },
}));
