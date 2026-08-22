# 🚀 BẢNG TỔNG HỢP FULL CHECKLIST COMMANDS – NEXUS MICRO FRONTEND

> **Dự án:** Nexus ERP & POS Enterprise Platform ($1B+ Architecture)  
> **Hệ sinh thái:** Monorepo (pnpm 9 + Turborepo 2 + Next.js 16 + React 19 + Nuxt 4 + Angular 22 + Astro 7 + Vite 8)  
> **Hệ điều hành hỗ trợ:** Windows (PowerShell / CMD) & Linux (Ubuntu / Debian VPS)

---

## 📑 MỤC LỤC NHANH

1. [Môi trường & Công cụ tiên quyết (Prerequisites)](#1-môi-trường--công-cụ-tiên-quyết)
2. [Cài đặt & Khởi tạo ban đầu (Bootstrap)](#2-cài-đặt--khởi-tạo-ban-đầu)
3. [Build Shared Packages (Bắt buộc chạy trước)](#3-build-shared-packages)
4. [Lệnh chạy Development (Chạy song song & Từng App)](#4-lệnh-chạy-development)
5. [Lệnh Build Production & Preview](#5-lệnh-build-production--preview)
6. [Kiểm tra chất lượng code (Lint & Type-Check)](#6-kiểm-tra-chất-lượng-code)
7. [Quản lý Service VPS & Hosting (PM2 & Nginx)](#7-quản-lý-service-vps--hosting)
8. [Quản lý Port & Xử lý sự cố (Troubleshooting & Reset)](#8-quản-lý-port--xử-lý-sự-cố)
9. [Bảng tra cứu Port & Endpoints](#9-bảng-tra-cứu-port--endpoints)

---

## 1. MÔI TRƯỜNG & CÔNG CỤ TIÊN QUYẾT

- [ ] **1.1. Kiểm tra phiên bản Node.js (Yêu cầu Node >= 22.0.0)**
  ```bash
  node -v
  # Kỳ vọng: v22.x.x trở lên
  ```

- [ ] **1.2. Cài đặt pnpm phiên bản 9 globally**
  ```bash
  npm install -g pnpm@9
  # Kiểm tra lại version
  pnpm -v
  # Kỳ vọng: 9.x.x
  ```

- [ ] **1.3. Cài đặt các công cụ CLI toàn cục (Optional nhưng khuyến nghị)**
  ```bash
  npm install -g turbo pm2 @angular/cli
  ```

---

## 2. CÀI ĐẶT & KHỞI TẠO BAN ĐẦU

- [ ] **2.1. Di chuyển vào thư mục dự án micro frontend**
  ```powershell
  # Windows PowerShell
  cd "c:\Users\INTEL\OneDrive\Máy tính\DEV\source_micro_fe"
  ```
  ```bash
  # Linux / Bash
  cd /opt/nexus/source_micro_fe
  ```

- [ ] **2.2. Khởi tạo file môi trường `.env` từ `.env.example`**
  ```powershell
  # Windows PowerShell
  Copy-Item .env.example .env
  ```
  ```bash
  # Linux / Bash / macOS
  cp .env.example .env
  ```

- [ ] **2.3. Cài đặt toàn bộ dependencies trong toàn bộ Monorepo**
  ```bash
  pnpm install
  ```

---

## 3. BUILD SHARED PACKAGES

> ⚠️ **LƯU Ý:** Các Apps (Shell, Auth, POS, ERP,...) đều phụ thuộc vào các Shared Packages nội bộ. Bắt buộc phải build các packages này trước lần chạy đầu tiên.

- [ ] **3.1. Build TẤT CẢ shared packages cùng lúc (Khuyên dùng)**
  ```bash
  pnpm build:packages
  ```
  *Hoặc qua Turbo:*
  ```bash
  turbo run build --filter="./packages/*"
  ```

- [ ] **3.2. Lệnh build lẻ từng Shared Package (Khi debug từng package)**
  ```bash
  # 1. Package Types (Chứa type model toàn hệ thống)
  pnpm --filter @nexus/types build

  # 2. Package Utils (Chứa format, debounce, error handler)
  pnpm --filter @nexus/utils build

  # 3. Package API Client (Axios interceptor, SSE client, query keys)
  pnpm --filter @nexus/api-client build

  # 4. Package Auth (Zustand auth store, ABAC useGuard)
  pnpm --filter @nexus/auth build

  # 5. Package UI (Design System CVA, Button, Input, Modal, v.v.)
  pnpm --filter @nexus/ui build
  ```

---

## 4. LỆNH CHẠY DEVELOPMENT

### 4.1. Khởi động TẤT CẢ các Micro Frontend song song (Parallel)
- [ ] **Chạy toàn bộ ecosystem bằng 1 lệnh:**
  ```bash
  pnpm dev
  ```
  *(Lệnh này kích hoạt `turbo run dev --parallel`, chạy đồng thời cả 7 Micro FE Apps trên các Port từ 3000 đến 3006)*

---

### 4.2. Lệnh chạy ĐỘC LẬP từng App (Dành cho Team chuyên biệt / Máy ít RAM)

- [ ] **4.2.1. Chạy Host Shell App (Next.js 16 - Port 3000)**
  ```bash
  pnpm dev:shell
  # Hoặc: pnpm --filter @nexus/shell dev
  ```

- [ ] **4.2.2. Chạy MFE Auth (React 19 + Vite 8 - Port 3001)**
  ```bash
  pnpm dev:auth
  # Hoặc: pnpm --filter @nexus/mfe-auth dev
  ```

- [ ] **4.2.3. Chạy MFE POS (React 19 + Vite 8 - Port 3002)**
  ```bash
  pnpm dev:pos
  # Hoặc: pnpm --filter @nexus/mfe-pos dev
  ```

- [ ] **4.2.4. Chạy MFE ERP Dashboard (Next.js 16 - Port 3003)**
  ```bash
  pnpm dev:erp
  # Hoặc: pnpm --filter @nexus/mfe-erp dev
  ```

- [ ] **4.2.5. Chạy MFE Catalog / Products (Nuxt 4 + Vue 3 - Port 3004)**
  ```bash
  pnpm dev:catalog
  # Hoặc: pnpm --filter @nexus/mfe-catalog dev
  ```

- [ ] **4.2.6. Chạy MFE Users / Admin (Angular 22 - Port 3005)**
  ```bash
  pnpm dev:users
  # Hoặc: pnpm --filter @nexus/mfe-users dev
  ```

- [ ] **4.2.7. Chạy MFE Marketing / Landing (Astro 7 - Port 3006)**
  ```bash
  pnpm dev:marketing
  # Hoặc: pnpm --filter @nexus/mfe-marketing dev
  ```

---

## 5. LỆNH BUILD PRODUCTION & PREVIEW

- [ ] **5.1. Build TẤT CẢ Packages và Apps cho Production**
  ```bash
  pnpm build
  ```

- [ ] **5.2. Build lẻ từng App**
  ```bash
  pnpm --filter @nexus/shell build
  pnpm --filter @nexus/mfe-auth build
  pnpm --filter @nexus/mfe-pos build
  pnpm --filter @nexus/mfe-erp build
  pnpm --filter @nexus/mfe-catalog build
  pnpm --filter @nexus/mfe-users build
  pnpm --filter @nexus/mfe-marketing build
  ```

- [ ] **5.3. Preview bản build Production Local**
  ```bash
  # Preview Shell (Next.js)
  pnpm --filter @nexus/shell start

  # Preview MFE Auth (Vite Preview)
  pnpm --filter @nexus/mfe-auth preview

  # Preview MFE POS (Vite Preview)
  pnpm --filter @nexus/mfe-pos preview

  # Preview MFE ERP (Next.js)
  pnpm --filter @nexus/mfe-erp start

  # Preview MFE Catalog (Nuxt Nitro Server)
  pnpm --filter @nexus/mfe-catalog start

  # Preview MFE Marketing (Astro)
  pnpm --filter @nexus/mfe-marketing preview
  ```

---

## 6. KIỂM TRA CHẤT LƯỢNG CODE

- [ ] **6.1. Kiểm tra lỗi kiểu dữ liệu (TypeScript Type-Check toàn bộ repo)**
  ```bash
  pnpm type-check
  ```
  *Hoặc type-check lẻ từng app/package:*
  ```bash
  pnpm --filter @nexus/types type-check
  pnpm --filter @nexus/api-client type-check
  pnpm --filter @nexus/auth type-check
  pnpm --filter @nexus/ui type-check
  pnpm --filter @nexus/shell type-check
  ```

- [ ] **6.2. Kiểm tra linter (ESLint)**
  ```bash
  pnpm lint
  ```

- [ ] **6.3. Format tự động toàn bộ source code với Prettier**
  ```bash
  pnpm format
  ```

---

## 7. QUẢN LÝ SERVICE VPS & HOSTING

> Vị trí file cấu hình VPS:
> - Nginx: `source_infra/vps_deploy/nginx/nexus-micro-fe.conf`
> - PM2: `source_infra/vps_deploy/pm2/ecosystem.config.js`

### 7.1. Lệnh quản lý PM2 (Node.js Process Manager)
- [ ] **Khởi động tất cả SSR Apps với PM2 (Shell, ERP, Catalog):**
  ```bash
  pm2 start source_infra/vps_deploy/pm2/ecosystem.config.js --env production
  ```

- [ ] **Xem trạng thái và giám sát CPU/RAM:**
  ```bash
  pm2 status
  pm2 monit
  ```

- [ ] **Xem logs realtime:**
  ```bash
  pm2 logs
  pm2 logs nexus-shell
  pm2 logs nexus-mfe-erp
  pm2 logs nexus-mfe-catalog
  ```

- [ ] **Restart / Reload không gián đoạn (Zero Downtime):**
  ```bash
  pm2 reload ecosystem.config.js --env production
  ```

- [ ] **Lưu danh sách tiến trình tự khởi động cùng OS:**
  ```bash
  pm2 save
  pm2 startup
  ```

---

### 7.2. Lệnh Nginx Reverse Proxy
- [ ] **Tạo symlink kích hoạt Nginx VirtualHost (Trên VPS Linux):**
  ```bash
  sudo ln -s /opt/nexus/source_infra/vps_deploy/nginx/nexus-micro-fe.conf /etc/nginx/sites-enabled/
  ```

- [ ] **Kiểm tra cú pháp file cấu hình Nginx:**
  ```bash
  sudo nginx -t
  ```

- [ ] **Reload Nginx để áp dụng cấu hình mới:**
  ```bash
  sudo systemctl reload nginx
  ```

---

## 8. QUẢN LÝ PORT & XỬ LÝ SỰ CỐ

### 8.1. Dọn dẹp Cache & Node Modules (Hard Reset)
- [ ] **Xóa sạch cache Turbo & Build output:**
  ```bash
  pnpm clean
  ```

- [ ] **Xóa triệt để node_modules và cài lại từ đầu (Khi bị xung đột package):**
  ```powershell
  # Windows PowerShell
  Get-ChildItem -Path . -Include node_modules,dist,.next,.nuxt,.output,.turbo -Recurse -Directory | Remove-Item -Recurse -Force
  pnpm install
  pnpm build:packages
  ```
  ```bash
  # Linux / macOS
  find . -name "node_modules" -o -name "dist" -o -name ".next" -o -name ".output" -o -name ".turbo" | xargs rm -rf
  pnpm install
  pnpm build:packages
  ```

---

### 8.2. Giải phóng Port bị chiếm dụng (Kill Port)

#### Trên Windows (PowerShell):
- [ ] **Tìm và tắt tiến trình đang chiếm port (Ví dụ Port 3000):**
  ```powershell
  # Tìm PID chiếm port 3000
  Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess

  # Tắt tiến trình theo Port
  Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force
  ```

- [ ] **Tắt nhanh tất cả các port từ 3000 đến 3006:**
  ```powershell
  3000..3006 | ForEach-Object {
    $conn = Get-NetTCPConnection -LocalPort $_ -ErrorAction SilentlyContinue
    if ($conn) {
      Stop-Process -Id $conn.OwningProcess -Force
      Write-Host "Đã kill tiến trình trên Port $_"
    }
  }
  ```

#### Trên Linux / macOS:
- [ ] **Tắt tiến trình chiếm port:**
  ```bash
  # Kill từng port
  sudo fuser -k 3000/tcp
  sudo fuser -k 3001/tcp
  sudo fuser -k 3002/tcp

  # Hoặc kill hàng loạt
  sudo kill -9 $(lsof -t -i:3000-3006)
  ```

---

## 9. BẢNG TRA CỨU PORT & ENDPOINTS

| Tên App | Framework | Port Local | Endpoint Dev | Trách nhiệm |
| :--- | :--- | :--- | :--- | :--- |
| **Shell (Host)** | Next.js 16.3 | `3000` | `http://localhost:3000` | Điều hướng, Layout Shell, Edge Middleware, Auth Gate |
| **MFE-Auth** | React 19 + Vite 8 | `3001` | `http://localhost:3001` | Đăng nhập, WebAuthn Passkey, MFA OTP, Reset Password |
| **MFE-POS** | React 19 + Vite 8 | `3002` | `http://localhost:3002` | Bán hàng POS, Giỏ hàng Zustand, Saga Checkout, Order SSE |
| **MFE-ERP** | Next.js 16.3 | `3003` | `http://localhost:3003` | KPI Dashboard, Recharts, Realtime Revenue SSE, Báo cáo |
| **MFE-Catalog** | Nuxt 4.5 + Vue 3 | `3004` | `http://localhost:3004` | Quản lý Sản phẩm/Danh mục, VeeValidate, Optimistic Lock |
| **MFE-Users** | Angular 22.1 | `3005` | `http://localhost:3005` | Quản lý nhân viên, ABAC Permission, AG Grid 33 |
| **MFE-Marketing**| Astro 7.2 | `3006` | `http://localhost:3006` | Landing Page, Pricing, Blog SSG, Tối ưu SEO 100% |
| **Backend API** | Spring Boot 3.3 | `8080` | `http://localhost:8080/api/v1` | REST APIs, SSE Streams, Business Logic, Database |

---

> 💡 **Mẹo:** Để bắt đầu làm việc ngay bây giờ, chỉ cần mở terminal tại thư mục gốc và chạy:
> ```bash
> pnpm install && pnpm build:packages && pnpm dev
> ```
