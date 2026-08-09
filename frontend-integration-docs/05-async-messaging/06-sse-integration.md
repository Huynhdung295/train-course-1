# Tích hợp Server-Sent Events (SSE)

## 1. Khái niệm (Backend)
Giao tiếp 1 chiều (Từ Server đổ Data về Client). Lý tưởng cho các luồng dữ liệu liên tục như Bảng giá Chứng khoán, Trạng thái đơn hàng (Saga), mà không cần phức tạp như WebSockets.

## 2. Cách sử dụng (Backend APIs)
Endpoint `/api/v1/stream/notifications`.

## 3. Tích hợp React (Best Practices)
- **API Mặc định:** Dùng đối tượng `EventSource` có sẵn trên mọi trình duyệt.
- **Thư viện khuyên dùng (Nếu cần Custom Headers):** `@microsoft/fetch-event-source` (Cho phép gửi header Authorization Bearer token, tự động retry, xử lý lỗi mượt hơn EventSource thuần).
  ```javascript
  import { fetchEventSource } from '@microsoft/fetch-event-source';
  
  fetchEventSource('/api/v1/stream/notifications', {
    headers: { Authorization: `Bearer ${token}` },
    onmessage(ev) {
      console.log('Nhận data realtime:', ev.data);
    },
    onerror(err) {
      // Xử lý mất kết nối
    }
  });
  ```
