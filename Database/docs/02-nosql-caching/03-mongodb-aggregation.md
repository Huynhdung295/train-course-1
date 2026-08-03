# 🧩 MongoDB Aggregation Pipeline

> **Category**: NoSQL & Caching | **Complexity**: Advanced | **MongoDB**: 6.x/7.x

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Aggregation Pipeline (Pipeline Xử lý dữ liệu)
Không giống như SQL (viết 1 câu SELECT dài hàng chục dòng với đủ thứ JOIN, GROUP BY, HAVING), MongoDB xử lý dữ liệu phức tạp thông qua **Aggregation Pipeline**.
- Dữ liệu chạy qua từng "Ống nước" (Stage) tuần tự.
- Output của Stage trước là Input của Stage sau.
- Dễ dàng Debug bằng cách comment/uncomment từng Stage để xem kết quả trung gian.

### Các Stages cốt lõi
1. **`$match`**: Lọc dữ liệu (Tương đương `WHERE` trong SQL). Luôn đặt `$match` ở đầu Pipeline để tận dụng Index!
2. **`$project`**: Chọn các field cần trả về (Tương đương `SELECT` trong SQL).
3. **`$group`**: Gộp dữ liệu và tính toán hàm tổng hợp (Tương đương `GROUP BY`, `SUM`, `AVG`).
4. **`$lookup`**: Nối với Collection khác (Tương đương `LEFT JOIN`).
5. **`$unwind`**: Tách một mảng thành nhiều Document riêng biệt (Cực kỳ quan trọng để Group các dữ liệu nằm trong mảng).

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[MongoDB Aggregation Reference](https://www.mongodb.com/docs/manual/reference/operator/aggregation-pipeline/)** — Tài liệu chính thức về cú pháp Pipeline.

---

## 📐 System Design Blueprint

### 1. Phân tích Dữ liệu phức tạp (Sử dụng MongoTemplate trong Java)

**Bài toán**: Trong Collection `orders` (chứa hàng triệu đơn hàng), mỗi đơn hàng có 1 mảng `items`. Hãy:
1. Lọc các đơn hàng trạng thái COMPLETED trong tháng 10.
2. Tách mảng `items` ra để đếm.
3. Nhóm theo ProductID để tính tổng số lượng bán ra và tổng doanh thu.
4. Sắp xếp doanh thu giảm dần.
5. Chỉ lấy top 5 sản phẩm.

```java
@Service
@RequiredArgsConstructor
public class AnalyticsService {

    // MongoTemplate cung cấp API cực mạnh để viết Aggregation thay vì Query Interface thông thường
    private final MongoTemplate mongoTemplate; 

    public List<ProductSalesDto> getTopSellingProducts(Instant start, Instant end) {
        
        // Stage 1: Lọc data càng sớm càng tốt (Sử dụng Index trên status và createdAt)
        MatchOperation match = Aggregation.match(
            Criteria.where("status").is("COMPLETED")
                    .and("createdAt").gte(start).lte(end)
        );

        // Stage 2: Tách mảng items ra. 
        // 1 Order có 3 items -> $unwind tạo ra 3 Documents riêng biệt để dễ group.
        UnwindOperation unwind = Aggregation.unwind("items");

        // Stage 3: Nhóm theo productId, tính SUM(quantity) và SUM(price * quantity)
        GroupOperation group = Aggregation.group("items.productId")
            .sum("items.quantity").as("totalQuantitySold")
            .sum(ArithmeticOperators.Multiply.valueOf("items.quantity").multiplyBy("items.price"))
            .as("totalRevenue");

        // Stage 4: Sắp xếp giảm dần theo doanh thu
        SortOperation sort = Aggregation.sort(Sort.Direction.DESC, "totalRevenue");

        // Stage 5: Lấy Top 5
        LimitOperation limit = Aggregation.limit(5);

        // Tạo Pipeline
        Aggregation aggregation = Aggregation.newAggregation(match, unwind, group, sort, limit);

        // Chạy Pipeline trên bảng "orders" và mapping kết quả ra DTO
        AggregationResults<ProductSalesDto> results = mongoTemplate.aggregate(
            aggregation, "orders", ProductSalesDto.class
        );

        return results.getMappedResults();
    }
}
```

### 2. Sử dụng `$lookup` (JOIN)

**Bài toán**: Lấy thông tin Order và gộp thêm thông tin User tương ứng.

```javascript
// Cú pháp Shell của MongoDB (Có thể dịch 1-1 ra MongoTemplate)
db.orders.aggregate([
  {
    $match: { status: "PENDING" }
  },
  {
    $lookup: {
      from: "users",            // Bảng cần join (Target)
      localField: "userId",     // Khóa ngoại trên bảng orders
      foreignField: "_id",      // Khóa chính trên bảng users
      as: "userDetails"         // Nhét kết quả vào 1 mảng tên là userDetails
    }
  },
  {
    $unwind: "$userDetails"     // Biến userDetails từ mảng 1 phần tử thành 1 object
  },
  {
    $project: {
      _id: 1,
      totalAmount: 1,
      "user.name": "$userDetails.name",
      "user.email": "$userDetails.email"
    }
  }
])
```

---

## 🧪 Verification Commands

```javascript
// Dùng Compass hoặc mongosh để chạy thử Pipeline
// Thay vì chạy .aggregate(), hãy gọi .explain() để xem MongoDB thi hành nó thế nào.

db.orders.aggregate([
  { $match: { status: "COMPLETED" } },
  { $group: { _id: "$customerId", total: { $sum: 1 } } }
]).explain("executionStats")

// Trong kết quả trả về, tìm xem Stage IXSCAN (Index Scan) có được sử dụng ở đầu Pipeline không.
// Nếu nó ghi COLLSCAN (Collection Scan), bạn thiếu Index ở trường 'status'!
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Luôn đặt `$match` lên trên cùng**. MongoDB chỉ có thể sử dụng Index cho các Stage nằm ở đầu Pipeline. Nếu bạn để `$unwind` hoặc `$project` lên trước `$match`, Mongo sẽ phải Load TOÀN BỘ database ra RAM rồi lọc -> CPU 100%.
2. **Dùng `$project` hoặc `$unset` sớm để giảm tải RAM**. Nếu 1 Document có 100 trường, nhưng bạn chỉ cần gộp (Group) theo 2 trường, hãy đặt `$project` để cắt bỏ 98 trường kia ngay trước stage `$group`. Mọi Document chui qua Pipeline đều nằm trên RAM!
3. **Giới hạn RAM của Aggregation là 100MB**. Nếu Stage `$group` hoặc `$sort` của bạn ăn quá 100MB RAM, Mongo sẽ ném lỗi. Nếu bạn chắc chắn cần chạy tác vụ khổng lồ đó, hãy truyền cờ `allowDiskUse: true` để Mongo mượn ổ cứng làm RAM tạm thời (Sẽ chạy chậm).

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Dùng Aggregation trong API thời gian thực (Trang chủ có 10,000 req/sec) | Aggregation là tác vụ On-The-Fly Computation, nó tốn nhiều CPU để tính toán lại mỗi lần gọi. | Tính toán trước! Chạy cronjob 5 phút/lần dùng Aggregation `$out` để xuất kết quả ra 1 Collection mới (ví dụ `daily_stats`). API chỉ việc `$match` từ `daily_stats`. |
| Cố gắng dùng `$lookup` liên hoàn | Việc nối 3-4 bảng (Collections) trong MongoDB bằng `$lookup` sẽ cực kỳ chậm vì Mongo thiết kế tối ưu cho Document đơn lẻ, không phải RDBMS. | Rút lại Data Model, nhúng (Embed) dữ liệu vào Document chính. |
| Quên `$unwind` mảng trước khi `$group` | Nếu bạn `$group` trực tiếp trên 1 trường mảng, Mongo sẽ xem toàn bộ cái mảng đó là 1 Object định danh duy nhất (Group by mảng). | Chạy `$unwind` trước để làm phẳng (Flatten) mảng thành các Document đơn. |
