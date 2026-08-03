# 📜 Centralized Logging (Grafana Loki)

> **Category**: Observability | **Complexity**: Intermediate | **Promtail** / **Grafana Loki**

---

## 📖 Core Technical Mechanics & Deep-Dive

### The "SSH and Grep" Nightmare
Bạn có 5 con VPS chạy 5 cái Service. Một khách hàng báo lỗi không đặt được hàng (Bug).
- **Trở về thời đồ đá**: Mở 5 cái Terminal, SSH vào từng con VPS. Tìm file `spring-boot.log`. Gõ `grep "OrderFailedException" /var/log/spring-boot.log`. Lặp lại cho đến khi tìm ra lỗi. (Rất cực khổ và chậm chạp).
- **Tệ hơn (Môi trường Docker/K8s)**: Container bị chết (CrashLoopBackOff), K8s xóa luôn Container đó đi để tạo cái mới. Toàn bộ file log trong Container cũ bay hơi 100%. Không còn vết tích nào để debug!

### Giải pháp: Gom Log tập trung (Centralized Logging)
Thay vì lưu log trên đĩa cứng của từng máy ảo, ta dùng một **Đặc vụ (Agent)** chạy trên từng máy. Cứ có dòng log nào mới in ra (Console hoặc File), Agent sẽ chụp lại và gửi mạng qua một **Máy chủ Log Tập Trung**.

Hai hệ sinh thái nổi tiếng nhất:
1. **ELK Stack (Elasticsearch, Logstash, Kibana)**: Nặng nề, tốn hàng chục GB RAM, khó cấu hình, lưu trữ toàn văn bản tốn kém. (Enterprise lớn dùng).
2. **PLG Stack (Promtail, Loki, Grafana)**: Hàng "cây nhà lá vườn" của Grafana. **Siêu nhẹ, siêu rẻ**. Loki không index nội dung dòng log, nó chỉ index nhãn (Labels). Do đó tốc độ ghi log cực kỳ nhanh và tốn rất ít CPU/RAM. Cực kỳ phù hợp cho Microservices/K8s.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[grafana/loki](https://github.com/grafana/loki)** — Hệ thống gom log giống Prometheus nhưng dành cho Log.

---

## 📐 System Design Blueprint & Setup Guide (PLG Stack)

### Kiến trúc PLG
- **P (Promtail)**: Cài trên các máy con (VPS). Đọc file `/var/log/*` và gửi lên Loki.
- **L (Loki)**: Cài trên máy chủ trung tâm. Nhận log, nén lại, lưu xuống đĩa cứng (hoặc AWS S3).
- **G (Grafana)**: Cài trên máy chủ trung tâm. Giao diện để gõ câu lệnh tìm kiếm (LogQL).

### 1. Cấu hình Máy Chủ Trung Tâm (Loki + Grafana)

```yaml
# docker-compose-loki.yml
services:
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    command: -config.file=/etc/loki/local-config.yaml
    volumes:
      - ./loki-data:/loki

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
```

### 2. Cấu hình Máy Con / App (Promtail)

```yaml
# Cài đặt Agent Promtail trên từng con VPS
services:
  promtail:
    image: grafana/promtail:latest
    volumes:
      # Promtail cần đọc socket của Docker để tự động hốt toàn bộ log của tất cả các Container đang chạy!
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./promtail-config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml
```

**Cấu hình `promtail-config.yml`**:
```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml # Đánh dấu dòng log đã đọc (Để lỡ rớt mạng, đọc tiếp không bị trùng)

clients:
  - url: http://IP_MAY_CHU_LOKI:3100/loki/api/v1/push

scrape_configs:
# TỰ ĐỘNG ĐỌC LOG CỦA MỌI DOCKER CONTAINER
- job_name: docker
  docker_sd_configs:
    - host: unix:///var/run/docker.sock
      refresh_interval: 5s
  relabel_configs:
    - source_labels: ['__meta_docker_container_name']
      regex: '/(.*)'
      target_label: 'container'
```

### 3. Tìm Log bằng LogQL (Trên Grafana)

Thay vì gõ lệnh `grep`, bạn lên web Grafana, chọn Explore, chọn Datasource là Loki và gõ:

```logql
# 1. Tìm tất cả log của Container có tên 'order-service'
{container="order-service"}

# 2. Tìm log của order-service mà dòng log đó chứa chữ "Exception"
{container="order-service"} |= "Exception"

# 3. Lọc nâng cao: Đếm số lượng lỗi 500 xuất hiện mỗi 5 phút
sum by (container) (rate({container="order-service"} |= "HTTP/1.1\" 500" [5m]))
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **JSON Logging**: Thay vì Spring Boot in log ra dạng văn bản tự do (`2023-10-10 INFO --- [Thread-1] App started`), hãy dùng cấu hình Logback chuyển toàn bộ output sang định dạng JSON (`{"time":"...", "level":"INFO", "msg":"App started"}`). Việc này giúp Loki/ELK bóc tách thông tin cực nhanh mà không cần viết các biểu thức Regex (Grok) khổ sở.
2. **Correlation ID (Trace ID)**: Chữ P, L, G là chưa đủ. Bạn cần thư viện **Spring Cloud Sleuth / Micrometer Tracing**. Nó tự động gắn 1 chuỗi ngẫu nhiên (Ví dụ: `TraceId: a1b2c3d4`) vào đầu mọi dòng log của 1 lượt HTTP Request. Nếu Request đó lan truyền qua 3 Microservices, cả 3 sẽ in log với CÙNG 1 cái TraceID đó. Trên Grafana, bạn chỉ cần search `{container=~".*"} |= "a1b2c3d4"` là ra Toàn bộ vòng đời của cái Request rớt đó!

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| In log rác, log vô dụng ở môi trường Prod | Lập trình viên để lại dòng `System.out.println("Vào được hàm này rồi")` hoặc in cả cục Payload 10MB ra file log. Log phình to vài GB một ngày. Loki nén không kịp, nghẽn mạng nội bộ, sập ổ đĩa máy chủ Log. | Ở Production, LEVEL của Log BẮT BUỘC tối thiểu là `INFO` (Thậm chí là `WARN`). Tuyệt đối không bật `DEBUG`. Không in nguyên văn các API payload lớn. |
| Lưu Log ở Storage xịn đắt tiền | Log có giá trị cao nhất trong 7 ngày đầu. 1 tháng sau, nó chỉ là rác rưởi. Nếu bạn dùng SSD xịn (AWS EBS) để chứa DB của Loki, bạn sẽ nghèo rất nhanh. | Loki hỗ trợ đẩy trực tiếp Log cục (Chunks) lên **AWS S3 / Cloudflare R2 (Rẻ như cho)**. Hãy cấu hình Loki dùng Object Storage thay vì Local File System. Tốc độ query cũ (1 tháng) có thể chậm lại, nhưng tiết kiệm 90% chi phí. |
