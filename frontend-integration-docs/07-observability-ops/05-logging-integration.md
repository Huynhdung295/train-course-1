# Tích hợp Structured Logging (ELK)

## 1. Khái niệm (Backend)
Log được in ra dưới dạng JSON và đẩy thẳng về Elasticsearch/Logstash để dễ dàng query.

## 2. Tích hợp React (Best Practices)
- Để hoàn thiện hệ sinh thái, Frontend React cũng nên tích hợp các công cụ bắt log lỗi UI (ví dụ Sentry). 
- Khi Frontend gửi request lên Backend, có thể chủ động sinh ra một `X-Request-Id` (UUID) và gửi kèm trong Request Headers. Backend sẽ nhận lấy ID này và in vào log, giúp nối liền mạch vết tích lỗi từ thao tác click chuột của user trên Browser cho tới tận câu lệnh SQL dưới DB.
