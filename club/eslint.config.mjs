// Analyse du code Fit Pulse : ESLint recommandé. Les scripts partagent leurs fonctions
// par le contexte global du navigateur ; la liste des noms définis au premier niveau de
// chaque fichier est relevée ici, pour que « non défini » signale les vraies fautes.
import { readFileSync, readdirSync } from 'node:fs';
const files = readdirSync(new URL('.', import.meta.url)).filter(f => f.endsWith('.js') && f !== 'sw.js');
const shared = {};
for (const f of files) for (const m of readFileSync(new URL(f, import.meta.url), 'utf8').matchAll(/^(?:async\s+)?(?:function\s*\*?\s*([A-Za-z_$][\w$]*)|(?:const|let|var|class)\s+([A-Za-z_$][\w$]*))/gm)) shared[m[1] || m[2]] = 'writable';
const browser = Object.fromEntries(['window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage', 'indexedDB', 'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'queueMicrotask', 'fetch', 'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'TextEncoder', 'TextDecoder', 'crypto', 'atob', 'btoa', 'Image', 'Notification', 'matchMedia', 'getComputedStyle', 'getSelection', 'performance', 'addEventListener', 'removeEventListener', 'innerWidth', 'innerHeight', 'scrollTo', 'print', 'open', 'alert', 'confirm', 'Event', 'CustomEvent', 'HTMLElement', 'DOMParser', 'XMLHttpRequest', 'Intl', 'structuredClone', 'firebase', 'XLSX', 'JSZip', 'self', 'caches', 'clients', 'prompt', 'history', 'module'].map(k => [k, 'readonly']));
export default [
  { files: ['*.js'], languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: { ...browser, ...shared } },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { vars: 'local', args: 'none', caughtErrors: 'none' }], 'no-redeclare': 'off', 'no-empty': ['error', { allowEmptyCatch: true }], 'no-useless-escape': 'off', 'no-prototype-builtins': 'off', 'no-cond-assign': 'off', 'no-control-regex': 'off', 'no-misleading-character-class': 'off', 'no-inner-declarations': 'off' } },
  { files: ['sw.js'], languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: { self: 'readonly', caches: 'readonly', fetch: 'readonly', URL: 'readonly', location: 'readonly', console: 'readonly' } } },
  { files: ['outils/*.mjs', 'tests/*.mjs'], languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { process: 'readonly', Buffer: 'readonly', console: 'readonly', fetch: 'readonly', URL: 'readonly', setTimeout: 'readonly', TextEncoder: 'readonly', URLSearchParams: 'readonly', queueMicrotask: 'readonly', clearTimeout: 'readonly' } }, rules: { 'no-unused-vars': ['warn', { args: 'none' }] } },
];
