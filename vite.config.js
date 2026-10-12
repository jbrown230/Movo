import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// La API de Movo (server/) corre aparte en el puerto 3000. Durante el desarrollo, Vite
// le reenvía las llamadas a /api. Sin la API, la app funciona igual en modo demo.
const API_URL = process.env.API_URL || 'http://localhost:3000';
const apiProxy = { '/api': { target: API_URL, changeOrigin: true } };

// Política de seguridad del navegador. Solo se agrega al compilar: en desarrollo,
// Vite necesita scripts en línea que esta política bloquearía.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://*.googleusercontent.com",
  "connect-src 'self' https://gmail.googleapis.com https://openidconnect.googleapis.com",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const addContentSecurityPolicy = {
  name: 'movo-content-security-policy',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY }, injectTo: 'head-prepend' },
  ],
};

export default defineConfig({
  root: 'web',
  plugins: [react(), addContentSecurityPolicy],
  server: { port: 5173, proxy: apiProxy },
  preview: { port: 4173, proxy: apiProxy },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  test: {
    root: '.',
    environment: 'jsdom',
    include: ['tests/presentation/**/*.test.{js,jsx}'],
    setupFiles: ['tests/presentation/setup.js'],
    css: false,
  },
});
