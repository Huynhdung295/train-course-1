# Tích hợp WebSocket & STOMP (Realtime)

## 1. Khái niệm (Backend)
Kết nối 2 chiều (Bi-directional). Backend dùng Redis Pub/Sub kết hợp Spring WebSocket (STOMP) để bắn thông báo realtime cho người dùng bất kể họ đang kết nối tới server nào.

## 2. Cách sử dụng (Backend APIs)
- Endpoint kết nối (SockJS fallback): `/ws`
- Subcribe topic (User cá nhân): `/user/queue/notifications`

## 3. Tích hợp React (Best Practices)
- **Thư viện khuyên dùng:** `@stomp/stompjs` kết hợp với `sockjs-client`.
- **Luồng tích hợp:**
  ```javascript
  import { Client } from '@stomp/stompjs';
  
  const client = new Client({
    brokerURL: 'ws://localhost:8080/ws',
    connectHeaders: {
      Authorization: `Bearer ${accessToken}`
    },
    onConnect: () => {
      client.subscribe('/user/queue/notifications', message => {
        // Cập nhật State Notification (Redux/Zustand)
        toast.info(JSON.parse(message.body).content);
      });
    },
  });
  client.activate();
  ```
- Luôn nhớ ngắt kết nối `client.deactivate()` khi User Logout hoặc đóng Tab (sử dụng cleanup function của `useEffect`).
