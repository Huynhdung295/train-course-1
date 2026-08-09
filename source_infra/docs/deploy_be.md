# HƯỚNG DẪN TRIỂN KHAI BACKEND TỪ A-Z (BACKEND DEPLOYMENT GUIDE)

**Môi trường:** Production (Kubernetes)
**Điều kiện tiên quyết:** Server K8s, Docker Registry, Helm v3.

---

## BƯỚC 1: XÂY DỰNG DOCKER IMAGE
Toàn bộ dự án Backend Java (Spring Boot) phải được đóng gói vào Docker Image.
Tệp `Dockerfile` của BE đã được tối ưu hóa Multi-stage build (Dùng JRE nhẹ, gỡ bỏ JDK build-time).

```bash
# 1. Đứng tại thư mục gốc của Backend
cd source/

# 2. Build và Tag Image (Ví dụ version 1.0.0)
docker build -t registry.nexus.com/backend-api:1.0.0 .

# 3. Đẩy (Push) Image lên Private Registry
docker push registry.nexus.com/backend-api:1.0.0
```

---

## BƯỚC 2: CẤU HÌNH BIẾN MÔI TRƯỜNG (K8S SECRETS)
Tuyệt đối không đẩy Password Database lên Git. Sử dụng Kubernetes Secrets.

```bash
# Tạo Secret cho Database và Keycloak
kubectl create secret generic backend-secrets   --from-literal=DB_PASSWORD='siêu_mật_khẩu_123'   --from-literal=KEYCLOAK_SECRET='secret_abc'   -n production
```

---

## BƯỚC 3: CẬP NHẬT HELM CHART
Sửa file `kubernetes/backend/values.yaml` trong thư mục `source_infra`:

```yaml
image:
  repository: registry.nexus.com/backend-api
  tag: "1.0.0"

resources:
  requests:
    memory: "1Gi"
    cpu: "500m"
  limits:
    memory: "2Gi"
    cpu: "1000m"

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 75
```

---

## BƯỚC 4: THỰC THI TRIỂN KHAI (DEPLOY)
Áp dụng (Apply) Helm Chart vào cụm Kubernetes.

```bash
# Đứng tại thư mục source_infra
helm upgrade --install backend-api ./kubernetes/backend -n production -f ./kubernetes/backend/values.yaml
```

---

## BƯỚC 5: KIỂM TRA SỨC KHỎE (HEALTH CHECK & ROLLBACK)

1. **Theo dõi trạng thái Pods:**
```bash
kubectl get pods -n production -l app=backend-api -w
```
*(Chờ đến khi tất cả Pods đều ở trạng thái `Running` và `1/1 Ready`)*

2. **Xem Logs theo thời gian thực:**
```bash
kubectl logs -f deployment/backend-api -n production
```

3. **Rollback khẩn cấp (Nếu có lỗi):**
Nếu hệ thống sập (Lỗi 500 do code sai), quay về bản cũ ngay lập tức:
```bash
helm rollback backend-api 1 -n production
```

---
**TIPS CHO DEVOPS:** Luôn chạy `helm diff` trước khi `helm upgrade` để biết chính xác những thay đổi nào sẽ được áp dụng vào K8s.
