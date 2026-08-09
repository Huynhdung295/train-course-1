# Tích hợp Spring Async Events

## 1. Khái niệm (Backend)
Khi có thay đổi dữ liệu (ví dụ Tạo đơn hàng), Backend phát ra các sự kiện nội bộ. Nếu có lỗi xảy ra ở luồng phụ (gửi mail fail), luồng chính vẫn thành công.

## 2. Tích hợp React (Best Practices)
- **Giao diện Async:** Vì các công việc phụ (như gửi Email xác nhận) được đẩy vào luồng Async (chạy ngầm), API Đặt hàng sẽ phản hồi rất nhanh. Frontend chỉ cần hiển thị "Đặt hàng thành công, email xác nhận đang được gửi".
- Không bắt người dùng đợi để xem email có gửi được hay không, giảm tối đa thời gian chờ đợi.
