import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'artifact' ? [viteSingleFile()] : [])],
  build: { target: 'es2022', outDir: mode === 'artifact' ? 'dist-preview' : 'dist', copyPublicDir: mode !== 'artifact' },
}));
