# ⚖️ Resource Limits, Requests & QoS trong K8s

> **Category**: Kubernetes Orchestration | **Complexity**: Advanced | **Java**: 21+ | **K8s**: 1.25+

---

## 📖 Core Technical Mechanics & Deep-Dive

### Bài toán cái máy gặt lúa trên K8s
Bạn có 1 Server (Node) K8s 16GB RAM. Bạn deploy 10 cái Pod (Microservices) lên đó. K8s ném cả 10 cái Pod vào 1 Node. Mọi thứ chạy rất mượt.
Đột nhiên có đợt Sale, App số 1 nhận quá nhiều traffic. Nó liên tục ngốn RAM, từ 1GB -> 5GB -> 15GB RAM! 
Hậu quả: 9 cái App còn lại bị chèn ép, không còn RAM để chạy. Hệ điều hành Linux trên Node kích hoạt **OOM Killer** và lôi 1 trong 9 cái app kia ra giết một cách ngẫu nhiên. App 1 gây họa nhưng App 2 chết! (Hiệu ứng láng giềng ồn ào - Noisy Neighbor).

### Giải pháp: Requests và Limits
Kubernetes bắt buộc bạn phải ký "Hợp đồng cấp phát tài nguyên" cho từng Pod:
1. **Requests (Nhu cầu tối thiểu)**: *"Để tôi khởi động được, K8s BẮT BUỘC phải tìm cho tôi 1 Node đang còn trống ít nhất 1GB RAM và 0.5 CPU. Nếu không Node nào còn chỗ, đừng tạo tôi, hãy để tôi ở trạng thái Pending"*.
2. **Limits (Trần tối đa)**: *"K8s ơi, nếu tôi có lỡ ăn quá 2GB RAM, anh hãy giết thẳng tay tôi đi (OOMKilled), đừng để tôi làm ảnh hưởng các Node khác"*.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[Kubernetes Docs: Manage Resources](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)** — Khái niệm Requests/Limits chuẩn.
- **[Kubernetes Docs: Quality of Service](https://kubernetes.io/docs/tasks/configure-pod-container/quality-service-pod/)** — QoS Classes (Guaranteed, Burstable, BestEffort).

---

## 📐 System Design Blueprint & Setup Guide

### 1. Phân bổ tài nguyên chuẩn cho Java Spring Boot

```yaml
# Nằm trong deployment.yaml
          resources:
            requests:
              # JVM cần ít nhất 256MB để khởi động (Metaspace, Stack, Heap...)
              memory: "512Mi"
              # 0.5 Core CPU (Thích hợp cho 1 con App ít dùng)
              cpu: "500m" 
            limits:
              # CỰC KỲ QUAN TRỌNG: 
              # Nếu set Memory Limit là 1GB. Thì JVM (MaxRAMPercentage=75%) sẽ tự hiểu Heap tối đa là 750MB.
              # Nếu JVM vượt quá 750MB, JVM sẽ tự ném ra OutOfMemoryError.
              # Nhưng nếu App bạn dùng C++ Native memory rò rỉ vượt qua 1024Mi, K8s sẽ nhảy vào báo lỗi OOMKilled.
              memory: "1024Mi"
              
              # LIMIT CPU: Gây tranh cãi lớn! 
              # Ở K8s, nếu App cố xài quá Limit CPU, K8s KHÔNG giết nó, mà K8s sẽ bóp nghẹt nó (CPU Throttling).
              # App sẽ chạy siêu chậm. Nhiều chuyên gia khuyên KHÔNG NÊN đặt limit CPU.
              cpu: "1000m" # (Tương đương 1 Core)
```

### 2. Các nhóm chất lượng dịch vụ (QoS Classes)

Dựa vào cách bạn thiết lập Request và Limit, K8s sẽ ngầm định gán 1 "đẳng cấp" (QoS Class) cho Pod của bạn. Đẳng cấp này quyết định việc Pod nào sẽ bị "thí mạng" (Evict) khi Server lỡ hết RAM vật lý.

| Tên QoS | Điều kiện cấu hình | Mức độ ưu tiên khi K8s cạn RAM |
|---------|--------------------|--------------------------------|
| **Guaranteed** (VIP) | `Requests` BẰNG CHÍNH XÁC `Limits` cho cả CPU và RAM. | Không bao giờ bị K8s giết (trừ khi nó tự xài vượt giới hạn của chính nó). **Dùng cho Database hoặc Core Services.** |
| **Burstable** (Bình dân) | Có set `Requests` và `Limits`, nhưng `Limits` > `Requests`. (Cho phép bung lụa xài thêm RAM nếu Node còn dư). | Bị K8s giết NẾU như Server hết RAM và có 1 Pod VIP (Guaranteed) cần dùng. **Dùng cho Web API thông thường.** |
| **BestEffort** (Đáy XH) | Hoàn toàn không cấu hình `Requests` và `Limits` (Quên cấu hình). | K8s sẽ lôi bọn này ra giết ĐẦU TIÊN để cứu Server! Đừng bao giờ deploy lên K8s Prod mà không cấu hình Limit! |

---

## 🧪 Công thức Tuning cho Java 21 trên K8s

Để một ứng dụng Spring Boot chạy trơn tru, đây là công thức cấu hình phối hợp giữa K8s Limits và JVM Flags:

**Ví dụ bài toán**: K8s cấp Limit RAM là 1GB (`1024Mi`).

1. **Kubernetes Limit**:
   - `resources.limits.memory: "1024Mi"`
2. **Kubernetes Request**:
   - `resources.requests.memory: "768Mi"` (Thường để bằng 70-100% của Limit. Giúp Scheduler sắp xếp Node chuẩn xác).
3. **Môi trường JVM (JAVA_OPTS)**:
   - `-XX:MaxRAMPercentage=75.0` (75% của 1GB = 768MB làm Max Heap).
   - `-XX:InitialRAMPercentage=50.0`
   - `-XX:+UseG1GC`
   - Kích hoạt CDS (Bắt buộc để tiết kiệm Metaspace).

*25% RAM còn lại (256MB) là "vùng đệm an toàn" để JVM chứa Non-Heap (Thread Stack, Metaspace, GC Data) và cho HĐH Alpine Linux.*

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Thiết lập QoS Guaranteed cho Ingress Controller**: Nginx Ingress là trái tim của cụm. Nếu nó chết, nguyên cụm K8s rớt mạng. Bắt buộc phải set Request CPU = Limit CPU và Request RAM = Limit RAM.
2. **Bỏ CPU Limits (Tùy chọn nâng cao)**: Các kỹ sư của Zalando đã chứng minh rằng: Đặt CPU Limits gây ra hiện tượng CPU Throttling vô lý, làm chậm App Java đi 2-3 lần (Đặc biệt lúc khởi động cần CPU cực cao). Trừ phi K8s của bạn chia sẻ cho nhiều team thù địch, trên Prod hãy cân nhắc việc BỎ Limit CPU, chỉ đặt Request CPU. (Chỉ áp dụng với CPU, **RAM BẮT BUỘC PHẢI CÓ LIMIT**).

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Request RAM cực lớn cho an toàn (Ví dụ Request 4GB, Limit 4GB) cho mọi Service | Server Node có 16GB RAM. K8s xếp được đúng 4 cái Pod là nó báo "Node Full", không cho deploy thêm. Dẫu cho 4 cái App này chỉ xài thật sự có 200MB! (Lãng phí tài nguyên điên rồ). | Dùng Prometheus check xem App thực sự xài bao nhiêu RAM (Working Set Memory). Thường set Request cao hơn số thực xài 20% là đẹp. Limit thì cao hơn 50%. |
| Hardcode `-Xmx` thay vì `MaxRAMPercentage` trong Container | Dev set cứng `-Xmx2G` trong file `compose.yml`. Nhưng lên K8s Prod, ông DevOps lại set `limits.memory: "1Gi"`. App bật lên, xin 2GB Heap, nhưng Container chỉ có 1GB -> K8s bắn chết tươi App (OOMKilled) trước khi nó kịp boot xong. | Không bao giờ xài `-Xmx` ở thế giới Docker/K8s. Luôn dùng cờ phần trăm `MaxRAMPercentage`. K8s cấp bao nhiêu, JVM tự động điều chỉnh ăn bấy nhiêu. |
