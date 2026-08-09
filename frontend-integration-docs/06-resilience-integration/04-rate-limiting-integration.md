# Tích hợp Rate Limiting (Throttling)

## 1. Khái niệm (Backend)
Chống Spam/DDoS. Ví dụ: Giới hạn mỗi IP chỉ được gọi API đăng nhập 5 lần/phút.

## 2. Cách sử dụng (Backend APIs)
- Nếu vượt quá giới hạn, Backend lập tức trả về mã `429 Too Many Requests`.
- Có kèm theo Header `Retry-After: 60` (Cho biết 60 giây sau mới được gọi lại).

## 3. Tích hợp React (Best Practices)
- **Bắt lỗi 429 trên Axios:**
  ```javascript
  axios.interceptors.response.use(res => res, error => {
      if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          toast.error(`Bạn thao tác quá nhanh. Vui lòng thử lại sau ${retryAfter} giây.`);
      }
      return Promise.reject(error);
  });
  ```
- Tạm thời `disabled` nút bấm trong khoảng thời gian `Retry-After`.
