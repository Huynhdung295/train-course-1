# Tích hợp Resilience4j (Circuit Breaker, Fallback)

## 1. Khái niệm (Backend)
Circuit Breaker (Cầu dao tự động): Nếu dịch vụ Inventory (Kho) bị sập, Backend sẽ không để user chờ timeout 30s. Mạch sẽ bị "ngắt" và Backend trả về ngay lập tức dữ liệu mặc định (Fallback) hoặc mã lỗi 503 Service Unavailable.

## 2. Cách sử dụng (Backend APIs)
- Nếu Circuit Breaker mở (Open): Backend trả về `503 Service Unavailable`.
- Nếu có Fallback: Backend có thể trả về một dữ liệu mặc định (ví dụ: Thay vì xem số lượng kho thực tế, tạm thời báo là "Còn hàng" để không làm đứt mạch mua sắm).

## 3. Tích hợp React (Best Practices)
- Bắt mã lỗi 503 để hiển thị giao diện báo lỗi thân thiện (Empty State hoặc Error Page).
- Đừng quên cung cấp nút "Thử lại" (Retry) để user gọi lại API khi mạch (Circuit) đóng lại.
