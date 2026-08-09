# 🚀 HƯỚNG DẪN KHỞI TẠO DỰ ÁN NEXT.JS (APP ROUTER)
Dành cho: Ứng dụng ERP Dashboard, Báo cáo phân tích (Yêu cầu SEO và tốc độ SSR).

---

## 1. KHỞI TẠO KHUNG DỰ ÁN (SCAFFOLDING)
Copy và chạy dòng lệnh sau trong Terminal để tạo khung dự án Next.js chuẩn mực nhất:

```bash
npx create-next-app@latest nexus-erp-web \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-npm
```

## 2. CÀI ĐẶT CÁC THƯ VIỆN LÕI
Di chuyển vào thư mục dự án và cài đặt bộ "Vũ khí hạng nặng" cho hệ thống Enterprise:

```bash
cd nexus-erp-web

# 1. State Management & Data Fetching
npm install zustand @tanstack/react-query

# 2. Form & Validation (Chuẩn hóa lỗi RFC 7807)
npm install react-hook-form @hookform/resolvers zod

# 3. Network & API
npm install axios @microsoft/fetch-event-source

# 4. Shadcn UI (Hệ thống Component Core)
npx shadcn-ui@latest init
# Chọn Default, Slate, và biến CSS (Yes). Sau đó cài các component hay dùng:
npx shadcn-ui@latest add button input form dialog toast table
```

## 3. CẤU TRÚC THƯ MỤC CHUẨN (FSD - FEATURE SLICED DESIGN)
Tạo nhanh cấu trúc thư mục bằng lệnh sau:

```bash
mkdir -p src/{shared,features,entities,widgets}
mkdir -p src/shared/{api,config,lib,ui}
```

## 4. KÍCH HOẠT (CHẠY LOCAL)
Để code và xem kết quả nóng (Hot Reload):

```bash
# Tạo file môi trường mẫu
echo "NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1" > .env.local

# Chạy Server
npm run dev
```
> Trình duyệt sẽ mở tại `http://localhost:3000`. Cứ F5 là tự động nhận Code mới!
