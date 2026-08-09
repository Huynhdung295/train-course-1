# Tích hợp Domain Driven Design (DDD)

## 1. Khái niệm (Backend)
DDD tập trung mô hình hóa nghiệp vụ. Backend sử dụng các Aggregate Root, Entities, và Value Objects (ví dụ: Money, Address).
Dữ liệu trả về API thường phản ánh cấu trúc Business thay vì cấu trúc Bảng trong Database.

## 2. Cách sử dụng (Backend APIs)
Thay vì API cập nhật từng field rời rạc (/api/orders/updateField), Backend sẽ có các API theo ngữ nghĩa (Intent-driven APIs):
- /api/orders/{id}/cancel (Hủy đơn hàng)
- /api/orders/{id}/change-address (Đổi địa chỉ)

## 3. Output (JSON Format)
Value Objects như Money được format chuẩn (nhờ Custom Jackson Serializer):
`json
{
  "totalPrice": {
    "amount": 500.00,
    "currency": "USD"
  },
  "shippingAddress": {
    "city": "Hanoi",
    "street": "123 ABC"
  }
}
`

## 4. Tích hợp React (Best Practices)
- **Task-based UI:** Không nên tạo ra các form "chỉnh sửa tất cả" khổng lồ (CRUD UI). Thay vào đó, tạo các màn hình/popup theo nghiệp vụ (Task-based UI). Ví dụ: Một popup riêng biệt chỉ để "Hủy đơn hàng", một cái khác để "Đổi địa chỉ giao hàng".
- **Typing (TypeScript):** Định nghĩa các Value Objects rõ ràng trong TypeScript.
  `	ypescript
  type Money = { amount: number; currency: string };
  `
- **Thư viện khuyên dùng:** Intl.NumberFormat trên React để hiển thị Money đúng chuẩn locale thay vì tự format bằng tay.

## 5. Cách Test
- Gọi các Intent-driven APIs và xác nhận giao diện chuyển trạng thái tương ứng.
