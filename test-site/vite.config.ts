import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Neutral local form used to try the extension against Vue v-model bindings.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [vue()],
});
