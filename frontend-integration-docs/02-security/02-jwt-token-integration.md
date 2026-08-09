# Tích hợp JWT Dual Token (Access + Refresh)

## 1. Khái niệm (Backend)
Backend sử dụng mô hình 2 token:
- **Access Token:** Ngắn hạn (ví dụ 15 phút), gửi kèm mỗi request.
- **Refresh Token:** Dài hạn (ví dụ 7 ngày), dùng để xin lại Access Token mới khi nó hết hạn.

## 2. Cách sử dụng (Backend APIs)
- Đăng nhập thành công trả về cả 2 token.
- Refresh API (POST /api/v1/auth/refresh) nhận Refresh Token và trả về Access Token mới.

## 3. Output (JSON Format)
`json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "dGVzdC..."
}
`

## 4. Tích hợp React (Best Practices)
- **Lưu trữ an toàn:** 
  - KHÔNG NÊN lưu token ở localStorage do nguy cơ XSS. 
  - NÊN lưu ở In-memory (biến JS) hoặc HttpOnly Cookies (nếu Backend hỗ trợ).
- **Silent Refresh (Axios Interceptor):**
  - Cấu hình Axios: Khi nhận mã lỗi 401 Unauthorized, interceptor sẽ tự động lấy refresh token, gọi API /refresh lấy access token mới, rồi chạy lại (retry) cái API vừa bị lỗi một cách hoàn toàn trong suốt với người dùng.
- **Thư viện khuyên dùng:** Dùng chay bằng cấu hình Axios Interceptors.

## 5. Cách Test
- Chỉnh thời gian sống của Access token ở Backend xuống 1 phút. Ở Frontend, cứ 2 phút bấm F5 lại để xem Axios có tự động đi gọi API refresh token ngầm không.
