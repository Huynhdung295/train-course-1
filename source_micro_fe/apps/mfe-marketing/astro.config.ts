import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://nexus.yourdomain.com',
  integrations: [sitemap()],
  output: 'static',
  compressHTML: true,
  build: {
    assets: '_assets',
  },
  server: {
    port: 3006,
  },
});
