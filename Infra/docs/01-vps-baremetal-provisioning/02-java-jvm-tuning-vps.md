# ☕ Java JVM Tuning cho môi trường giới hạn (VPS/Container)

> **Category**: VPS & Baremetal | **Complexity**: Expert | **Java**: 21+ | **Spring Boot**: 3.3+

---

## 📖 Core Technical Mechanics & Deep-Dive

### Nỗi đau "OOM Killer" (Out of Memory) trên VPS/Docker
Một developer build app Spring Boot chạy ở máy tính cá nhân 16GB RAM thấy rất mượt. Xong bê file `.jar` đó quăng lên con VPS 2GB RAM chạy lệnh `java -jar app.jar`.
Kết quả: Chạy được 5 phút, app tự nhiên SẬP, không để lại bất kỳ dòng log lỗi (Exception) nào trong Console!

**Nguyên nhân gốc rễ**: 
Mặc định, JVM không biết nó đang chạy trên máy 2GB. Nó tự xem xét phần cứng và có xu hướng đòi cấp phát RAM tối đa (Max Heap Size) bằng 1/4 tổng RAM của máy vật lý. Nhưng bộ nhớ Heap chưa phải là tất cả (JVM còn Metaspace, Code Cache, Thread Stacks...). Khi tổng bộ nhớ vật lý cạn kiệt, hệ điều hành Linux sẽ tung ra **OOM Killer** - Bắn chết tiến trình tốn RAM nhất (chính là cái app Java của bạn) để cứu OS. Vì OS bắn chết ở mức hệ điều hành (SIGKILL), Java không kịp vớt Exception để log ra.

### Container Awareness trong Java 21+
Rất may mắn, từ Java 11 trở đi (và cực kỳ hoàn thiện ở Java 21), JVM đã hỗ trợ cờ `UseContainerSupport` (bật mặc định). JVM giờ đây đã nhận biết được các giới hạn của cgroups (Docker/K8s) thay vì nhìn vào RAM của Host OS.

