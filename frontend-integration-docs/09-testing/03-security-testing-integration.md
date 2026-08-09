# Tích hợp Security Testing

## 1. Khái niệm (Backend)
Kiểm tra lỗ hổng bảo mật, CSRF, cấu hình phân quyền bằng `MockMvc` và `@WithMockUser`.

## 2. Tích hợp React (Best Practices)
- Đảm bảo Frontend luôn truyền đúng các Header chống CSRF (nếu Backend trả về cookie `XSRF-TOKEN`, Axios phải cấu hình `withCredentials: true` và `xsrfHeaderName: 'X-XSRF-TOKEN'`).
