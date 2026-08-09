# Tích hợp Docker Compose / Infra

## 1. Khái niệm (Backend)
Toàn bộ dự án Backend + Database + Redis + Kafka chạy gọn gàng bằng lệnh `docker-compose up`.

## 2. Tích hợp React (Best Practices)
- **Local Dev:** Dev Frontend chỉ cần tải code Backend về, cài Docker và chạy 1 lệnh duy nhất là có đủ môi trường API thật để code UI mà không cần cài Java, Node, Postgres lằng nhằng vào máy tính thật.
