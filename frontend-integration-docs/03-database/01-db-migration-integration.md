# Tích hợp Database Migration (Flyway)

## 1. Khái niệm (Backend)
Backend sử dụng Flyway để tự động khởi tạo/nâng cấp bảng Database (bằng file SQL) mỗi khi chạy ứng dụng. Đảm bảo cấu trúc DB trên mọi môi trường (Dev/Prod) luôn đồng bộ với Code.

## 2. Cách sử dụng (Backend APIs)
Không có API trực tiếp. Tuy nhiên, nó đảm bảo dữ liệu mà Frontend nhận được sẽ luôn đúng cấu trúc thiết kế.

## 3. Tích hợp React (Best Practices)
- **Data Mocking:** Frontend không cần chờ Backend cấu hình DB thủ công nữa. Khi Backend chạy lên là có DB ngay. 
- Nếu Frontend cần giả lập dữ liệu trước khi có API (Mocking), hãy lấy file V1__init.sql làm tài liệu tham khảo cho cấu trúc DTO bên React (TypeScript interfaces).

## 4. Cách Test
- Backend khởi động mà không báo lỗi Flyway Migration là thành công.
