# 🍃 MongoDB Data Modeling & Transactions

> **Category**: NoSQL & Caching | **Complexity**: Intermediate | **MongoDB**: 6.x/7.x

---

## 📖 Core Technical Mechanics & Deep-Dive

### Triết lý của Document DB (MongoDB)
Khác với Relational DB (Chuẩn hóa - Normalization), triết lý của MongoDB là **Dữ liệu được truy cập cùng nhau thì nên được lưu trữ cùng nhau**.
MongoDB không yêu cầu Schema cố định (Schemaless), giúp quá trình phát triển nhanh chóng (Agile) và đặc biệt phù hợp với dữ liệu phi cấu trúc, cấu trúc thay đổi liên tục, hoặc đa dạng chủng loại (như Product Catalog trong E-commerce, Log Analytics, hoặc Content Management).

### Hai trường phái Data Modeling
1. **Embedding (Nhúng)**: Lưu dữ liệu liên quan vào bên trong mảng hoặc nested object của Document chính.
   - *Ưu điểm*: Đọc cực nhanh (1 Query lấy được tất cả).
   - *Nhược điểm*: Document size có thể vượt qua giới hạn 16MB. Dữ liệu bị trùng lặp (Denormalization).
2. **Referencing (Tham chiếu)**: Lưu ObjectID của Document này vào Document khác (giống Foreign Key).
   - *Ưu điểm*: Tránh trùng lặp data. Không sợ giới hạn 16MB.
   - *Nhược điểm*: Phải dùng `$lookup` (Tương đương JOIN) để lấy dữ liệu, chậm hơn so với Embedding.

