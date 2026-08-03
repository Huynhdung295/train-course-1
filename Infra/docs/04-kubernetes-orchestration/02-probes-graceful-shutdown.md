# 📡 Liveness/Readiness Probes & Graceful Shutdown

> **Category**: Kubernetes Orchestration | **Complexity**: Advanced | **Spring Boot**: 3.x | **K8s**: 1.25+

---

## 📖 Core Technical Mechanics & Deep-Dive

### Bạn không thể tin tưởng 100% vào Process Status
Khi Kubernetes bật một Container (Pod) lên, hệ điều hành Linux báo `PID 123 is RUNNING`. K8s tưởng app đã chạy ngon nên lập tức đẩy 1000 request người dùng vào.
**Nhưng Spring Boot là một "cỗ máy nặng nề"**:
- Dù process Java đã bật, nhưng Tomcat vẫn chưa start xong.
- Hibernate vẫn đang rớt mồ hôi khởi tạo Connection Pool với Database.
- Kết quả: Toàn bộ 1000 người dùng nhận lỗi `502 Bad Gateway` (Connection Refused).

Tương tự khi tắt Pod (Khi deploy bản mới). K8s gửi lệnh `SIGTERM` (giết process). Nếu Spring Boot chết ngay lập tức, 500 khách hàng đang thanh toán giở giang sẽ bị mất tiền oan!

