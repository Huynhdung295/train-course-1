# Tích hợp N+1 Problem (Hiệu suất query)

## 1. Khái niệm (Backend)
Tránh lỗi truy vấn N+1 (1 câu lệnh lấy danh sách cha, N câu lệnh lấy danh sách con). Backend sử dụng @EntityGraph hoặc @BatchSize để JOIN dữ liệu ngay trong 1 câu SQL.

## 2. Tích hợp React (Best Practices)
- **Tránh việc bóc tách quá nhiều API gọi lồng nhau:** 
  - Đôi khi Frontend thiết kế vòng lặp render danh sách cha, rồi trong mỗi Component con lại dùng useEffect gọi API để lấy chi tiết -> Đây là lỗi "N+1 ở tầng Frontend".
  - Giải pháp: Backend đã được thiết kế bằng @EntityGraph để có thể trả về cả cây dữ liệu (Cha + Con) trong 1 lần gọi API. Hãy tận dụng nó bằng cách thiết kế API trả về cấu trúc lồng nhau (Nested JSON) để Frontend chỉ gọi API đúng 1 lần cho trang hiển thị đó.

## 3. Cách Test
- Load trang danh sách trên Frontend. Mở tab Network xem có hiện tượng "bão request" (gọi hàng chục API giống nhau) hay không.
