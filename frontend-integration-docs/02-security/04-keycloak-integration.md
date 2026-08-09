# Tích hợp Keycloak Auth Server

## 1. Khái niệm (Backend)
Keycloak đóng vai trò là Identity and Access Management (IAM). Backend ủy quyền việc quản lý user, password, role cho Keycloak. Backend chỉ cần xác minh chữ ký của JWT (do Keycloak phát hành) là hợp lệ.

## 2. Cách sử dụng (Backend APIs)
Backend đã cấu hình KeycloakJwtAuthenticationConverter để trích xuất quyền (Roles) từ token JWT của Keycloak (nằm trong mảng ealm_access.roles).

## 3. Output (JSON Format)
Không có output trực tiếp, mà thông tin roles sẽ được truyền vào SecurityContext của Spring.

## 4. Tích hợp React (Best Practices)
- Tương tự như OAuth2, Frontend cần tương tác trực tiếp với Keycloak.
- **Thư viện khuyên dùng:** Dùng keycloak-js kết hợp với @react-keycloak/web.
  - Bọc toàn bộ app bằng <ReactKeycloakProvider>.
  - Lấy instance của Keycloak thông qua hook const { keycloak, initialized } = useKeycloak().
  - Để đăng nhập: keycloak.login(). Lấy token: keycloak.token.

## 5. Cách Test
- Đăng nhập vào Keycloak Admin Console, gán cho user một quyền (Role) tên là ADMIN.
- Đăng nhập bên React, decode JWT access token (trên trang jwt.io) xem mảng ealm_access.roles đã có chữ ADMIN chưa.
