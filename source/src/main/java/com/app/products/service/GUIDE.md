# 📖 GUIDE: Product Service

## MOCK CODE SỬ DỤNG CACHE
Trong `ProductService.java`, chúng ta đã sử dụng `@Cacheable`. Hãy đảm bảo bạn cấu hình Redis làm Cache Manager để tránh Query DB nhiều lần.

```java
// Khi gọi hàm này lần 2 với cùng ID, Spring sẽ không query CSDL.
productService.getProductById(uuid);
```
