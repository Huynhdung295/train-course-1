# Tích hợp OAuth2 / OIDC PKCE

## 1. Khái niệm (Backend)
OAuth2 với luồng PKCE (Proof Key for Code Exchange) là chuẩn bảo mật hiện đại thay thế Implicit Flow cho các ứng dụng SPA (React). 
Frontend sẽ tạo một mã bí mật ngẫu nhiên (code_verifier), băm nó ra (code_challenge) và gửi cho Authorization Server (như Google, Keycloak).

## 2. Cách sử dụng (Backend APIs)
Backend không xử lý trực tiếp flow đăng nhập này mà đóng vai trò là Resource Server xác nhận Access Token từ OAuth2 provider, hoặc chính Backend làm Authorization Server.

## 3. Output (JSON Format)
Dựa theo chuẩn OIDC, thông tin profile người dùng được chứa trong token (JWT) hoặc lấy từ /userinfo endpoint.

## 4. Tích hợp React (Best Practices)
- **Thư viện khuyên dùng:** **Tuyệt đối không nên tự code tay OAuth2 PKCE flow.** Hãy sử dụng các thư viện chuẩn như:
  - eact-oidc-context (dành cho OIDC nói chung).
  - Hoặc oidc-client-ts.
- Các thư viện này tự động quản lý việc tạo PKCE codes, chuyển hướng đến trang đăng nhập, xử lý callback URL và trích xuất Access Token, tự động refresh token trong background.

## 5. Cách Test
- Bấm "Đăng nhập bằng Google/Keycloak". Kiểm tra URL trên thanh trình duyệt có chứa các tham số code_challenge và code_challenge_method=S256 không.
