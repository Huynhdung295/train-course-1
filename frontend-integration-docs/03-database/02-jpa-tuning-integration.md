# Tích hợp JPA/Hibernate Tuning

## 1. Khái niệm (Backend)
Tối ưu hóa các câu lệnh SQL sinh ra bởi Hibernate (như dùng @DynamicUpdate để chỉ cập nhật các trường bị thay đổi, tránh ghi lại toàn bộ bảng).

## 2. Cách sử dụng (Backend APIs)
Hoạt động ngầm phía sau khi Backend gọi lệnh save().

## 3. Tích hợp React (Best Practices)
- **Tối ưu Network (PATCH vs PUT):**
  - Khi form chỉnh sửa có hàng chục trường, nhưng user chỉ sửa 1 trường (ví dụ: số điện thoại).
  - Frontend nên sử dụng phương thức PATCH và chỉ gửi đúng cái field bị thay đổi lên Backend thay vì gửi toàn bộ Object khổng lồ (phương thức PUT). 
  - Backend sử dụng @DynamicUpdate sẽ bắt được sự kiện này và sinh ra câu lệnh SQL rất ngắn UPDATE user SET phone = ? WHERE id = ?.

## 4. Cách Test
- Sửa 1 trường trên giao diện. Kiểm tra Payload gửi lên server trong Chrome DevTools (Tab Network).
