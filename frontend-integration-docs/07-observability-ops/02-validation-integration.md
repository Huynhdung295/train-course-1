# Tích hợp Validation Constraints

## 1. Khái niệm (Backend)
Backend kiểm tra dữ liệu đầu vào cực kỳ khắt khe: UUID đúng định dạng, Số điện thoại đúng chuẩn E.164, Email hợp lệ.

## 2. Tích hợp React (Best Practices)
- **Valiation kép (Double Validation):** Dù Backend có kiểm tra kỹ tới đâu, Frontend VẪN PHẢI chặn lỗi ngay từ UI để tiết kiệm Network request và tăng trải nghiệm.
- Dùng thư viện `Yup` hoặc `Zod` kết hợp với `React Hook Form` để thiết lập các rule (regex) tương tự hệt như Backend.
