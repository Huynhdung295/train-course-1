# Tích hợp Virtual Threads (Loom)

## 1. Khái niệm (Backend)
Backend sử dụng Java 21 Virtual Threads, giúp xử lý hàng triệu kết nối đồng thời với lượng RAM cực nhỏ. Tuyệt vời cho các IO-bound task.

## 2. Tích hợp React (Best Practices)
- Frontend không cần code gì đặc biệt vì đây là cấu hình ngầm của Server.
- Tuy nhiên, vì khả năng chịu tải kết nối (Concurrency) của Backend rất trâu bò, Frontend hoàn toàn tự tin tích hợp **Server-Sent Events (SSE)** hoặc Websocket để duy trì kết nối liên tục thay vì e dè sập Server như các thiết kế Thread-per-request cũ.

## 3. Cách Test
- K6 load testing: Kiểm tra xem server có thể chịu nổi 10,000 kết nối HTTP giữ nguyên trạng thái mở (SSE) mà không cạn kiệt CPU/RAM hay không.
