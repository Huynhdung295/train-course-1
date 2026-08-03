# 🚨 Alerting & Incident Management (PagerDuty)

> **Category**: Observability | **Complexity**: Intermediate | **Alertmanager** / **PagerDuty**

---

## 📖 Core Technical Mechanics & Deep-Dive

### Dashboards rất đẹp, nhưng vô dụng nếu bạn đang ngủ!
Bạn đã cài xong Grafana. Biểu đồ nhảy múa rất đẹp. Nhưng lỗi server (Out of Memory, Crash) thường xảy ra vào lúc 3h sáng - giờ mà traffic của hacker hoặc cronjobs chạy nền lớn nhất. 
Một kỹ sư không thể dán mắt vào màn hình Grafana 24/7. Bạn cần một hệ thống báo động (Alerting System):
1. **Phát hiện (Detect)**: Prometheus tự động nhận ra CPU VPS đang ở mức 95% liên tục trong 5 phút.
2. **Xử lý tiếng ồn (Alertmanager)**: Nếu 10 con VPS cùng sập, Prometheus sẽ bắn ra 10 cái lỗi cùng lúc. Alertmanager sẽ gộp (Group) 10 lỗi đó lại thành 1 tin nhắn duy nhất báo là "Cụm K8s Sập" (để khỏi spam điện thoại bạn).
3. **Gọi dậy (PagerDuty / Opsgenie / Slack)**: Gửi tin nhắn vào Slack của công ty. Nếu lỗi Cấp cứu (Critical), hệ thống sẽ TỰ ĐỘNG GỌI ĐIỆN THOẠI (Call Phone) réo gọi DevOps đang trực đêm dậy bật máy tính.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[prometheus/alertmanager](https://github.com/prometheus/alertmanager)** — Công cụ định tuyến cảnh báo của hệ sinh thái Prometheus.
- **PagerDuty** — Nền tảng Incident Management phổ biến nhất (SaaS).

---

## 📐 System Design Blueprint & Setup Guide

### 1. Viết Luật Cảnh báo (Alert Rules) trên Prometheus

Trong file cấu hình của Prometheus, bạn nạp các file rules vào. Dưới đây là 3 luật "Kinh điển" phải có:

```yaml
# alert_rules.yml
groups:
- name: VPS_Hardware_Alerts
  rules:
  # 1. Báo động khi Máy chủ sập (Mất kết nối)
  - alert: InstanceDown
    expr: up == 0
    for: 1m  # Đợi 1 phút (lỡ rớt mạng tạm thời) mới báo, tránh spam
    labels:
      severity: critical # Mức độ: Khẩn cấp (Gọi điện)
    annotations:
      summary: "Instance {{ $labels.instance }} down"
      description: "{{ $labels.instance }} của job {{ $labels.job }} đã sập được hơn 1 phút."

  # 2. Báo động khi RAM sắp hết
  - alert: HighMemoryUsage
    expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100 > 90
    for: 5m
    labels:
      severity: warning # Mức độ: Cảnh báo (Nhắn Slack)
    annotations:
      summary: "Host Out of Memory (instance {{ $labels.instance }})"
      description: "RAM của Node đã xài hơn 90%."

- name: App_Service_Alerts
  rules:
  # 3. Báo động khi App Java chết hoặc CrashLoop (Trên K8s/Docker)
  - alert: HighErrorRate
    # Tỉ lệ lỗi 5xx trên tổng số Request > 5% trong 5 phút qua
    expr: sum(rate(http_server_requests_seconds_count{status=~"5.."}[5m])) / sum(rate(http_server_requests_seconds_count[5m])) * 100 > 5
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Dịch vụ {{ $labels.application }} có tỷ lệ lỗi 500 quá cao!"
```

### 2. Định tuyến bằng Alertmanager (`alertmanager.yml`)

Prometheus phát hiện lỗi sẽ đẩy qua Alertmanager. Alertmanager sẽ quyết định gửi đi đâu (Slack hay Gọi điện).

```yaml
route:
  group_by: ['alertname', 'severity'] # Gom nhóm theo Tên Lỗi và Độ nghiêm trọng
  group_wait: 30s                     # Chờ 30s xem có thêm lỗi nào giống vậy không thì gom luôn
  group_interval: 5m                  # Các tin nhắn cập nhật sẽ gửi cách nhau 5 phút
  repeat_interval: 1h                 # Nếu lỗi chưa ai sửa, 1 tiếng sau réo lại!

  # Route mặc định (Dành cho Lỗi Warning)
  receiver: 'slack-warning'
  
  routes:
  # Lỗi Critical -> Gọi PagerDuty gọi điện réo kĩ sư
  - match:
      severity: critical
    receiver: 'pagerduty-critical'

receivers:
- name: 'slack-warning'
  slack_configs:
  - api_url: '<YOUR_SLACK_WEBHOOK_URL>'
    channel: '#alerts-devops'
    title: '[{{ .Status | toUpper }}] {{ .GroupLabels.alertname }}'
    text: >-
      {{ range .Alerts }}
        *Description:* {{ .Annotations.description }}
      {{ end }}

- name: 'pagerduty-critical'
  pagerduty_configs:
  # Lấy key này từ tài khoản PagerDuty của công ty
  - service_key: 'YOUR_PAGERDUTY_INTEGRATION_KEY'
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Lịch Trực (On-Call Schedule)**: Setup PagerDuty có lịch luân phiên. Ví dụ: Tuần này John trực. Tuần sau Mary trực đêm. Nếu 3h sáng gọi John mà John không bắt máy trong 5 phút (Không bấm Acknowledge), PagerDuty sẽ tự động leo thang (Escalation) gọi điện thẳng cho Giám đốc Kỹ thuật (CTO). Việc này đảm bảo hệ thống không bao giờ bị bỏ mặc.
2. **Sổ tay xử lý sự cố (Runbooks)**: Khi nhắn tin cảnh báo vào Slack, luôn kèm theo một đường Link URL trỏ tới `Runbook`. (Ví dụ: Một tài liệu Notion ghi rõ "Nếu gặp lỗi này, hãy SSH vào server X, chạy lệnh Y để xóa Cache"). Giúp người kỹ sư đang bị ngái ngủ lúc 3h sáng không cần phải suy nghĩ, cứ copy paste là cứu được server.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Quá nhạy cảm (Alert Fatigue) | Bạn set báo động CPU > 70% gọi điện. Thực tế CPU thi thoảng vọt lên 75% 1 giây rồi xuống. Điện thoại reo 50 lần 1 đêm. Hậu quả: Hội chứng "Cậu bé chăn cừu", kỹ sư mệt mỏi và BẬT CHẾ ĐỘ MÁY BAY khi ngủ. Lúc Server chết thật sự thì không ai biết. | Tuyệt đối tuân thủ tham số `for: 5m`. CPU phải nghẽn LIÊN TỤC 5 phút mới báo động. Các lỗi không nghiêm trọng (Disk 70%) chỉ nhắn Slack, không bao giờ gửi SMS/Gọi điện. |
| Không Alert khi hết ổ cứng (Disk Full) | Lỗi kinh điển nhất của mọi hệ thống. Ổ cứng đầy 100%, Database không thể lưu data, Kafka không chạy được, Server tắt ngúm không ssh vào nổi. | Bắt buộc phải có Rule báo khẩn cấp khi `node_filesystem_avail_bytes < 10%`. |
| Cài Alertmanager chung VPS với Ứng dụng | Server bị sập nguồn (Rút điện). Alertmanager cũng chết theo. Chả ai nhắn tin cho bạn báo là Server sập! | Hệ thống giám sát (Monitoring/Alerting) nên được cài ở một Server vật lý ĐỘC LẬP hoặc đặt ở một DataCenter / Cloud khác hoàn toàn so với Cụm Production. |
