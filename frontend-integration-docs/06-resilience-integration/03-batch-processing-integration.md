# Tích hợp Spring Batch

## 1. Khái niệm (Backend)
Spring Batch dùng để xử lý dữ liệu lớn (ví dụ: Kết toán hàng vạn hóa đơn cuối ngày, gửi email marketing). Xử lý chia theo từng Chunk (khối).

## 2. Cách sử dụng (Backend APIs)
- Thường được kích hoạt qua CronJob hoặc một API nội bộ đặc biệt `/api/v1/jobs/start-daily-report`.

## 3. Tích hợp React (Best Practices)
- **Tiến độ (Progress Bar):**
  - Quá trình Batch chạy rất lâu. Frontend có thể gọi API dạng Polling (mỗi 5s/lần) để lấy `% hoàn thành` của Batch Job (dựa vào số Step đã chạy).
  - Hoặc kết hợp WebSocket để Backend tự động push `%` về UI.
