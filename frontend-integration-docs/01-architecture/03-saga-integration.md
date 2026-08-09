# Tích hợp Saga Pattern (Giao dịch chéo)

## 1. Khái niệm (Backend)
Saga Pattern dùng để quản lý giao dịch dài trải qua nhiều module (Orders -> Payment -> Inventory). 
Nếu một bước thất bại, Saga sẽ tự động gọi các hàm bù trừ (Compensating Transactions) để hoàn tác (Ví dụ: Trả lại tiền, nhả lại kho).

## 2. Cách sử dụng (Backend APIs)
Khi Frontend gửi yêu cầu "Tạo đơn hàng", Backend không xử lý ngay lập tức mà trả về trạng thái PENDING hoặc PROCESSING.
Quá trình xử lý Saga chạy ngầm (Asynchronous).

## 3. Output (JSON Format)
`json
{
  "status": "success",
  "data": {
    "orderId": "123",
    "sagaStatus": "PROCESSING"
  }
}
`

## 4. Tích hợp React (Best Practices)
- **Polling vs WebSockets:** Vì kết quả của Saga có thể mất vài giây, Frontend KHÔNG NÊN khóa màn hình quay loading mãi mãi.
- **Thư viện khuyên dùng:** 
  - React Query: Sử dụng tính năng efetchInterval để polling định kỳ trạng thái đơn hàng cho đến khi sagaStatus chuyển thành COMPLETED hoặc FAILED.
  - Hoặc kết hợp với STOMP WebSockets (sẽ nói ở phần sau) để Backend tự đẩy thông báo về khi Saga hoàn tất.
- **UI UX:** Cung cấp thông báo "Đơn hàng đang được xử lý..." cho người dùng. Nếu thất bại, hiển thị Toast báo lỗi chính xác (ví dụ: "Hết hàng, đã hoàn tiền").

## 5. Cách Test
- Giả lập độ trễ (delay) trong network bằng Chrome DevTools để kiểm tra trạng thái Loading và Polling của React hoạt động chính xác.
