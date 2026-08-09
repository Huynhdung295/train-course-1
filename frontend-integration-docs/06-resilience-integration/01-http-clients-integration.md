# Tích hợp REST / Web Clients

## 1. Khái niệm (Backend)
Backend sử dụng `RestClient` (Spring 6) hoặc `WebClient` để gọi các API nội bộ hoặc bên thứ ba (như cổng thanh toán Stripe).

## 2. Cách sử dụng (Backend APIs)
Backend đã xử lý sẵn các lỗi mạng từ phía server bên kia (timeout, host unreachable). Nếu có lỗi, Backend sẽ trả về lỗi HTTP chuẩn (500 hoặc 503) cho Frontend.

## 3. Tích hợp React (Best Practices)
- Frontend chỉ quan tâm việc Backend trả về lỗi 5xx.
- Hiển thị Toast thông báo chung chung: "Dịch vụ đang tạm thời gián đoạn, vui lòng thử lại sau".
