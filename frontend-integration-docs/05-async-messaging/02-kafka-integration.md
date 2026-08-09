# Tích hợp Kafka Messaging

## 1. Khái niệm (Backend)
Backend tích hợp Kafka để trao đổi Event giữa các Microservices (hoặc modules) và để cập nhật các bảng dữ liệu Read-Model (CQRS) tốc độ cao.

## 2. Tích hợp React (Best Practices)
- Sự chậm trễ dữ liệu (Eventual Consistency): Kafka là hàng đợi không đồng bộ. Khi Frontend gửi lệnh Tạo Đơn (Command), sau đó gọi lập tức lệnh Lấy Danh Sách Đơn (Query), có tỷ lệ rất nhỏ (vài mili-giây) dữ liệu chưa kịp đồng bộ sang Read-Model do Kafka đang xử lý.
- Giải pháp:
  - Frontend áp dụng **Optimistic UI Update** (cập nhật state giao diện bằng dữ liệu vừa submit thành công).
  - Hoặc Frontend hiển thị "Dữ liệu đang được đồng bộ" và tự động refetch lại bằng React Query sau vài giây.
