# HƯỚNG DẪN TRIỂN KHAI FRONTEND TỪ A-Z (FRONTEND DEPLOYMENT GUIDE)

**Môi trường:** Production (Kubernetes + Cloudflare)
**Công nghệ:** Next.js App Router (Node.js Server)

---

## BƯỚC 1: XÂY DỰNG DOCKER IMAGE
Khác với ứng dụng React SPA (chỉ cần Nginx tĩnh), Next.js sử dụng Server-Side Rendering (SSR) nên bắt buộc phải chạy Node.js runtime trong container.

```bash
# 1. Chuyển vào thư mục Frontend
cd source_fe/

# 2. Build Image bằng chế độ Standalone (Đã được cấu hình trong next.config.js)
docker build -t registry.nexus.com/frontend-web:1.0.0 .

# 3. Push Image
docker push registry.nexus.com/frontend-web:1.0.0
```

---

## BƯỚC 2: CẤU HÌNH CONFIGMAP (BIẾN MÔI TRƯỜNG NEXT.JS)
Next.js cần biết URL của Backend nội bộ (SSR) và URL công khai (Client Fetch).

Tạo tệp `frontend-config.yaml`:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: frontend-config
  namespace: production
data:
  NEXT_PUBLIC_API_URL: "https://api.nexus.com"
  INTERNAL_API_URL: "http://backend-api.production.svc.cluster.local:8080" # Gọi nội bộ K8s cực nhanh
```
Apply vào K8s: `kubectl apply -f frontend-config.yaml`

---

## BƯỚC 3: CẬP NHẬT HELM CHART
Sửa file `kubernetes/frontend/values.yaml` trong thư mục `source_infra`:

```yaml
image:
  repository: registry.nexus.com/frontend-web
  tag: "1.0.0"

# Bật Ingress để định tuyến Traffic từ Internet vào Pod
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
  hosts:
    - host: "*.nexus.com" # Bắt mọi Subdomain khách hàng
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: nexus-wildcard-tls
      hosts:
        - "*.nexus.com"
```

---

## BƯỚC 4: THỰC THI TRIỂN KHAI (DEPLOY)
Áp dụng Helm Chart:

```bash
# Đứng tại thư mục source_infra
helm upgrade --install frontend-web ./kubernetes/frontend -n production -f ./kubernetes/frontend/values.yaml
```

---

## BƯỚC 5: CLEAR CACHE CDN (CLOUDFLARE)
Bởi vì Next.js tạo ra các file Static (CSS/JS) được cache cực mạnh trên Cloudflare CDN. Sau khi Deploy code mới, phải gọi API xóa cache CDN để khách hàng không bị dính giao diện cũ.

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/purge_cache"      -H "Authorization: Bearer YOUR_CLOUDFLARE_TOKEN"      -H "Content-Type: application/json"      --data '{"purge_everything":true}'
```

---
**TIPS CHO DEVOPS:** Đối với đợt Sale lớn, hãy chỉnh `minReplicas` của Frontend lên 20 Pods trước sự kiện 1 tiếng để đón luồng truy cập khổng lồ.
