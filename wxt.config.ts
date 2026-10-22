import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Form Filler',
    permissions: ['storage', 'activeTab', 'scripting', 'tabs'],
    optional_host_permissions: ['<all_urls>'],
    commands: {
      'fill-last': {
        suggested_key: { default: 'Alt+Shift+F' },
        description: 'Fill with last used template',
      },
    },
  },
});
