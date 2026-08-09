# Tích hợp Custom Jackson (JSON/Date/Money)

## 1. Khái niệm (Backend)
- Jackson được cấu hình chuẩn hóa:
  - Thời gian luôn là định dạng ISO-8601 UTC (ví dụ: `2023-10-01T15:30:00Z`).
  - Tiền tệ (Money) luôn tách làm `amount` và `currency`.

## 2. Tích hợp React (Best Practices)
- **Xử lý Thời gian (Timezone):**
  - Backend gửi `Z` (UTC). Trình duyệt của user ở Việt Nam (GMT+7) cần tự động cộng thêm 7 tiếng.
  - Sử dụng đối tượng `Date` của JS hoặc thư viện `date-fns`, `dayjs`.
  - Hiển thị theo múi giờ máy tính user: `new Date(utcString).toLocaleString()`.
- **Xử lý Tiền tệ:**
  - Tuyệt đối không tính toán cộng/trừ tiền bạc bằng số thập phân trên JavaScript (bị lỗi làm tròn `0.1 + 0.2 = 0.30000000000000004`).
  - Luôn sử dụng thư viện `currency.js` hoặc `big.js` nếu buộc phải cộng trừ ở Frontend. Tốt nhất là để Backend tính và chỉ hiển thị.
