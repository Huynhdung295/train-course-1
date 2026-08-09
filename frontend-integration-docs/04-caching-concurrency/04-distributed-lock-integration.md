# Tích hợp Distributed Locking (Redisson)

## 1. Khái niệm (Backend)
Backend sử dụng Redisson (khóa phân tán) trên các cụm nhiều server để chặn triệt để việc Frontend gửi 2 request giống hệt nhau liên tiếp (ví dụ: User bực mình bấm click liên tục vào nút "Thanh toán").

## 2. Tích hợp React (Best Practices)
- Mặc dù Backend đã bảo vệ rất tốt bằng Distributed Lock, **trách nhiệm đầu tiên luôn thuộc về Frontend**.
- **Chống Double Click (Debounce / Disable):**
  - Mọi nút bấm có tính chất thay đổi dữ liệu (Submit Form, Thanh Toán, Duyệt) đều phải chuyển sang trạng thái disabled (hoặc hiện spinner bên trong nút) ngay trong khoảnh khắc user click vào, và chỉ nhả ra khi API kết thúc (dù thành công hay lỗi).
- Bắt lỗi: Nếu click quá nhanh lọt qua Backend, Backend sẽ trả về HTTP 423 (Locked) hoặc 409 (Conflict). Bỏ qua (không cần show toast) hoặc show cảnh báo nhẹ.

## 3. Cách Test
- Bấm F12, Disable Javascript hoặc bỏ disable button trên UI rồi click liên tiếp hàng chục lần vào nút Submit. Chỉ có đúng 1 request được Backend xử lý.