Tuy nhiên, bạn **BẮT BUỘC** phải chỉ định rõ giới hạn RAM, nếu không app vẫn nổ.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[Eclipse OpenJ9](https://github.com/eclipse-openj9/openj9)** — JVM siêu nhẹ, ăn ít RAM hơn HotSpot (Lựa chọn tốt cho microservices trên VPS nghèo nàn).
- **[ZGC / Shenandoah GC](https://openjdk.org/jeps/439)** — Các Garbage Collectors độ trễ cực thấp (Sub-millisecond) của thế hệ mới.

---

## 📐 System Design Blueprint

### 1. Công thức tính RAM an toàn cho Java

`Tổng RAM OS (Ví dụ 2GB) = HĐH (300MB) + Khác (200MB) + JVM Non-Heap (500MB) + JVM Heap (1GB)`

**Không bao giờ set Heap = Tổng RAM VPS!**

### 2. Các cờ khởi động chuẩn (JVM Flags) cho Java 21

```bash
java -server \
     # 1. Cấu hình RAM theo tỷ lệ % (Cách hiện đại nhất, tốt hơn -Xmx)
     -XX:MaxRAMPercentage=75.0 \     # Cho phép Heap chiếm 75% RAM của Container/Cgroups
     -XX:InitialRAMPercentage=50.0 \ # Lúc khởi động chiếm sẵn 50% RAM
     
     # 2. Cấu hình RAM Cố định (Cách truyền thống - Tốt nhất cho VPS baremetal)
     # -Xms1G -Xmx1G \               # Set cứng Max và Min Heap bằng nhau để tránh giật lag khi co giãn RAM
     
     # 3. Garbage Collector (Tối quan trọng)
     # Chọn 1 trong 3 GC sau tùy theo cấu hình VPS:
     # -XX:+UseZGC \                 # CHỈ DÙNG khi RAM >= 4GB (Độ trễ siêu thấp <1ms, không bao giờ Stop-The-World)
     # -XX:+UseG1GC \                # CHỈ DÙNG khi RAM từ 2GB - 4GB (Chuẩn mực Enterprise cân bằng nhất)
     -XX:+UseSerialGC \              # CHỈ DÙNG khi RAM < 1GB (Ví dụ VPS 512MB, hoặc app cực nhỏ)
     
     # 4. Tối ưu OOM Crash
     -XX:+CrashOnOutOfMemoryError \  # Khi bị Java OOM, hãy văng ra ngoài, ép Container restart lại (Tự phục hồi)
     -XX:+HeapDumpOnOutOfMemoryError \
     -XX:HeapDumpPath=/var/log/java_pid%p.hprof \ # Ghi lại file Dump để dev tải về phân tích xem rò rỉ bộ nhớ ở đâu
     
     # 5. Tối ưu cho Virtual Threads (Java 21)
     -Djdk.virtualThreadScheduler.parallelism=4 \ # Số luồng Carrier Threads (thường bằng số CPU core)
     
     # 6. File thực thi
     -jar target/my-spring-boot-app.jar
```

---

## 🧪 Phân tích sự cố (Troubleshooting)

### Nếu App liên tục bị OS OOM Killer "bắn chết"
Hãy tăng Swap trên Ubuntu (Ví dụ tạo file swap 2GB). Dù tốc độ sẽ siêu chậm do đọc đĩa, nhưng app sẽ **KHÔNG SẬP**. Từ đó bạn theo dõi xem bộ nhớ nào đang bị chiếm dụng.

```bash
# Lệnh tạo 2GB Swap file trên VPS Ubuntu
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Nếu App bị Java OOM (`java.lang.OutOfMemoryError`)
Nghĩa là Heap Size của bạn đầy. 
Tải file `*.hprof` (do cờ `-XX:+HeapDumpOnOutOfMemoryError` sinh ra) về máy cá nhân. Mở phần mềm **Eclipse MAT (Memory Analyzer Tool)** hoặc VisualVM để xem class nào (Ví dụ `List<Product>`) đang ăn hết hàng GB RAM mà không chịu giải phóng.

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Luôn sử dụng ZGC cho App lớn**: Trên Java 21, Generational ZGC là 1 kiệt tác nghệ thuật của Oracle. Nó có thể dọn rác hàng Terabyte RAM mà ứng dụng của bạn không bị đứng hình (Stop-The-World) quá 1 mili-giây. Dùng nó cho mọi VPS từ 4GB RAM trở lên.
2. **Kích hoạt CDS (Class Data Sharing)**: Spring Boot 3.3 hỗ trợ tính năng CDS ra khỏi hộp (Out-of-the-box). Nó tạo sẵn một tệp bộ đệm lưu trữ cấu trúc các class khi build. Khi run, Java đọc thẳng tệp đó. **Giúp App Spring Boot khởi động nhanh hơn 30-50% và tốn ít RAM (Metaspace) hơn.**

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Mở quá nhiều luồng (Threads) trong ThreadPool | Mỗi Platform Thread (luồng OS) chiếm 1MB RAM riêng lẻ cho Thread Stack. Mở 1000 Thread mất đứt 1GB RAM ngay lập tức. | Ở Java 21, chuyển sang dùng **Virtual Threads**. 1 triệu Virtual Threads chỉ tốn vài chục MB RAM. (Kích hoạt `spring.threads.virtual.enabled=true`). |
| Chạy `java -jar` không có cờ RAM (`-Xmx`) trên VPS 1GB | App sẽ crash ngẫu nhiên sau vài ngày do OOM Killer. | Bắt buộc phải gắn cờ JVM cho mọi môi trường Production, Staging, Dev. |
| Sử dụng `System.gc()` trong code Java | Code rác rưởi. Làm chậm toàn bộ hệ thống vì nó ép Stop-The-World một cách ép buộc, phá hỏng thuật toán tối ưu của ZGC/G1GC. | Dọn rác là việc của JVM, lập trình viên không bao giờ được phép gọi GC bằng tay. |
