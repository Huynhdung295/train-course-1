# 📦 Transactional Outbox Pattern (Database Level)

> **Category**: Data Streaming | **Complexity**: Expert | **Architecture**: Microservices, Event-Driven

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Problem: Dual-Write (Lỗi Ghi Kép)
Trong Microservices, một Use Case phổ biến là: "Lưu Đơn hàng vào Database, VÀ gửi Event lên Kafka để các Service khác biết".

**Anti-Pattern (Lỗi kinh điển của Dev mới):**
```java
@Transactional
public void createOrder() {
    // 1. Lưu DB
    orderRepo.save(newOrder); 
    // 2. Gửi Kafka
    kafkaTemplate.send("order-topic", newOrderEvent); 
}
```
**Tại sao nó sai?**
- Nếu bước 1 thành công, bước 2 gọi Kafka bị Timeout (rớt mạng). Giao dịch DB bị Rollback. NHƯNG Kafka không có rollback! Service khác đã nhận được event và xử lý một đơn hàng không tồn tại trong DB!
- Nếu bước 1 thành công, bước 2 thành công. Nhưng khi Spring commit transaction ở dòng cuối cùng thì DB bị rớt mạng -> Commit xịt. Kafka vẫn nhận được event. Lỗi y hệt trên.

### Giải pháp: Transactional Outbox Pattern
Ý tưởng cốt lõi: **Sử dụng chính tính chất ACID của Database để đảm bảo tính nhất quán.**
Thay vì gửi Kafka trực tiếp, ứng dụng lưu Event đó vào một bảng `outbox` ngay trong cùng 1 Transaction với bảng `orders`.
Vì cả 2 cùng nằm trong 1 DB, chúng sẽ CHẮC CHẮN cùng thành công hoặc cùng Rollback! (Atomicity).
Sau đó, một Background Worker (Debezium) sẽ đọc bảng `outbox` này và đẩy lên Kafka một cách bền bỉ (Dù mạng rớt, khi có lại nó sẽ đẩy tiếp, không bao giờ mất Event).

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[microservices-patterns (Chris Richardson)](https://microservices.io/patterns/data/transactional-outbox.html)** — Nguồn gốc tiêu chuẩn của mẫu thiết kế Outbox.
- **[debezium/debezium-examples/outbox](https://github.com/debezium/debezium-examples/tree/main/outbox)** — Hướng dẫn chuẩn của Debezium về Outbox Pattern.

---

## 📐 System Design Blueprint

### Kiến trúc Outbox Pattern

```mermaid
graph TD
    App[Order Service]
    
    subgraph "PostgreSQL (1 Transaction)"
        TableA[Table: orders]
        TableB[Table: outbox_events]
    end
    
    App -->|1. INSERT Order| TableA
    App -->|2. INSERT Event| TableB
    
    DBZ[Debezium CDC]
    DBZ -.->|3. Tail WAL (Only outbox_events)| TableB
    
    Kafka[Kafka Topic]
    DBZ -->|4. Publish Event| Kafka
```

---

## ⚙️ Production Implementation (Spring Boot + Postgres)

### 1. Database Schema

```sql
CREATE TABLE outbox_events (
    id UUID PRIMARY KEY,
    aggregate_type VARCHAR(255) NOT NULL, -- Tên Entity (VD: 'Order')
    aggregate_id VARCHAR(255) NOT NULL,   -- ID của Order (VD: '1001')
    event_type VARCHAR(255) NOT NULL,     -- Tên Sự kiện (VD: 'OrderCreated')
    payload JSONB NOT NULL,               -- Chứa Data chuẩn để gửi (Domain Event)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. Spring Boot Code (The Producer)

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepo;
    private final OutboxEventRepository outboxRepo;
    private final ObjectMapper objectMapper;

    @Transactional
    public void createOrder(CreateOrderRequest request) {
        
        // 1. Thực hiện Logic và Lưu Domain Entity
        Order order = new Order(request.getCustomerId(), request.getAmount());
        orderRepo.save(order);
        
        // 2. Tạo Payload cho Event (Chỉ public ra những field cần thiết, giấu các field nội bộ)
        OrderCreatedEvent payload = new OrderCreatedEvent(order.getId(), order.getAmount());
        
        // 3. Ghi vào bảng Outbox TRONG CÙNG 1 TRANSACTION
        OutboxEvent outboxEvent = OutboxEvent.builder()
            .id(UUID.randomUUID())
            .aggregateType("Order")
            .aggregateId(order.getId().toString())
            .eventType("OrderCreated")
            .payload(objectMapper.valueToTree(payload)) // Save as JSONB
            .build();
            
        outboxRepo.save(outboxEvent);
        
        // --- KẾT THÚC TRANSACTION ---
        // Nếu DB sập ở đây, cả Order và OutboxEvent đều biến mất (Không có rác).
        // Kafka chưa bao giờ bị ảnh hưởng.
    }
}
```

### 3. Cấu hình Debezium SMT (Single Message Transform)
Mặc định, Debezium gửi lên Kafka một cấu trúc JSON rất rườm rà (chứa before, after, metadata).
Nhưng với bảng `outbox`, chúng ta chỉ muốn lấy cục `payload` (JSONB) và nhét thẳng làm Value của Kafka Message, còn `aggregate_id` thì làm Kafka Key.
Debezium hỗ trợ **Outbox Event Router SMT** để làm việc này hoàn toàn tự động!

```json
{
  "name": "outbox-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "table.include.list": "public.outbox_events", // CHỈ THEO DÕI BẢNG NÀY
    
    // Sử dụng SMT để bóc tách Outbox Record
    "transforms": "outbox",
    "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
    
    // Cấu hình mapping cột DB với Message Kafka
    "transforms.outbox.route.topic.replacement": "domain.events.${routedByValue}",
    "transforms.outbox.table.field.event.id": "id",
    "transforms.outbox.table.field.event.key": "aggregate_id",
    "transforms.outbox.table.field.event.type": "event_type",
    "transforms.outbox.table.field.event.payload": "payload",
    
    "transforms.outbox.route.by.field": "aggregate_type"
    // Kết quả: Message sẽ được đẩy vào topic "domain.events.Order"
  }
}
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Dùng Message Router SMT**: Luôn cấu hình SMT của Debezium để bóc tách `payload`. Consumer của bạn sẽ không bao giờ cần biết sự tồn tại của Debezium, nó chỉ thấy một Kafka Message dạng JSON bình thường.
2. **Dọn rác (Garbage Collection)**: Bảng `outbox_events` sẽ phình to cực nhanh. Bạn **bắt buộc** phải có 1 cronjob chạy mỗi đêm: `DELETE FROM outbox_events WHERE created_at < NOW() - INTERVAL '7 days'`. Vì Debezium đọc WAL (bắt từ nguồn gốc lúc Insert), việc bạn Xóa dòng đó sau 7 ngày không ảnh hưởng gì tới Kafka.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Dùng Polling thay vì Debezium CDC | Viết 1 cronjob `@Scheduled` quét bảng `outbox_events` mỗi 1 giây để `SELECT` rồi `kafkaTemplate.send()`. Tốn tài nguyên CPU vô ích, delay cao (1s), và rất khó xử lý Cluster (nhiều Pod cùng quét bị đụng độ). | Dùng Debezium (Log-based CDC). Không tốn 1 giọt CPU nào của Database để query. |
| Expose Internal Entity thay vì Domain Event | Cấu hình Debezium theo dõi luôn bảng `orders` (Không dùng Outbox). Consumer sẽ nhận được Data phản chiếu 1-1 cấu trúc bảng Order (Ví dụ có thêm cột `hibernate_version`). Nếu bạn đổi tên cột ở DB, toàn bộ Consumer chết sạch. | Phải dùng Outbox Pattern để tạo ra ranh giới (Contract). Gửi đi `OrderCreatedEvent` là một Data Object độc lập với Entity. |
