# 🛡️ Security Scanning (Trivy) & Code Quality (SonarQube)

> **Category**: CI/CD Pipelines | **Complexity**: Intermediate | **DevSecOps**

---

## 📖 Core Technical Mechanics & Deep-Dive

### DevSecOps là gì?
Trước đây, Bảo mật (Security) là khâu cuối cùng. App code xong, deploy lên Staging, rồi nhờ team Security tới "đánh phá" (Pentest). Ra cả đống lỗi thì đập đi làm lại.
**DevSecOps** dời bước Security lên **sớm nhất có thể (Shift-Left)**. Quét bảo mật tự động ngay khi lập trình viên vừa Push code lên Git. Nếu phát hiện lỗ hổng nghiêm trọng (Critical), Pipeline tự động ĐÁNH TỚT (Fail), không cho phép Merge vào nhánh `main`.

### Hai lớp khiên bảo vệ trong CI
1. **SAST (Static Application Security Testing) với SonarQube**: Đọc Source Code (Java) của bạn, tìm các lỗi ngớ ngẩn như: Quên đóng kết nối DB, biến không sử dụng, hoặc nối chuỗi SQL bằng tay (SQL Injection).
2. **Container Security với Trivy**: Đọc file `Dockerfile` và Image sau khi build. Tìm xem Hệ điều hành (Base image như Alpine, Ubuntu) hoặc thư viện (như Log4j) bên trong có lỗ hổng CVE nào đã công bố không. Nếu có lỗ hổng điểm số 9.0+, Trivy chặn ngay lập tức.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[aquasecurity/trivy](https://github.com/aquasecurity/trivy)** — Scanner mã nguồn mở toàn diện nhất cho Container.
- **[SonarSource/sonarqube](https://github.com/SonarSource/sonarqube)** — Công cụ phân tích chất lượng code (Code Smells, Bugs, Vulnerabilities).

---

## 📐 System Design Blueprint & Setup Guide

### 1. Tích hợp SonarQube vào Spring Boot (Qua Maven)

**Cách 1: Sử dụng SonarCloud (SaaS miễn phí cho Open Source)**
Bạn chỉ cần lấy Token từ SonarCloud và chạy trực tiếp lệnh Maven trong CI:

```yaml
# Thêm vào Job CI của Github Actions (Sau bước mvn clean test)
- name: 🔍 SonarQube Scan
  env:
    SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
  run: ./mvnw sonar:sonar -Dsonar.projectKey=my-company_my-app -Dsonar.host.url=https://sonarcloud.io
```

**Cách 2: Tự Host SonarQube Server (Docker Compose)**
```yaml
services:
  sonarqube:
    image: sonarqube:lts-community
    ports:
      - "9000:9000"
    environment:
      - SONAR_JDBC_URL=jdbc:postgresql://db:5432/sonar
      - SONAR_JDBC_USERNAME=sonar
      - SONAR_JDBC_PASSWORD=sonar
```

### 2. Tích hợp Aqua Trivy vào Github Actions

Bạn phải build xong Docker Image thì mới quét được. Đây là đoạn code chèn ngay sau bước `docker build`.

```yaml
    - name: 📦 Build Docker Image (Local)
      run: docker build -t my-app:latest .

    - name: 🛡️ Run Trivy Vulnerability Scanner
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: 'my-app:latest'
        format: 'table'
        # Chỉ quét các lỗ hổng có mức độ NGHIÊM TRỌNG và CAO
        severity: 'CRITICAL,HIGH'
        # NẾU CÓ LỖI: Trả về exit code 1 -> Đánh rớt (Fail) toàn bộ Pipeline! Không cho Deploy.
        exit-code: 1
        ignore-unfixed: true # Bỏ qua các lỗ hổng mà thế giới chưa có bản vá
```

---

## 🧪 Phân tích Kết quả (Troubleshooting)

### Khi Trivy đánh rớt Pipeline vì thư viện lỗi
Ví dụ: Trivy quét thấy bạn đang dùng bản Spring Boot có nhúng thư viện `log4j-core:2.14.1` (Dính lỗ hổng Log4Shell cực kỳ nguy hiểm CVE-2021-44228).
**Cách sửa**: 
1. Vào `pom.xml`, nâng cấp phiên bản Spring Boot lên bản mới nhất.
2. Hoặc cấu hình Maven `<dependencyManagement>` để ép (force) thư viện `log4j-core` lên bản `2.17.1`.
3. Push lại code. Trivy quét sạch -> Pass.

### Khi SonarQube phàn nàn về "Code Smell"
Ví dụ: Sonar báo `Define a constant instead of duplicating this literal "Hello" 3 times`.
**Ý nghĩa**: Bạn lặp lại chuỗi chữ "Hello" quá nhiều lần trong code. 
**Cách sửa**: Khai báo biến `private static final String HELLO_MSG = "Hello";` và dùng lại. Mục tiêu là giúp code Clean hơn, dễ bảo trì hơn.

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Thiết lập Quality Gate trên Sonar**: Bạn hãy vào màn hình Admin của SonarQube, đặt luật: "Chỉ cho phép code qua vòng (Pass) nếu Code Coverage (Tỉ lệ viết Unit Test) > 80%". Đứa nào làm biếng không viết Test, CI báo đỏ, trưởng nhóm không duyệt Merge Request!
2. **Quét Secret Leakage (Rò rỉ khóa bảo mật)**: Đôi khi Dev buồn ngủ commit luôn cái AWS Secret Key lên Git. Trivy có chức năng quét Secret. Nó phát hiện key AWS lộ ra, nó sẽ khóa commit đó ngay lập tức.
3. **Cập nhật Base Image liên tục**: Lỗ hổng OS (Ubuntu/Alpine) xuất hiện hàng ngày. Cấu hình Dependabot hoặc Renovate tự động mở Pull Request nâng cấp phiên bản `eclipse-temurin:21-jre-alpine` khi có bản vá mới.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Quét rác (False Positives) làm phiền Developer | Trivy báo có 1 lỗ hổng "Medium" trong gói `curl` của hệ điều hành. Cơ mà app Java của bạn chả bao giờ gọi lệnh `curl`. Dev thấy Pipeline suốt ngày đỏ một cách vô lý sẽ bực mình và TẮT LUÔN Trivy. | Đặt cờ `severity: 'CRITICAL,HIGH'` và `ignore-unfixed: true`. Chỉ chặn những cái thực sự nguy hiểm. |
| SonarQube quét luôn cả thư mục Gen code (Ví dụ MapStruct/QueryDSL) | Hàng nghìn file `.java` do thư viện tự sinh ra bị Sonar soi lỗi Code Smell, làm nhiễu kết quả. | Thêm `<sonar.exclusions>**/generated-sources/**, **/target/**</sonar.exclusions>` vào `pom.xml` để bỏ qua. |
| Chạy Security Scan ở bước Deploy (CD) thay vì bước Build (CI) | Đã mất 10 phút build ra Image, push lên Docker Hub (nơi chứa đầy mã độc chờ người tải), đến lúc deploy mới quét ra lỗi thì quá muộn! | **Shift-Left**: Quét ngay ở bước Code/Build (Pull Request). Chưa sạch thì tuyệt đối không tạo Image. |
