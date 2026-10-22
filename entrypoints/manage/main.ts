import { createApp } from 'vue';
import { applyLocalTheme } from '../../src/theme/localTheme';
import { registerPageFonts } from '../../src/theme/overlayFonts';
import App from './App.vue';
import './style.css';

applyLocalTheme();
registerPageFonts();
createApp(App).mount('#app');
