import { defineConfig } from 'vite';
const headers = { 'Content-Security-Policy': "frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'none'", 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
export default defineConfig({
  base: './', server: { port: 5174, strictPort: true, headers }, preview: { port: 5174, strictPort: true, headers },
  build: { target: 'es2022', assetsInlineLimit: 10_000_000, cssCodeSplit: false, rollupOptions: { output: { inlineDynamicImports: true } } },
});
