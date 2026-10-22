import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// Promo video stage: a standalone page that reuses the extension's tokens, fonts and utilities.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [tailwindcss()],
});
