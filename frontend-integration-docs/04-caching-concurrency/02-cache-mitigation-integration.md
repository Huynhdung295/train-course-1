# Tích hợp Cache Anti-patterns (Stampede)

## 1. Khái niệm (Backend)
Backend được trang bị cơ chế chống Stampede Cache (chống bão truy cập). Khi Cache vừa hết hạn và có 1 triệu request đồng thời ập vào hỏi chung 1 data, chỉ 1 request duy nhất được phép xuống Database, 999.999 request kia phải chờ.

## 2. Tích hợp React (Best Practices)
- Do cơ chế chống bão của Backend (có thể bắt các request khác chờ vài chục mili-giây thay vì sập hệ thống), thỉnh thoảng có những request từ Frontend sẽ phản hồi chậm hơn một tí xíu so với lúc bình thường.
- Frontend không cần xử lý đặc biệt, chỉ cần luôn hiển thị Skeleton/Spinner tinh tế để người dùng không cảm thấy ứng dụng bị "đơ" nếu lọt vào khoảng thời gian chờ lock của Backend.

## 3. Cách Test
- Dùng công cụ (như JMeter) bắn hàng ngàn request cùng lúc, kiểm tra DB không bị quá tải.
