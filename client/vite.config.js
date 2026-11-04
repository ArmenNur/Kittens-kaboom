import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  plugins: [react()],
  resolve: {
    alias: { '@shared': path.resolve(here, '../shared') },
  },
  css: {
    modules: { localsConvention: 'camelCaseOnly' },
  },
  server: {
    port: 5173,
    fs: { allow: [path.resolve(here, '..')] },
    proxy: {
      '/socket.io': { target: 'http://localhost:4310', ws: true },
    },
  },
  build: {
    outDir: path.resolve(here, 'dist'),
    emptyOutDir: true,
  },
});
