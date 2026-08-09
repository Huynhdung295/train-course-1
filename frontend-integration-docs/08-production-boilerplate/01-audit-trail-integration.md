# Tích hợp Base Entity / Audit Trail

## 1. Khái niệm (Backend)
Mọi bảng trong Database đều có các trường tự động lưu vết: `createdBy`, `updatedBy`, `createdAt`, `updatedAt`.

## 2. Output (JSON Format)
Dữ liệu trả về sẽ luôn đi kèm các trường Audit này.

## 3. Tích hợp React (Best Practices)
- Frontend có thể tận dụng các trường này để làm tính năng "Lịch sử chỉnh sửa" hoặc "Hiển thị người tạo".
- Không bao giờ gửi các trường này trong Payload `POST` hoặc `PUT` vì Backend tự tính toán, Frontend gửi lên cũng bị bỏ qua.
