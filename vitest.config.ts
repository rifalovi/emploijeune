import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/unit/setup.ts'],
    include: ['tests/unit/**/*.{spec,test}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'playwright-report', 'tests/e2e'],
  },
  resolve: {
    alias: {
      // Marqueurs Next.js sans runtime propre : non résolus par Vitest. On les
      // pointe vers un stub vide pour que les modules serveur restent testables.
      'server-only': path.resolve(__dirname, 'tests/unit/stubs/empty.ts'),
      'client-only': path.resolve(__dirname, 'tests/unit/stubs/empty.ts'),
      '@': path.resolve(__dirname, '.'),
    },
  },
});
