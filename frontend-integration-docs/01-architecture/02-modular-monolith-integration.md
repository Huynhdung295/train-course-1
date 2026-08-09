# Tích hợp Modular Monolith (Spring Modulith)

## 1. Khái niệm (Backend)
Backend sử dụng Spring Modulith để chia nhỏ ứng dụng thành các module độc lập (như orders, inventory, products) nhưng vẫn chạy chung trong 1 tiến trình (Monolith).
Các module giao tiếp với nhau bằng Event thay vì gọi trực tiếp (Loose coupling).

## 2. Cách sử dụng (Backend APIs)
Mặc dù Backend chia thành nhiều module, Frontend vẫn giao tiếp qua một Base URL duy nhất, không bị phân mảnh như Microservices.
- Ví dụ: /api/v1/orders (Order module) và /api/v1/inventory (Inventory module) đều nằm chung domain.

## 3. Output (JSON Format)
Cấu trúc lỗi cũng thống nhất giữa các module (sử dụng RFC 7807 Problem Detail):
`json
{
  "type": "about:blank",
  "title": "Inventory Exhausted",
  "status": 400,
  "detail": "Product XYZ is out of stock",
  "instance": "/api/v1/orders"
}
`

## 4. Tích hợp React (Best Practices)
- **Tổ chức Frontend (Feature Slicing):** Cấu trúc source code React nên tương đồng với Backend. Sử dụng *Feature-Sliced Design* hoặc gộp theo tính năng:
  - src/features/orders/
  - src/features/inventory/
  Mỗi feature tự chứa components, hooks, và API services riêng.
- **Thư viện khuyên dùng:** Không bắt buộc thư viện mới, nhưng việc tổ chức lại theo Feature sẽ giúp code React dễ scale lên khi chuyển sang Micro-Frontends.

## 5. Cách Test
- Đảm bảo khi gửi request lên một domain (ví dụ Orders), nếu có lỗi từ domain khác (ví dụ Inventory), Frontend có thể catch lỗi dựa trên 	itle hoặc status của Problem Detail.
