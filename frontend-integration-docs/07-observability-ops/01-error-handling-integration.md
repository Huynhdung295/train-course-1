# Tích hợp Global Error Handling (RFC 7807)

## 1. Khái niệm (Backend)
Mọi lỗi từ Backend (400, 401, 403, 404, 500) đều được format theo đúng chuẩn mực quốc tế RFC 7807 (Problem Detail).

## 2. Output (JSON Format)
```json
{
  "type": "https://api.myapp.com/errors/validation",
  "title": "Validation Error",
  "status": 400,
  "detail": "Invalid input data",
  "instance": "/api/v1/users",
  "errors": {
    "email": "Email format is invalid",
    "age": "Must be >= 18"
  }
}
```

## 3. Tích hợp React (Best Practices)
- Cấu trúc chung này giúp Frontend cực kỳ dễ dàng map lỗi vào UI.
- Nếu là lỗi Form (400 Validation), đọc object `errors` và gán vào thư viện form (như `React Hook Form`).
  ```javascript
  // axios error catch
  if (error.response.status === 400 && error.response.data.errors) {
      Object.entries(error.response.data.errors).forEach(([field, msg]) => {
          setError(field, { message: msg });
      });
  }
  ```
