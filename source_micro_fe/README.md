# Nexus Micro Frontend Ecosystem

> Enterprise B2B Multi-Tenant ERP – Micro Frontend Architecture

## 🏗️ Stack (August 2026)

| App | Framework | Port |
|-----|-----------|------|
| **Shell** | Next.js 16.3 + Module Federation | 3000 |
| **MFE-Auth** | React 19.2 + Vite 8.2 | 3001 |
| **MFE-POS** | React 19.2 + Vite 8.2 | 3002 |
| **MFE-ERP** | Next.js 16.3 | 3003 |
| **MFE-Catalog** | Nuxt 4.5 + Vue 3 | 3004 |
| **MFE-Users** | Angular 22.1 | 3005 |
| **MFE-Marketing** | Astro 7.2 | 3006 |

## 📦 Shared Packages

| Package | Purpose |
|---------|---------|
| `@nexus/types` | Shared TypeScript interfaces |
| `@nexus/utils` | formatCurrency, debounce, RFC7807, cn() |
| `@nexus/api-client` | Axios instance + queryKeys + SSE |
| `@nexus/auth` | Zustand auth store + ABAC guards |
| `@nexus/ui` | Design system (CVA components) |

## 🚀 Quick Start

```bash
# Prerequisites: Node 22+, pnpm 9+
npm install -g pnpm@9

# Install all dependencies
pnpm install

# Copy env
cp .env.example .env

# Build shared packages first
pnpm build:packages

# Run everything in parallel
pnpm dev
```

## 📁 Structure

```
source_micro_fe/
├── apps/
│   ├── shell/          # Next.js 16 – Host App (Port 3000)
│   ├── mfe-auth/       # React 19 + Vite 8 (Port 3001)
│   ├── mfe-pos/        # React 19 + Vite 8 (Port 3002)
│   ├── mfe-erp/        # Next.js 16 (Port 3003)
│   ├── mfe-catalog/    # Nuxt 4 (Port 3004)
│   ├── mfe-users/      # Angular 22 (Port 3005)
│   └── mfe-marketing/  # Astro 7 (Port 3006)
├── packages/
│   ├── types/          # @nexus/types
│   ├── utils/          # @nexus/utils
│   ├── api-client/     # @nexus/api-client
│   ├── auth/           # @nexus/auth
│   └── ui/             # @nexus/ui
├── tooling/            # Shared ESLint, TSConfig, Vitest
├── .github/workflows/  # CI/CD pipelines
└── pnpm-workspace.yaml
```

## 🔧 Individual App Commands

```bash
pnpm dev:shell          # Shell only
pnpm dev:auth           # MFE-Auth only
pnpm dev:pos            # MFE-POS only
pnpm dev:erp            # MFE-ERP only
pnpm dev:catalog        # MFE-Catalog only
pnpm dev:users          # MFE-Users only
pnpm dev:marketing      # MFE-Marketing only
```

## 🌐 Realtime Architecture

**No Firebase needed.** Realtime is handled by:
- **SSE** (`/api/v1/sse/revenue`, `/api/v1/sse/orders/{id}`) → Dashboard charts, Saga progress
- **WebSocket** → Future notifications

SSE is implemented via `@microsoft/fetch-event-source` with auto-retry on disconnect.

## 🚢 Deployment

### Infra config locations:
- **Nginx:** `source_infra/vps_deploy/nginx/nexus-micro-fe.conf`
- **PM2:** `source_infra/vps_deploy/pm2/ecosystem.config.js`

### Deploy:
```bash
# PM2 start all SSR apps
pm2 start ecosystem.config.js --env production

# Static MFEs served by Nginx directly from /var/www/nexus/
```

## 🔐 GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `VPS_HOST` | Staging VPS IP |
| `VPS_USER` | SSH username |
| `VPS_SSH_KEY` | Private SSH key |
| `SESSION_SECRET` | Min 32 char random string |
| `STAGING_API_URL` | Backend API URL |

## 📖 Documentation

- [Architecture Plan](./plan_project.md)
- [Implementation Checklist](../../checklist_micro_fe_implement.md)
