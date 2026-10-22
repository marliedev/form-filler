import { createApp } from 'vue';
import { applyLocalTheme } from '../../src/theme/localTheme';
import App from './App.vue';
import './style.css';

applyLocalTheme();
createApp(App).mount('#app');
