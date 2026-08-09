# Tích hợp Read/Write Splitting

## 1. Khái niệm (Backend)
Backend tự động điều hướng: 
- Các câu lệnh Ghi (POST, PUT, DELETE / @Transactional) sẽ chạy vào DB Master.
- Các câu lệnh Đọc (GET / @Transactional(readOnly=true)) sẽ chạy vào DB Slave (Replica).
Giúp tăng khả năng chịu tải (Scalability).

## 2. Tích hợp React (Best Practices)
- **Tránh Độ Trễ Đồng Bộ (Replication Lag):** 
  - Đôi khi Master và Slave đồng bộ dữ liệu trễ mất vài mili-giây.
  - Tình huống lỗi UI: Frontend gửi lệnh Ghi (POST Tạo Mới), sau đó lập tức gọi (GET Danh Sách) => Dữ liệu mới chưa kịp sang DB Slave, khiến giao diện Frontend bị thiếu hụt dữ liệu vừa tạo.
- **Giải pháp Frontend:**
  - **Cách 1:** Cập nhật State nội bộ của React ngay lập tức (Optimistic UI) bằng dữ liệu vừa POST thành công, thay vì gọi lại GET API.
  - **Cách 2:** Backend hỗ trợ trả về trực tiếp Object vừa tạo trong response của lệnh POST, Frontend tự push vào danh sách đang hiển thị. Dùng React Query (queryClient.setQueryData) rất phù hợp cho việc này.

## 3. Cách Test
- Tạo mới 1 bản ghi, kiểm tra xem nó có lập tức hiện trên bảng (Table) giao diện không.
