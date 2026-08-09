# Tích hợp Distributed Tracing (TraceID)

## 1. Khái niệm (Backend)
OpenTelemetry tự động sinh ra một `TraceID` duy nhất cho mỗi request đi qua hệ thống. Mã này xuyên suốt từ Gateway -> Order Service -> Inventory Service -> Database.

## 2. Output (JSON Format)
Backend luôn trả về một Header trên Response: `X-Trace-Id: 5b8cc332...`

## 3. Tích hợp React (Best Practices)
- Bắt và lưu lại `X-Trace-Id`. 
- Khi hiển thị lỗi `500 Internal Server Error` cho người dùng, thay vì chỉ hiện chữ "Lỗi hệ thống", hãy hiện kèm:
  > Lỗi hệ thống. Mã lỗi của bạn là: **5b8cc332**. Vui lòng gửi mã này cho bộ phận hỗ trợ.
- Việc này giúp Dev tìm kiếm log trên Kibana/Zipkin cực kỳ nhanh chóng.
