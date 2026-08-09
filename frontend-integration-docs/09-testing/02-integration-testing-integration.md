# Tích hợp Integration Testing

## 1. Khái niệm (Backend)
Test toàn bộ luồng API từ Controller xuống Database bằng Testcontainers.

## 2. Tích hợp React (Best Practices)
- Frontend dùng `Cypress` hoặc `Playwright` để thực hiện E2E Test (giả lập thao tác click chuột của user từ lúc đăng nhập, chọn món đồ đến khi thanh toán thành công) gọi lên Backend thật hoặc Mock API bằng `msw`.
