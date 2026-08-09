# Tích hợp Multi-Tenancy

## 1. Khái niệm (Backend)
Multi-tenancy cho phép chung một mã nguồn, chung Database nhưng phục vụ nhiều Công ty/Khách hàng (Tenants) khác nhau một cách cách ly hoàn toàn. (Ví dụ: SaaS như Shopify).

## 2. Cách sử dụng (Backend APIs)
Backend xác định Tenant thông qua một HTTP Header đặc biệt (ví dụ: X-Tenant-ID: apple) do Frontend gửi lên. Dựa vào đó, Backend sẽ trỏ vào Database/Schema của Apple.

## 3. Tích hợp React (Best Practices)
- **Xác định TenantID:** Frontend thường xác định Tenant dựa vào URL (ví dụ: pple.myapp.com thì tenantId = pple).
- **Gắn Header tự động:**
  - Cấu hình Axios Interceptor để tự động gắn X-Tenant-ID vào **tất cả** request gọi lên Backend.
  `javascript
  axios.interceptors.request.use(config => {
      const tenantId = window.location.hostname.split('.')[0];
      config.headers['X-Tenant-ID'] = tenantId;
      return config;
  });
  `

## 4. Cách Test
- Gọi API tạo dữ liệu trên domain A. Chuyển sang domain B gọi API xem danh sách -> sẽ không thấy dữ liệu của A.
