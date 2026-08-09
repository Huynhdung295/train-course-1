# Tích hợp Optimistic/Pessimistic Locking

## 1. Khái niệm (Backend)
- **Optimistic Locking:** Chống ghi đè dữ liệu. Dựa trên số ersion.
- **Pessimistic Locking:** Khóa cứng record ở DB (Ví dụ: SELECT ... FOR UPDATE khi thanh toán đơn hàng) để không ai khác được đụng vào.

## 2. Cách sử dụng (Backend APIs)
Mỗi bản ghi được fetch về từ Backend sẽ kèm theo trường ersion (Ví dụ: ersion: 1).

## 3. Tích hợp React (Best Practices)
- **Tình huống (Optimistic Locking):** 
  - User A và User B cùng mở Form sửa "Đơn Hàng #1" lúc 10:00 sáng. Lúc này bản ghi trên form của 2 người đều có ersion = 1.
  - User A lưu thành công lúc 10:01. Backend tăng version lên 2.
  - User B nhấn lưu lúc 10:02. Gửi API mang theo ersion = 1. Backend sẽ từ chối với lỗi HTTP 409 (Conflict).
- **Xử lý UI:**
  - Bắt lỗi HTTP 409 từ Axios.
  - Hiển thị Popup cảnh báo cho User B: "Dữ liệu này đã bị thay đổi bởi người khác, vui lòng làm mới trang hoặc xác nhận ghi đè". 

## 4. Cách Test
- Mở 2 Tab trình duyệt độc lập. Tab 1 ấn Lưu. Tab 2 ấn Lưu -> Tab 2 phải báo lỗi xung đột dữ liệu.
