# Tích hợp Spring Security & Permissions

## 1. Khái niệm (Backend)
Spring Security bảo vệ toàn bộ API. Mọi request không được xác thực sẽ bị từ chối (HTTP 401). Nếu người dùng không có quyền (Role) truy cập một API cụ thể, sẽ bị từ chối (HTTP 403).

## 2. Cách sử dụng (Backend APIs)
Backend tự động trích xuất thông tin người dùng từ Authorization header chứa Bearer Token.

## 3. Output (JSON Format)
- Lỗi 401: Unauthorized (Chưa đăng nhập / Token hết hạn).
- Lỗi 403: Forbidden (Không có quyền thực hiện hành động này).

## 4. Tích hợp React (Best Practices)
- **Quản lý State:** Lưu thông tin user (profile, roles) vào Global State (như Zustand hoặc Redux).
- **Phân quyền UI (Role-based UI):** 
  - Tạo một custom component <ProtectedRoute role="ADMIN"> để bao bọc các tính năng yêu cầu quyền cao.
  - Ẩn/hiện các nút bấm tùy theo Role của user hiện tại. (Ví dụ: Ẩn nút "Xóa User" nếu không phải ADMIN).

## 5. Cách Test
- Đăng nhập bằng user thường và cố truy cập một trang/API dành cho ADMIN để xem thông báo lỗi 403.
