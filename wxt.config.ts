import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  // Firefox would default to MV2, which drops optional_host_permissions; the code relies on MV3 APIs.
  manifestVersion: 3,
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: ({ browser }) => ({
    name: 'Form Filler',
    permissions: ['storage', 'activeTab', 'scripting', 'tabs'],
    optional_host_permissions: ['<all_urls>'],
    commands: {
      'fill-last': {
        suggested_key: { default: 'Alt+Shift+F' },
        description: 'Fill with last used template',
      },
    },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              // MV3 add-ons need a fixed id; an email-like id does not have to be a mailbox.
              id: 'form-filler@martinliesche.de',
              // optional_host_permissions and data_collection_permissions both need Firefox 128+.
              strict_min_version: '128.0',
              // Nothing leaves the browser; required since November 2025 for new add-ons.
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {}),
  }),
});
