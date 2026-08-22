import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'mfePos',
      filename: 'remoteEntry.js',
      exposes: { './PosApp': './src/bootstrap.tsx' },
      shared: {
        react: { singleton: true, requiredVersion: false },
        'react-dom': { singleton: true, requiredVersion: false },
        zustand: { singleton: true, requiredVersion: false },
        '@tanstack/react-query': { singleton: true, requiredVersion: false },
      },
    }),
  ],
  server: { port: 3002, cors: true },
  preview: { port: 3002, cors: true },
  build: { target: 'esnext', minify: false, cssCodeSplit: false },
});
