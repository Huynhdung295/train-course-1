# Tích hợp Passkey (FIDO2 / WebAuthn)

## 1. Khái niệm (Backend)
Passkey cho phép đăng nhập bằng vân tay, khuôn mặt (FaceID) hoặc Windows Hello thay vì mật khẩu. Cực kỳ bảo mật và chống Phishing tuyệt đối.

## 2. Cách sử dụng (Backend APIs)
Quá trình có 2 giai đoạn:
1. **Đăng ký (Registration):** Frontend gọi Backend xin cấu hình options -> Trình duyệt bật popup quét vân tay -> Gửi public key về Backend lưu.
2. **Đăng nhập (Authentication):** Frontend gọi Backend xin challenge -> Trình duyệt bật popup quét vân tay ký challenge -> Gửi chữ ký về Backend xác minh.

## 3. Output (JSON Format)
Options phức tạp theo chuẩn FIDO2 (PublicKeyCredentialCreationOptions).

## 4. Tích hợp React (Best Practices)
- **CỰC KỲ QUAN TRỌNG:** KHÔNG tự viết WebAuthn API (navigator.credentials.create/get) bằng tay vì API này cực kỳ phức tạp (phải xử lý ArrayBuffer encoding/decoding Base64URL).
- **Thư viện khuyên dùng:** Sử dụng thư viện @simplewebauthn/browser.
- Cách tích hợp:
  `	ypescript
  import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

  // 1. Lấy options từ backend
  const resp = await axios.post('/api/v1/webauthn/register/start');
  // 2. Kích hoạt quét vân tay
  const attResp = await startRegistration(resp.data);
  // 3. Gửi lên backend
  await axios.post('/api/v1/webauthn/register/finish', attResp);
  `

## 5. Cách Test
- Dùng Chrome trên Android (hoặc trình duyệt có FaceID) để thử đăng ký. Trình duyệt sẽ hiện popup yêu cầu quét sinh trắc học.
