# 🛠️ Bộ Công Cụ (App & Extensions) Chuẩn Chuyên Gia 

> Tiêu chí: **Nhẹ - Nhanh - Tiện lợi - Chuẩn Công Nghiệp**. Máy tính cài đúng và đủ, không cài những phần mềm rác làm giật lag hệ thống. Phân loại chi tiết theo từng lĩnh vực.

---

## 1. 🎨 FE (Frontend)

Môi trường Frontend cần sự nhẹ nhàng, khởi động nhanh và hỗ trợ hệ sinh thái web cực tốt.

| Công cụ / App | Mô tả & Lý do chọn |
|---|---|
| **Visual Studio Code (VSCode)** | Bắt buộc cho Frontend. Siêu nhẹ, khởi động trong 1 giây, hỗ trợ TypeScript/React/Vue vô địch. Tuyệt đối không dùng WebStorm (vì tốn tiền và nặng). |
| **Brave / Chrome Browser** | Trình duyệt để debug. Nhớ cài thêm các extension **React DevTools** hoặc **Vue DevTools**. |

**🔥 Các Extensions VSCode nên có:**
- `Prettier - Code formatter`: Tự động format code khi lưu.
- `ESLint`: Soi lỗi cú pháp Javascript.
- `Tailwind CSS IntelliSense`: Gợi ý class cực nhanh nếu dùng Tailwind.

---

## 2. ⚙️ BE (Backend - Java Spring Boot)

Backend Java là một cỗ máy hạng nặng, cần một IDE đủ thông minh để tái cấu trúc (Refactor) và sinh code tự động.

| Công cụ / App | Mô tả & Lý do chọn |
|---|---|
| **IntelliJ IDEA** (Community/Ultimate) | Bắt buộc cho Java Enterprise. Đừng dùng VSCode để code Java, bạn sẽ hối hận vì nó thiếu rất nhiều công cụ mạnh mẽ. Dù hơi tốn RAM nhưng nó là "nồi cơm" của Backend Dev. |
| **Bruno** | Công cụ test REST API mới nổi. Cực nhẹ, offline 100%. Lưu cấu hình API dưới dạng file text (cực dễ đồng bộ lên Git). Hãy **xóa Postman** (giờ đã quá cồng kềnh và ép lên Cloud). |
| **Thunder Client** | Nếu lười cài Bruno, đây là 1 Extension nằm ngay trong VSCode. Gửi HTTP Request ngay bên cạnh code. |

**🔥 Các Extensions IntelliJ nên có:**
- `SonarLint`: Vừa gõ code vừa báo lỗi "Code Smell" (nhắc nhở viết code sạch).
- `Lombok`: Bắt buộc để generate Getter/Setter ẩn.

---

## 3. 🗄️ Database

Tuyệt đối **không cài đặt** MySQL Server, PostgreSQL Server hay Redis trực tiếp lên hệ điều hành Windows! Hãy chạy chúng thông qua Docker (Phần Infra). Bạn chỉ cần tải App dùng để Giao tiếp (Client) với CSDL.

| Công cụ / App | Mô tả & Lý do chọn |
|---|---|
| **TablePlus** | (Khuyên dùng số 1) Rất nhẹ, giao diện native cực mượt, không dùng Electron/Java nên không ngốn RAM. Chạy siêu nhanh, hỗ trợ mọi loại CSDL. |
| **DBeaver (Community)** | Hàng mã nguồn mở miễn phí 100%. Hơi tốn RAM hơn TablePlus một chút (vì viết bằng Java), nhưng tính năng thì vô địch (Import/Export data khổng lồ, vẽ biểu đồ ERD). |
| *DataGrip (JetBrains)* | Cực xịn nhưng rất nặng và tốn tiền. Nếu không có license thì bỏ qua. |

---

## 4. ☁️ Infra (Hạ tầng & Môi trường chạy)

Đây là nền tảng để bạn có thể chạy Database, giả lập môi trường Linux ngay trên Windows.

| Công cụ / App | Mô tả & Lý do chọn |
|---|---|
| **WSL 2 (Ubuntu)** | Môi trường Linux chuẩn chạy ngầm trên Windows. Bắt buộc phải có để chạy các lệnh terminal chuẩn DevOps. |
| **Windows Terminal** | App terminal của Microsoft Store. Giao diện cực đẹp, gom cả PowerShell, Command Prompt, và Ubuntu (WSL) vào các Tab khác nhau. |
| **Docker Desktop** | Bắt buộc phải có. Toàn bộ CSDL (Postgres, Redis) sẽ chạy trong các "hộp" Docker. Muốn xóa dự án chỉ cần 1 cú click, máy tính sạch sẽ như mới. |
| **Lens (hoặc OpenLens)** | IDE đỉnh nhất thế giới dành cho Kỹ sư K8s. Dùng để soi các cụm Kubernetes bằng giao diện trực quan thay vì gõ lệnh kubectl mù mịt. |
| **Ngrok (hoặc Cloudflare Tunnels)** | Tool siêu nhỏ gọn giúp "đục lỗ" NAT. Đưa cổng `localhost:8080` của bạn ra Internet để test Webhook (như VNPay, Momo) gửi về máy cá nhân. |

---

## 💡 Luồng làm việc chuẩn của Chuyên gia:

1. Bật **WSL2** (Windows Terminal).
2. Gõ lệnh `docker compose up -d` -> Docker Desktop dựng Postgres, Redis lên.
3. Mở **TablePlus** kết nối vào `localhost:5432` để xem Database.
4. Mở **IntelliJ** code API cho Spring Boot.
5. Mở **VSCode** code giao diện React gọi API.
6. Mở **Bruno** test thử các luồng thanh toán khó.
7. Xong việc gõ `docker compose down` -> Máy tính lại nhẹ tênh!
