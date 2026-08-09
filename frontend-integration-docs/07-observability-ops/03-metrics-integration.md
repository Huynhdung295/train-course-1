# Tích hợp Actuator & Metrics

## 1. Khái niệm (Backend)
Backend sử dụng Micrometer & Prometheus để đo đạc sức khỏe hệ thống (CPU, RAM, số lượng đơn hàng / giây).

## 2. Tích hợp React (Best Practices)
- Frontend (End-user) không gọi các API `/actuator/prometheus` này vì đây là cổng bảo mật dành cho nội bộ (DevOps/SRE) kết nối với Grafana Dashboard.
- Nếu bạn làm trang Admin Dashboard cho dự án, có thể gọi API `/actuator/health` để hiển thị trạng thái xanh/đỏ của các module (Database, Redis, RabbitMQ).