### Giải pháp
1. **Startup / Readiness Probe**: Bảo K8s *"Hãy đợi tí, khi nào tôi báo OK thì hẵng đưa khách hàng vào"*.
2. **Liveness Probe**: Bảo K8s *"Tôi bị Deadlock (treo) rồi, dẫu process vẫn còn chạy, hãy giết tôi và tạo tôi lại từ đầu đi"*.
3. **Graceful Shutdown**: Bảo K8s *"Đợi tôi hoàn thành nốt 500 cái đơn hàng đang dở dang này (tối đa 30s) rồi hẵng giết tôi"*.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[Spring Boot Actuator: K8s Probes](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html#actuator.endpoints.kubernetes-probes)** — Tài liệu chính thức về cách Spring Actuator sinh ra Endpoint cho K8s.

---

## 📐 System Design Blueprint & Setup Guide

### 1. Cấu hình phía Spring Boot (application.yml)

Spring Boot Actuator có sẵn tính năng này, không cần code thêm bất cứ Java class nào!

```yaml
# Bật Actuator Endpoints
management:
  endpoint:
    health:
      probes:
        # Tự động sinh ra 2 API: /actuator/health/liveness và /actuator/health/readiness
        enabled: true 
  health:
    livenessstate:
      enabled: true
    readinessstate:
      enabled: true

# Bật Graceful Shutdown
server:
  shutdown: graceful # (Mặc định là IMMEDIATE - Chết ngay lập tức)

spring:
  lifecycle:
    # Báo K8s cho tôi 30 giây để hoàn thành nốt các request dở dang trước khi chết hẳn
    timeout-per-shutdown-phase: 30s 
```

### 2. Cấu hình phía Kubernetes (deployment.yaml)

```yaml
# Nằm bên dưới thuộc tính containers:
          ports:
            - name: http
              containerPort: 8080
          
          # 1. STARTUP PROBE (K8s 1.16+)
          # Dành cho các App Java siêu chậm. K8s sẽ check cái này trước. 
          # K8s check 30 lần, mỗi lần cách nhau 10s (Tối đa chờ 5 phút).
          # Nếu App vẫn không lên, K8s sẽ Kill nó.
          startupProbe:
            httpGet:
              path: /actuator/health/liveness
              port: 8080
            failureThreshold: 30
            periodSeconds: 10

          # 2. READINESS PROBE
          # "Tôi đã kết nối được DB chưa? Đã sẵn sàng nhận request chưa?"
          # Nếu API này trả về 503 (Fail), K8s sẽ rút tên Pod ra khỏi LoadBalancer, KHÔNG GỬI TRAFFIC VÀO NỮA.
          # Nhưng nó không giết Pod, chỉ chờ Pod hồi phục.
          readinessProbe:
            httpGet:
              path: /actuator/health/readiness
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 3

          # 3. LIVENESS PROBE
          # "Tôi còn sống không hay bị treo/deadlock rồi?"
          # Nếu API này trả về 503 (Fail) 3 lần, K8s sẽ RÚT ỐNG THỞ (Kill) và Restart lại Pod.
          livenessProbe:
            httpGet:
              path: /actuator/health/liveness
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 10
            failureThreshold: 3

          # 4. CHU KỲ SỐNG (LIFECYCLE) CHO GRACEFUL SHUTDOWN
          lifecycle:
            preStop:
              exec:
                # K8s gửi lệnh dừng, Nginx rút traffic ra, nhưng có thể mất vài giây bảng định tuyến mới cập nhật toàn cụm K8s.
                # Lệnh sleep này giúp Spring Boot có thời gian xử lý mượt mà.
                command: ["sh", "-c", "sleep 10"]
```

---

## 🧪 Quá trình Graceful Shutdown diễn ra như thế nào?

1. K8s quyết định tắt Pod cũ (Vì bạn Deploy bản mới). K8s chỉnh trạng thái thành `Terminating`.
2. K8s rút Pod đó ra khỏi Service/Endpoints (Load Balancer). Không khách hàng MỚI nào được gửi vào đây nữa.
3. Đồng thời, K8s gọi lệnh `preStop` (sleep 10s).
4. Đồng thời, K8s bắn cờ `SIGTERM` vào Container.
5. Spring Boot nhận cờ `SIGTERM`. Do cài `server.shutdown=graceful`, Tomcat ngừng nhận kết nối mới (Reject connection).
6. Spring Boot kiên nhẫn đợi các Thread cũ chạy nốt công việc của nó.
7. Xong việc (hoặc hết 30s timeout định trước), Spring Boot tự tắt. Nếu nó lỳ lợm không tắt sau 30s (`terminationGracePeriodSeconds` của K8s), K8s sẽ bắn cờ `SIGKILL` bóp cổ chết tươi ngay lập tức.

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Phân biệt rạch ròi Liveness và Readiness**: 
   - `Liveness`: Chỉ kiểm tra Ứng dụng của chính mình (Memory có tràn không? Thread có bị treo không?). **KHÔNG KIỂM TRA Database!**
   - `Readiness`: Kiểm tra Ứng dụng VÀ Kết nối ra bên ngoài (Database, Redis, Kafka đã sẵn sàng chưa?).

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Liveness Probe đi kiểm tra Database | Lỡ Database rớt mạng 5 giây. Liveness báo Fail. K8s tưởng App treo nên lôi App ra giết! App restart lại vẫn không thấy DB lại chết tiếp (CrashLoopBackOff). Kéo theo sự sập toàn hệ thống! | Mặc định Spring Boot Actuator cực kỳ khôn ngoan. API `/liveness` tự động bỏ qua DB. Chỉ API `/readiness` mới kiểm tra DB. Đừng tự ý viết lại logic này. |
| Quên thiết lập `terminationGracePeriodSeconds` lớn hơn `timeout-per-shutdown-phase` | Bạn báo Spring Boot chờ 30s. Nhưng K8s mặc định chỉ chờ 30s (tổng cả thời gian sleep). Chưa kịp làm xong K8s đã gửi SIGKILL. | Đảm bảo `terminationGracePeriodSeconds` (Trong K8s) = `timeout-per-shutdown-phase` (Của Java) + `sleep time` (Của preStop). (Ví dụ 30 + 10 = 40s). |
| Không dùng Startup Probe cho App nặng | Java boot mất 60s. Nhưng Liveness định kỳ check sau 10s. Liveness thấy App mãi không lên -> Liveness giết App. App restart lại từ đầu. Vòng lặp tử thần (OOM / Timeout / Crash loop). | BẮT BUỘC dùng `startupProbe` để chặn mồm Liveness lại cho đến khi App khởi động xong lần đầu tiên. |
