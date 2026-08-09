# Tích hợp Multi-level Cache (Redis + Caffeine)

## 1. Khái niệm (Backend)
Backend sử dụng hệ thống Cache 2 lớp (L1 là RAM của Backend - Caffeine, L2 là Redis). 
Mục tiêu là phản hồi API siêu tốc (dưới 10ms) cho các cấu hình hệ thống hoặc dữ liệu ít thay đổi.

## 2. Cách sử dụng (Backend APIs)
Backend tự động quản lý vòng đời Cache. Nếu có request GET, backend ưu tiên đọc từ L1 -> L2 -> DB.

## 3. Tích hợp React (Best Practices)
- Mặc dù Backend trả về rất nhanh, React cũng nên duy trì Cache ở phía Frontend (State Management hoặc Browser Cache) để trải nghiệm UI mượt mà nhất (Tránh việc chuyển trang vẫn thấy spinner loading dù chỉ nháy lên vài mili-giây).
- **Thư viện khuyên dùng:** 
  - React Query: Định nghĩa staleTime: 60000 (1 phút) cho các danh mục (Categories), Cấu hình (Settings) để Frontend không thèm gọi API lấy lại dữ liệu liên tục khi user chuyển qua lại giữa các tab UI.

## 4. Cách Test
- Gọi API GET, lần 1 có thể mất 100ms, lần 2 mất 5ms. 