### Multi-Document Transactions (ACID)
Từ MongoDB 4.0 (Replica Sets) và 4.2 (Sharded Clusters), MongoDB đã hỗ trợ **ACID Transactions trên nhiều Document / nhiều Collection**.
Tuy nhiên, dùng Transaction trong MongoDB được xem là *Giải pháp cuối cùng* (Code Smell). Nếu bạn phải dùng Transaction để đảm bảo tính nhất quán giữa 2 collections, khả năng cao là bạn đã Model data sai (Lẽ ra nên Embed chúng vào cùng 1 Document, vì ghi trên 1 Document mặc định là ACID atomic!).

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[mongodb/mongo-java-driver](https://github.com/mongodb/mongo-java-driver)** — Native Java driver for MongoDB.
- **[spring-projects/spring-data-mongodb](https://github.com/spring-projects/spring-data-mongodb)** — Lớp bọc của Spring cho MongoDB (Tương tự Spring Data JPA).

---

## 🏷️ Framework Annotations & Dependencies

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-mongodb</artifactId>
</dependency>
```

---

## 📐 System Design Blueprint

### 1. Data Modeling: Bài toán E-Commerce

**A. Bad Modeling (Cố gắng copy Relational Model vào MongoDB)**
```json
// Collection: User
{ "_id": 1, "name": "John" }

// Collection: Address (Lỗi: Mỗi user có 2-3 địa chỉ, tại sao phải tách ra Collection riêng?)
{ "_id": 100, "user_id": 1, "street": "123 Main St" }
```

**B. Good Modeling (Embedding cho Dữ liệu Quan hệ 1-Few)**
```json
// Collection: User
{
  "_id": "usr-1",
  "name": "John Doe",
  "addresses": [
    { "type": "HOME", "street": "123 Main St", "zip": "10001" },
    { "type": "WORK", "street": "456 Office Rd", "zip": "20002" }
  ]
}
```

**C. Good Modeling (Referencing cho Quan hệ 1-Many Lớn)**
*(Ví dụ: 1 User có thể viết 1,000,000 comments. Không thể embed 1 triệu comments vào User Document vì sẽ nổ 16MB).*
```json
// Collection: Post
{ "_id": "post-1", "title": "Mongo vs Postgres" }

// Collection: Comment
{
  "_id": "cmt-1",
  "post_id": "post-1", // Referencing
  "text": "Great article!",
  "author": { "user_id": "usr-1", "name": "John Doe" } // Extended Referencing (Embed thông tin tối thiểu để không cần JOIN sang User)
}
```

### 2. Spring Data MongoDB Implementation

```java
// ═══════════════════════════════════════════════════
// 1. DOCUMENTS (Entities)
// ═══════════════════════════════════════════════════

@Document(collection = "products")
@TypeAlias("Product") // Quan trọng: Rút gọn class name lưu trong trường _class của MongoDB
@Getter
@Setter
public class Product {
    
    @Id
    private String id;
    
    @Indexed(unique = true)
    private String sku;
    
    @TextIndexed // Cho phép Full-Text Search
    private String name;
    
    // Embedding: Không cần tạo Collection riêng cho Attributes
    private Map<String, String> attributes = new HashMap<>(); 
    
    // Version dùng cho Optimistic Locking (chống Lost Updates)
    @Version 
    private Long version;
}

// ═══════════════════════════════════════════════════
// 2. REPOSITORY & TRANSACTIONS
// ═══════════════════════════════════════════════════

@Repository
public interface ProductRepository extends MongoRepository<Product, String> {
    
    // Spring Data tự sinh Query
    List<Product> findByAttributes_Color(String color);
}

@Service
@RequiredArgsConstructor
public class InventoryService {

    private final ProductRepository productRepo;
    private final LogRepository logRepo;

    /**
     * Giao dịch (Transaction) trong MongoDB.
     * Lưu ý: Yêu cầu MongoDB phải chạy ở chế độ Replica Set (Kể cả chạy local 1 node).
     */
    @Transactional
    public void updateStockWithAudit(String productId, int newQuantity) {
        Product p = productRepo.findById(productId).orElseThrow();
        p.getAttributes().put("stock", String.valueOf(newQuantity));
        productRepo.save(p);
        
        // Ghi Log sang Collection khác. Cả 2 thao tác sẽ Commit hoặc Rollback cùng nhau!
        logRepo.save(new AuditLog("UPDATE_STOCK", productId));
    }
}

// ═══════════════════════════════════════════════════
// 3. CONFIGURATION (Bật Transaction Manager)
// ═══════════════════════════════════════════════════

@Configuration
public class MongoConfig {
    @Bean
    MongoTransactionManager transactionManager(MongoDatabaseFactory dbFactory) {
        // Bắt buộc phải có Bean này thì @Transactional của Spring mới hoạt động với MongoDB
        return new MongoTransactionManager(dbFactory);
    }
}
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Extended Reference Pattern**: Thay vì tham chiếu (`user_id = 1`) và phải `$lookup` sang bảng User để lấy `name`, hãy nhúng sẵn dữ liệu ít thay đổi (`{ user_id: 1, name: "John" }`) ngay vào Document đó. Nếu `name` đổi, kệ nó (vì trên Comment hiển thị tên cũ cũng không sao, hoặc chạy một background job update sau).
2. **Kích hoạt Replica Set ở Môi trường Dev**: Mặc định Docker `mongo` chạy ở Standalone. Standalone KHÔNG HỖ TRỢ Transactions. Bạn phải chạy lệnh `rs.initiate()` lúc khởi động container để bật Replica Set 1-node.
3. **Loại bỏ cột `_class` nếu không dùng Polymorphism**: Spring Data MongoDB tự chèn một cột `_class` (tên class Java) vào mọi Document để Deserialize. Nếu bảng 100 triệu dòng, cái chuỗi này tốn vài GB vô ích. Cấu hình tắt nó đi nếu bạn chỉ dùng 1 class DTO cố định.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Mảng không giới hạn (Unbounded Arrays) | Ví dụ: Mảng `logs[]` nhúng trong User. Mảng này sẽ to lên theo thời gian. Khi Document vượt 16MB, app crash. Ngoài ra, mỗi lần mảng phình to, Mongo phải dời Document ra chỗ khác trên RAM/Đĩa -> Phân mảnh (Fragmentation). | Dùng Referencing cho Data M-N lớn. Outlier pattern: Nhúng 100 log mới nhất, log cũ tách sang collection `user_logs`. |
| Cố chấp dùng `$lookup` everywhere | MongoDB hỗ trợ `$lookup` (JOIN) nhưng nó rất tốn RAM và chậm. Nếu query nào cũng `$lookup` 3-4 bảng, hãy dùng PostgreSQL! | Sửa lại Data Model (Dùng Embedding / Denormalization). |
| Bỏ qua Indexing vì nghĩ Mongo tự động tối ưu | Scan một Collection 10 triệu Document (COLLSCAN) trên Mongo tệ y như Full Table Scan trên SQL. CPU sẽ 100%. | Luôn chạy `db.collection.explain()` và tạo Index trên các cột tìm kiếm. Dùng `@Indexed`. |
