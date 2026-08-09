# Tích hợp Entity Annotations (Soft delete, Encrypt)

## 1. Khái niệm (Backend)
- **Soft Delete:** Khi gọi lệnh xóa, Backend chỉ đổi trạng thái deleted = true thay vì xóa mất khỏi DB.
- **Encrypt:** Tự động mã hóa (AES) các trường nhạy cảm trong DB (như thẻ tín dụng).

## 2. Tích hợp React (Best Practices)
- **Khôi phục dữ liệu (Restore):** 
  - Vì là Soft Delete, Backend có thể hỗ trợ API khôi phục. 
  - Frontend nên thiết kế chức năng "Thùng rác" (Recycle Bin) hoặc hiển thị toast "Đã xóa. Bấm hoàn tác (Undo) để khôi phục".
- **Hiển thị dữ liệu mã hóa:** Dữ liệu mã hóa trong DB, nhưng khi API trả về cho Frontend thì đã được tự động giải mã. Frontend sử dụng bình thường không cần xử lý gì thêm. Đối với các dữ liệu rất nhạy cảm, Frontend nên chủ động ẩn bớt (ví dụ: **** **** **** 1234).

## 3. Cách Test
- Gọi API Delete. Vào database xem dòng đó còn tồn tại nhưng deleted=true không.
