import { defineConfig } from 'vitest/config';
// Tests sans émulateur : moteur de détection (../tests/mailEngine.test.js) et logique pure (test/unit).
export default defineConfig({ test: { dir: '..', include: ['tests/mailEngine.test.js', 'cloud/test/unit/**/*.test.ts'], globals: true, testTimeout: 20000 } });
