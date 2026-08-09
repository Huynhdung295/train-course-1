# 📖 GUIDE: Entity & JPA

Dựa trên tài liệu lý thuyết, tầng Entity tuân thủ các nguyên tắc sau:
1. Mọi bảng phải kế thừa `BaseEntity` (tự sinh UUID và Audit created/updated).
2. Không dùng `GenerationType.AUTO` hoặc `IDENTITY` nếu không thực sự cần thiết, dùng `UUID` để bảo mật ID.
3. Không fetch Eager.
4. Lỗi N+1: Hãy xem file `OrderRepository.java` chứa đoạn code MOCK sử dụng `@Query("... JOIN FETCH ...")` để giải quyết.
