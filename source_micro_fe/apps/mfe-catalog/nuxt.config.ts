// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',
  devtools: { enabled: false },
  ssr: true,
  modules: ['@vueuse/nuxt'],
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:8080',
    },
  },
  vite: {
    server: {
      port: 3004,
      cors: true,
    },
  },
  app: {
    head: {
      title: 'Nexus – Catalog',
      link: [
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' },
      ],
      script: [
        { src: 'https://cdn.tailwindcss.com' },
      ],
    },
  },
});
