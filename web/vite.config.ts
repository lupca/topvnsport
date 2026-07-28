import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const isDocker = process.env.DOCKER_ENV === 'true';
const packagesRoot = isDocker ? '/workspace/packages' : path.resolve(__dirname, '../packages');

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@topvnsport/ui-kit': path.join(packagesRoot, 'ui-kit/dist/index.js'),
        '@topvnsport/api-client': path.join(packagesRoot, 'api-client/dist/index.js'),
        'clsx': path.resolve(__dirname, 'node_modules/clsx'),
        'tailwind-merge': path.resolve(__dirname, 'node_modules/tailwind-merge'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
