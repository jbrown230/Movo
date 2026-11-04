import { defineConfig } from 'vite';

// El landing es un sitio estático aparte de la app: se compila a landing/dist y se puede
// publicar en cualquier hosting (GitHub Pages, Netlify, el mismo VPS). `base: './'` hace
// que funcione también dentro de una subcarpeta.
export default defineConfig({
  base: './',
  server: { port: 5174 },
  preview: { port: 4174 },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 800 },
});
