# 📊 Metrics & Giám sát Hạ tầng (Prometheus/Grafana)

> **Category**: Observability | **Complexity**: Intermediate | **Prometheus Stack**

---

## 📖 Core Technical Mechanics & Deep-Dive

### Bạn không thể chữa bệnh nếu không khám bệnh
Một ngày đẹp trời, API của bạn tự nhiên chậm gấp 10 lần. Người dùng kêu la. Bạn SSH lên server, gõ `htop` thấy CPU 100%. Bạn chửi thầm rồi reboot server. Hôm sau nó lại 100% tiếp.
**Nếu không có Observability (Khả năng quan sát)**, bạn sẽ giống như một bác sĩ mù chữa bệnh.
Observability gồm 3 trụ cột (Three Pillars):
1. **Metrics (Số liệu đo lường)**: Trả lời câu hỏi *"Hệ thống đang tốn bao nhiêu RAM, CPU, tỷ lệ lỗi 500 là bao nhiêu?"*. (Chính là bài này).
2. **Logs (Nhật ký)**: Trả lời câu hỏi *"Lỗi 500 đó dòng Exception cụ thể là gì?"*. (Bài tiếp theo).
3. **Traces (Truy vết)**: Trả lời câu hỏi *"Request A đi qua Service 1, rồi xuống Service 2, rồi gọi Database, bước nào tốn thời gian nhất?"*. (Dùng OpenTelemetry/Jaeger - Tương đối nâng cao).

### Hệ sinh thái Prometheus
Prometheus là tiêu chuẩn đo lường (Metrics) của Cloud-Native. Cách hoạt động:
- **Pull Model (Kéo)**: Khác với các hệ thống cũ bắt App phải chủ động Đẩy (Push) số liệu lên máy chủ đo lường. Prometheus làm ngược lại: Nó tự động quét (Pull/Scrape) thông qua cổng HTTP của App mỗi 15 giây.
- Ứng dụng chỉ cần phơi ra 1 API dạng văn bản (Ví dụ `/metrics`), Prometheus sẽ đi thu thập. Nếu app sập, Prometheus tự động biết vì kéo không được.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[prometheus/node_exporter](https://github.com/prometheus/node_exporter)** — Tool chuyên lấy metrics phần cứng của OS (Linux).
- **[google/cadvisor](https://github.com/google/cadvisor)** — Tool chuyên lấy metrics của Docker Containers.
- **[micrometer-metrics/micrometer](https://github.com/micrometer-metrics/micrometer)** — Thư viện chuẩn trong Spring Boot để xuất Metrics cho Prometheus.

---

## 📐 System Design Blueprint & Setup Guide

### 1. Kiến trúc Giám sát 1 VPS (Docker Compose)

Khởi tạo cụm giám sát bao gồm Prometheus (Database chứa chuỗi thời gian) và Grafana (Vẽ biểu đồ giao diện đẹp).

```yaml
services:
  # 1. Thu thập dữ liệu phần cứng (OS Level: CPU, RAM, Disk I/O, Network)
  node-exporter:
    image: prom/node-exporter:latest
    ports:
      - "9100:9100"
    # Phải mount ổ đĩa / của host vào để nó đo được
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro

  # 2. Thu thập dữ liệu của từng Docker Container (App nào ăn bao nhiêu RAM?)
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    ports:
      - "8080:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:rw
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro

  # 3. Kẻ đi thu thập dữ liệu (Scraper)
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  # 4. Người vẽ biểu đồ
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
```

### 2. Cấu hình Scrape cho Prometheus (`prometheus.yml`)

Nói cho Prometheus biết phải đi kéo dữ liệu ở những đâu:

```yaml
global:
  scrape_interval: 15s # 15 giây kéo 1 lần

scrape_configs:
  - job_name: 'linux-vps-hardware'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'docker-containers'
    static_configs:
      - targets: ['cadvisor:8080']

  - job_name: 'spring-boot-app'
    metrics_path: '/actuator/prometheus' # Đường dẫn do Spring Boot sinh ra
    static_configs:
      - targets: ['backend-api:8081']
```

### 3. Cấu hình phía Spring Boot Application

Để Spring Boot xuất thông số cho Prometheus, bạn chỉ cần thêm thư viện và vài dòng properties (Không cần viết code).

**pom.xml:**
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

**application.yml:**
```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,prometheus # Phơi API này ra mạng
  metrics:
    tags:
      application: "my-order-service" # Gắn tag để trên Grafana dễ lọc
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Dùng Grafana Dashboards có sẵn**: Đừng tự thiết kế biểu đồ từ con số 0. Hãy lên trang `grafana.com/dashboards`, tìm ID `1860` (Cho Node Exporter) và `4701` (Cho Spring Boot JVM). Nhập ID đó vào Grafana của bạn là có ngay 1 cái Dashboard y như hệ thống NASA!
2. **Kéo dữ liệu (Scrape) nội bộ**: Đảm bảo cổng `9100`, `8080`, `9090` của các công cụ giám sát BỊ ĐÓNG BẰNG TƯỜNG LỬA (UFW) từ mạng ngoài. Các công cụ này không có mật khẩu bảo vệ mặc định. Prometheus tự kéo thông qua mạng LAN nội bộ (Docker Network) là đủ.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Lưu trữ Metrics quá lâu (Retention period) | Metrics sinh ra hàng Gigabytes mỗi ngày. Kéo dài 1 năm, ổ cứng VPS của bạn nổ tung. | Cấu hình Prometheus chỉ giữ lại Data trong 15 ngày (Đủ để debug sự cố gần nhất). Lệnh: `--storage.tsdb.retention.time=15d`. |
| Sinh Metric với Tag (Label) không giới hạn | Trong Spring Boot, bạn đo thời gian query DB bằng cách cho câu SQL vào Label (Tag). Khổ nỗi mỗi câu SQL chứa 1 ID user khác nhau -> Sinh ra hàng triệu cái Tag khác nhau. | "High Cardinality" (Đa dạng hóa nhãn cao) là nguyên nhân số 1 làm nổ tung RAM của Server Prometheus. Tag chỉ nên chứa các hằng số hữu hạn (Ví dụ: HTTP Status 200, 404, 500). KHÔNG dùng ID động làm Tag. |
| Coi Metrics là Logs | Cố gắng gắn thông tin Exception Class (Lỗi NullPointer) vào Prometheus. | Metric chỉ lưu số liệu đếm (Counters, Gauges, Histograms). Text dài (Error message) phải để ở Hệ thống Logging (Loki/ELK). |
