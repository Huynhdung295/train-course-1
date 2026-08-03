# 🚀 CI/CD Pipelines (GitHub Actions / GitLab CI)

> **Category**: CI/CD Pipelines | **Complexity**: Intermediate | **GitHub Actions** / **GitLab CI**

---

## 📖 Core Technical Mechanics & Deep-Dive

### CI (Continuous Integration)
Tích hợp liên tục. Đảm bảo rằng khi nhiều Developers cùng code (Merge vào nhánh `main`), code mới không làm hỏng code cũ.
Quy trình chuẩn CI:
1. **Checkout Code**: Lấy code từ Git.
2. **Setup Environment**: Cài Java 21, Maven.
3. **Compile & Unit Test**: Chạy `mvn clean test`. Báo đỏ (Fail) ngay lập tức nếu 1 test case bị sai.
4. **Code Quality**: Phân tích bằng SonarQube (Xem độ phủ Test Coverage, Code Smells).
5. **Build Artifact**: Đóng gói thành Docker Image.

### CD (Continuous Deployment / Delivery)
Triển khai liên tục. Sau khi CI Pass và Image đã sẵn sàng, tự động đưa Image đó lên môi trường Staging (hoặc Production).
Quy trình chuẩn CD:
1. **Push Image**: Đẩy Docker Image lên Registry (Docker Hub, AWS ECR, GitHub GHCR).
2. **Connect to Server**: Dùng SSH Key kết nối vào VPS (Hoặc dùng Kubeconfig nối vào K8s).
3. **Deploy**: Chạy lệnh `docker compose pull && docker compose up -d` (hoặc `helm upgrade`).

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[actions/setup-java](https://github.com/actions/setup-java)** — Action chuẩn để cấu hình Java, tự động cache Maven `~/.m2`.
- **[appleboy/ssh-action](https://github.com/appleboy/ssh-action)** — Action chuẩn để kết nối SSH vào VPS chạy lệnh Deploy.

---

## 📐 System Design Blueprint & Setup Guide

### Mẫu 1: GitHub Actions Pipeline (Toàn tập từ Build đến Deploy VPS)

Tạo file `.github/workflows/ci-cd.yml` trong dự án của bạn.

```yaml
name: Java CI/CD to VPS

on:
  push:
    branches: [ "main" ] # Chạy khi có push hoặc merge vào nhánh main
  pull_request:
    branches: [ "main" ] # Hoặc khi có PR tạo vào nhánh main (Chỉ chạy CI)

# Định nghĩa các biến toàn cục (Để đổi tên Image cho dễ)
env:
  DOCKER_IMAGE: my-company/backend-api

jobs:
  # ==========================================
  # JOB 1: CONTINUOUS INTEGRATION (Build & Test)
  # ==========================================
  build:
    runs-on: ubuntu-latest
    steps:
    - name: 📥 Checkout repository
      uses: actions/checkout@v4

    - name: ☕ Set up JDK 21
      uses: actions/setup-java@v4
      with:
        java-version: '21'
        distribution: 'temurin'
        # TÍNH NĂNG THẦN THÁNH: Tự động cache thư mục ~/.m2
        # Giúp giảm thời gian tải thư viện từ 2 phút xuống 2 giây!
        cache: maven 

    - name: 🔨 Build and Test with Maven
      # Bỏ qua Testcontainers nếu môi trường CI chưa cấu hình đủ Docker dind
      run: ./mvnw clean package -B -V

    - name: 🐳 Log in to Docker Hub
      # Bỏ qua bước này nếu là Pull Request (Không push Image chưa duyệt lên Registry)
      if: github.event_name != 'pull_request' 
      uses: docker/login-action@v3
      with:
        username: ${{ secrets.DOCKERHUB_USERNAME }}
        password: ${{ secrets.DOCKERHUB_TOKEN }}

    - name: 📦 Build and push Docker Image
      if: github.event_name != 'pull_request'
      uses: docker/build-push-action@v5
      with:
        context: .
        push: true
        # Gắn 2 tag: latest và SHA của commit hiện tại
        tags: |
          ${{ env.DOCKER_IMAGE }}:latest
          ${{ env.DOCKER_IMAGE }}:${{ github.sha }}

  # ==========================================
  # JOB 2: CONTINUOUS DEPLOYMENT (Push to VPS)
  # ==========================================
  deploy:
    # Chỉ chạy Job này nếu Job 'build' đã thành công VÀ đây là nhánh main
    needs: build
    if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    steps:
    - name: 🚀 Deploy to VPS via SSH
      uses: appleboy/ssh-action@v1.0.3
      with:
        host: ${{ secrets.VPS_HOST }}
        username: ${{ secrets.VPS_USERNAME }} # (Ví dụ: deployer)
        key: ${{ secrets.VPS_SSH_KEY }}
        script: |
          cd /opt/myapp
          # Kéo Image mới nhất về
          docker compose pull
          # Cập nhật Image tag trong file .env (Để compose đọc)
          echo "APP_VERSION=${{ github.sha }}" > .env
          # Khởi động lại App (Re-create)
          docker compose up -d backend-api
          # Dọn dẹp rác Docker Image cũ
          docker image prune -f
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Dùng GitHub/GitLab Secrets**: Các biến nhạy cảm như Mật khẩu DB, Token DockerHub, Khóa SSH phải được lưu trong phần *Settings > Secrets* của Github. Tuyệt đối không hard-code vào file YAML.
2. **Sử dụng SHA Commit làm Version Image**: Đừng bao giờ luôn luôn đẩy lên với tag `latest`. Nếu Image bị lỗi ở Prod, bạn gõ lệnh Rollback về Image trước, Docker sẽ mếu mặt vì nó không biết Image trước là gì (Cả 2 đều tên là `latest`). Nếu bạn tag theo `github.sha` (Ví dụ `my-api:a1b2c3d`), rollback cực kỳ an toàn!
3. **Cài đặt Timeout cho Pipeline**: Một lỗi cấu hình (Ví dụ chờ Database connection) có thể làm Pipeline bị treo vô tận. Github Actions tính tiền theo số phút chạy. Hãy set `timeout-minutes: 15` ở đầu Job.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Mọi Push lên nhánh nào cũng Build & Push Docker Image | Bạn có 5 dev, mỗi người push 10 lần một ngày lên nhánh `feature/xyz`. Bạn sẽ phải build và lưu 50 Docker Image vô dụng lên Docker Hub mỗi ngày. Nhanh chóng bị tính phí lưu trữ. | Chỉ Build Docker Image (Và Deploy) khi code được push vào nhánh `main` (hoặc `staging`). Các nhánh feature chỉ được phép chạy Unit Test (CI). |
| Lưu file SSH Key dạng Private (`id_rsa`) chung vào source code Git | Đưa chìa khóa nhà cho tất cả mọi người trên mạng. Bất cứ ai có quyền read repo đều có thể SSH vào chọc phá Database Production. | Chỉ thêm public key `id_rsa.pub` lên server VPS (file `authorized_keys`). Còn Private key phải lưu vào Secret Manager của Github Actions. |
| Không Cache Maven Dependencies | Mỗi lần CI chạy, Maven lại lọ mọ tải 500MB thư viện Spring Boot từ mạng về. Quá trình CI kéo dài từ 1 phút thành 10 phút. | Sử dụng `actions/setup-java` với tham số `cache: maven` hoặc `actions/cache` để lưu thư mục `~/.m2` lại sau mỗi lần chạy. |
