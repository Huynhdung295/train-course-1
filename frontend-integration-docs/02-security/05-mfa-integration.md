# Tích hợp MFA (TOTP / SMS OTP)

## 1. Khái niệm (Backend)
Bảo mật 2 lớp (MFA). 
- **TOTP:** Mã 6 số sinh ra từ ứng dụng Google Authenticator.
- **SMS OTP:** Mã 6 số gửi qua tin nhắn (ví dụ Twilio).

## 2. Cách sử dụng (Backend APIs)
- API Đăng ký TOTP (/api/v1/mfa/setup-totp): Trả về mã bí mật và QR Code (dạng Base64 hoặc URI).
- API Xác thực (/api/v1/mfa/verify): Nhận token (TOTP/SMS) và trả về Access Token.

## 3. Output (JSON Format)
`json
{
  "secretUrl": "otpauth://totp/MyApp:user@email.com?secret=JBSWY...&issuer=MyApp",
  "qrCodeBase64": "data:image/png;base64,iVBORw0KGgo..."
}
`

## 4. Tích hợp React (Best Practices)
- **Luồng (Flow) UI:**
  - Nếu API Login (/login) báo lỗi MFA_REQUIRED, hãy chuyển user sang trang <MfaVerificationPage>.
- **Hiển thị QR Code:** Nếu backend trả về URL (secretUrl), Frontend có thể dùng thư viện qrcode.react để tự vẽ mã QR, hoặc dùng thẻ <img> nếu Backend trả về Base64 image.
- **Form nhập mã:** Sử dụng thư viện UI có component OTP Input (mỗi số một ô) để cải thiện UX thay vì một ô text dài. Ví dụ: eact-otp-input.

## 5. Cách Test
- Dùng app Google Authenticator quét QR Code, nhập mã gồm 6 chữ số vào form và submit.
