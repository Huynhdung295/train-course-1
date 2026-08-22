// ═══════════════════════════════════════════════════════════════
// PM2 Ecosystem Config – Nexus Micro Frontend
// Deploy to VPS: /opt/nexus/source_micro_fe/ecosystem.config.js
// Start: pm2 start ecosystem.config.js --env production
// ═══════════════════════════════════════════════════════════════

module.exports = {
  apps: [
    // ── Shell App (Next.js 16) ─────────────────────────────
    {
      name: 'nexus-shell',
      cwd: '/opt/nexus/source_micro_fe/apps/shell',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        NEXT_PUBLIC_API_BASE_URL: 'https://api.nexus.yourdomain.com',
        NEXT_PUBLIC_MFE_AUTH_URL: 'http://mfe-auth.nexus.internal:3001',
        NEXT_PUBLIC_MFE_POS_URL: 'http://mfe-pos.nexus.internal:3002',
        NEXT_PUBLIC_MFE_ERP_URL: 'http://mfe-erp.nexus.internal:3003',
        NEXT_PUBLIC_MFE_CATALOG_URL: 'http://mfe-catalog.nexus.internal:3004',
        NEXT_PUBLIC_MFE_USERS_URL: 'http://mfe-users.nexus.internal:3005',
        SESSION_SECRET: 'REPLACE_WITH_STRONG_SECRET_MIN_32_CHARS',
      },
    },

    // ── MFE-ERP Dashboard (Next.js 16) ─────────────────────
    {
      name: 'nexus-mfe-erp',
      cwd: '/opt/nexus/source_micro_fe/apps/mfe-erp',
      script: 'node_modules/.bin/next',
      args: 'start -p 3003',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '384M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3003,
        NEXT_PUBLIC_API_BASE_URL: 'https://api.nexus.yourdomain.com',
      },
    },

    // ── MFE-CATALOG (Nuxt 4) ──────────────────────────────
    {
      name: 'nexus-mfe-catalog',
      cwd: '/opt/nexus/source_micro_fe/apps/mfe-catalog',
      script: '.output/server/index.mjs',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '384M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3004,
        NUXT_PUBLIC_API_BASE_URL: 'https://api.nexus.yourdomain.com',
      },
    },
  ],
};
