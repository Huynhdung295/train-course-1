# Tích hợp API Gateway & Mesh

## 1. Khái niệm (Backend)
(Ghi chú: Gateway độc lập hiện đã được tháo gỡ khỏi project này do xung đột WebFlux và MVC trong kiến trúc Modulith hiện tại, nhưng mô hình bảo vệ tổng thể vẫn tồn tại qua Filter của Spring Security).
Mọi request đều đi qua một "Cổng bảo vệ" (Security Filters).

## 2. Cách sử dụng (Backend APIs)
Cổng bảo vệ sẽ kiểm tra JWT token, Rate Limiting, và CORS.
Nếu vi phạm, Backend sẽ trả về lỗi ngay lập tức mà không đi sâu vào logic.

## 3. Output (JSON Format)
Lỗi từ Gateway/Filter:
`json
{
  "status": 401,
  "error": "Unauthorized",
  "message": "Token expired or invalid"
}
`
Hoặc Rate Limit: 429 Too Many Requests.

## 4. Tích hợp React (Best Practices)
- **CORS:** Frontend cần cấu hình đúng domain hoặc proxy (nếu dùng Vite/Webpack) trong môi trường dev để tránh lỗi CORS.
- **Xử lý Global Error:**
  - **Thư viện khuyên dùng:** Axios Interceptors.
  - Cấu hình một interceptor để bắt mã 401. Nếu 401 xảy ra, tự động gọi API Refresh Token, rồi gửi lại request cũ. Nếu thất bại, đá user về trang /login.
  - Bắt mã 429 (Rate limit) để hiển thị thông báo: "Vui lòng thao tác chậm lại".

## 5. Cách Test
- Xóa JWT token trong localStorage của browser, reload trang xem có tự redirect về Login không.
- Bấm liên tục vào 1 nút submit để trigger mã 429 và kiểm tra UI có hiện cảnh báo không.
