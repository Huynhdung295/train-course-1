# ☸️ Kubernetes (K8s) & Spring Boot Helm Charts

> **Category**: Kubernetes Orchestration | **Complexity**: Expert | **K8s**: 1.25+ | **Helm**: 3.x

---

## 📖 Core Technical Mechanics & Deep-Dive

### Từ Docker Compose lên Kubernetes
Docker Compose rất tuyệt vời cho 1 Server. Nhưng nếu bạn có 10 Servers (Nodes) và muốn App tự động scale từ 3 lên 30 bản sao khi có sự kiện siêu sale, hoặc tự động khởi động lại App ở Server B khi Server A bị rút điện, bạn cần **Kubernetes (K8s)** - Bộ điều phối Container.

Một Ứng dụng Spring Boot cơ bản trên K8s cần tối thiểu 3 tài nguyên (Resources):
1. **Deployment**: Định nghĩa Image, số lượng Replicas, RAM/CPU.
2. **Service**: Đóng vai trò như Load Balancer nội bộ tĩnh (Internal IP). Các App khác gọi thông qua Service Name.
3. **Ingress**: Mở cổng ra mạng Internet ngoài (Domain Name, SSL).

### Nỗi đau của YAML (Manifests)
Nếu bạn viết chay 3 file YAML trên cho môi trường Dev. Khi sang Staging/Prod, bạn phải Copy-Paste 3 file đó và tìm-thay-thế các biến (như URL DB, số Replicas) bằng tay. Rất dễ sai sót và dài dòng.

### Giải pháp: Helm (The Package Manager for K8s)
Helm giống như `apt` hay `brew` nhưng dành cho Kubernetes.
Thay vì cấu hình tĩnh, Helm tạo ra một **Chart (Bản mẫu - Template)** chứa các file YAML với các biến động `{{ .Values.replicaCount }}`.
Khi deploy, bạn chỉ cần nạp 1 file `values-prod.yaml` cực kỳ ngắn gọn, Helm sẽ tự động render (điền) nó vào Template và phóng lên K8s.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[helm/helm](https://github.com/helm/helm)** — Trình quản lý gói chuẩn công nghiệp cho K8s.
- **[bitnami/charts](https://github.com/bitnami/charts)** — Kho tàng các Helm Charts chuẩn mực nhất (Dùng để tham khảo cách viết Helm).

---

## 📐 System Design Blueprint & Setup Guide

### 1. Cấu trúc của một Spring Boot Helm Chart

Chạy lệnh `helm create my-spring-app` để tạo khung. Cấu trúc sẽ như sau:
```text
my-spring-app/
├── Chart.yaml          # Thông tin metadata (Tên app, version)
├── values.yaml         # File chứa GIÁ TRỊ MẶC ĐỊNH (Dev Environment)
└── templates/
    ├── deployment.yaml # Khung Deployment
    ├── service.yaml    # Khung Service
    ├── ingress.yaml    # Khung Ingress
    └── _helpers.tpl    # Các hàm tái sử dụng
```

### 2. Tùy biến `deployment.yaml` cho Spring Boot

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "my-spring-app.fullname" . }}
spec:
  replicas: {{ .Values.replicaCount }} # Lấy từ file values.yaml
  selector:
    matchLabels:
      {{- include "my-spring-app.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "my-spring-app.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: 8080
              protocol: TCP
          
          # Truyền Biến môi trường động vào Spring Boot
          env:
            - name: SPRING_PROFILES_ACTIVE
              value: {{ .Values.spring.profile | quote }}
            - name: DB_HOST
              value: {{ .Values.database.host | quote }}
              
          # Giới hạn tài nguyên (Tránh OOM)
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
```

### 3. File `values.yaml` (Môi trường mặc định - Dev)

```yaml
replicaCount: 1

image:
  repository: my-registry/my-spring-app
  tag: "latest"
  pullPolicy: Always

spring:
  profile: "dev"

database:
  host: "postgres-dev.internal"

resources:
  limits:
    memory: "512Mi"
    cpu: "500m"
  requests:
    memory: "256Mi"
    cpu: "100m"
```

### 4. File `values-prod.yaml` (Môi trường Production)

File này chỉ định nghĩa (Ghi đè) những thứ khác biệt so với Dev!

```yaml
replicaCount: 3

spring:
  profile: "prod"

database:
  host: "postgres-prod.internal"

resources:
  limits:
    memory: "2Gi"
    cpu: "2000m"
  requests:
    memory: "1Gi"
    cpu: "1000m"
```

---

## 🧪 Verification Commands

```bash
# 1. Render nháp (Dry Run) để xem các file YAML cuối cùng trông như thế nào trước khi đẩy lên K8s
helm template my-spring-app ./my-spring-app -f ./my-spring-app/values-prod.yaml

# 2. Cài đặt (Deploy) lần đầu lên K8s
helm install my-app-release ./my-spring-app -f ./my-spring-app/values-prod.yaml

# 3. Cập nhật (Upgrade) khi có Code/Image mới
# (Được gọi tự động từ Github Actions)
helm upgrade my-app-release ./my-spring-app \
  --set image.tag=v1.2.3 \
  -f ./my-spring-app/values-prod.yaml

# 4. Quay xe (Rollback) siêu tốc nếu lỗi 
helm rollback my-app-release 1 # Quay về revision số 1
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Quản lý Release bằng CI/CD**: Việc gõ `helm upgrade` bằng tay trên máy DevOps là một sai lầm. Hãy để Github Actions đảm nhiệm bằng công cụ như ArgoCD (GitOps) hoặc chạy lệnh trực tiếp trong Pipeline.
2. **Phiên bản hóa Chart**: Khi bạn đổi khung của Chart (ví dụ đổi cấu trúc `deployment.yaml`), hãy nâng version của Chart lên trong file `Chart.yaml`. (Đừng nhầm lẫn version của Chart với version của Docker Image App).

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Lưu Mật khẩu (Secret) cứng vào file `values-prod.yaml` | Cả công ty đều có thể đọc được Git Repo, mật khẩu Production lộ hoàn toàn. | Các biến như `DB_PASSWORD` phải được gắn vào bằng Kubernetes Secret hoặc HashiCorp Vault. (Sẽ học ở Bài 04). |
| Viết YAML cứng trong Helm Chart | Tạo Helm chart nhưng không chịu dùng biến `{{ .Values... }}`, mọi thông số ghi cứng. Làm mất đi toàn bộ sức mạnh tái sử dụng của Helm. | Cố gắng Parametrize (tham số hóa) mọi thông số có khả năng thay đổi giữa các môi trường. |
| Dùng `imagePullPolicy: Always` trên Production | Nếu Docker Hub hoặc Network bị lỗi trong 5 phút, K8s không thể Scale Pod mới vì nó cứ cố gọi lên mạng để kéo Image (dù Image đã có sẵn trong máy). Gây gián đoạn dịch vụ. | Ở Prod, LUÔN LUÔN set tag phiên bản cụ thể (`v1.2.3`) và dùng `imagePullPolicy: IfNotPresent`. Chỉ dùng `Always` ở môi trường Dev (với tag `latest`). |
