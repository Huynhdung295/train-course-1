# Tích hợp Properties & Profiles

## 1. Khái niệm (Backend)
Backend chia cấu hình theo môi trường (`dev`, `staging`, `prod`).

## 2. Tích hợp React (Best Practices)
- Frontend cũng cần tương ứng sử dụng file `.env`:
  - `.env.development`: `VITE_API_URL=http://localhost:8080`
  - `.env.production`: `VITE_API_URL=https://api.myapp.com`
