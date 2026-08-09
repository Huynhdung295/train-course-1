# 🚀 HƯỚNG DẪN KHỞI TẠO DỰ ÁN REACT (VITE SPA)
Dành cho: Ứng dụng POS Bán Hàng (Client-Side Rendering để chạy cực mượt, không cần SEO, có thể cài thành PWA chạy Offline).

---

## 1. KHỞI TẠO KHUNG DỰ ÁN (SCAFFOLDING)
Tuyệt đối không dùng `create-react-app` (đã lỗi thời). Chúng ta dùng **Vite** để tốc độ Build nhanh gấp 10 lần.

```bash
npm create vite@latest nexus-pos-app -- --template react-ts
```

## 2. CÀI ĐẶT CÁC THƯ VIỆN LÕI
Di chuyển vào thư mục và cài đặt các "đồ chơi" cần thiết:

```bash
cd nexus-pos-app
npm install

# 1. Router & State
npm install react-router-dom zustand @tanstack/react-query

# 2. Thư viện UI & Styling (Tailwind + Shadcn)
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 3. Quét mã vạch & Sinh trắc học (Passkeys)
npm install react-use @simplewebauthn/browser
```

## 3. CẤU HÌNH TAILWIND & SHADCN UI
Chạy lệnh sau để thiết lập Shadcn UI tự động vào Vite:

```bash
# Sửa file tsconfig.json để support Alias "@/*" trước
# Thêm: "baseUrl": ".", "paths": { "@/*": ["./src/*"] } vào compilerOptions

# Sau đó chạy Init
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input toast
```

## 4. KÍCH HOẠT (CHẠY LOCAL)

```bash
# Tạo môi trường
echo "VITE_API_URL=http://localhost:8080/api/v1" > .env.local

# Chạy Server siêu tốc
npm run dev
```
> Trình duyệt sẽ mở tại `http://localhost:5173`. Mở máy quét mã vạch lên và chiến thôi!
