# Tích hợp RabbitMQ (DLQ / Retries)

## 1. Khái niệm (Backend)
Backend dùng RabbitMQ kèm cơ chế DLQ (Dead Letter Queue) để tự động retry khi gặp lỗi (ví dụ API bên thứ 3 chết).

## 2. Tích hợp React (Best Practices)
- Nếu một tiến trình báo lỗi, đừng vội hiển thị ngay "Giao dịch thất bại hoàn toàn", thay vào đó hãy chuyển status sang "Đang xử lý (Retrying...)" trên giao diện để thông báo hệ thống đang nỗ lực tự động thử lại.
