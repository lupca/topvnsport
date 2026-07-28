import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: [path.resolve(__dirname, 'src/**/*.test.{ts,tsx}')],
    exclude: ['/app/**', '**/node_modules/**'],
    root: path.resolve(__dirname),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@topvnsport/ui-kit': path.resolve(__dirname, '../packages/ui-kit/src/index.ts'),
      '@topvnsport/api-client': path.resolve(__dirname, '../packages/api-client/src/index.ts'),
    },
  },
});
