import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@massive.com/client-js': path.resolve(
        __dirname,
        'node_modules/@massive.com/client-js/dist/main.js'
      ),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['@massive.com/client-js'],
  },
});
