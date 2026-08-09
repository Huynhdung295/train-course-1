# Tích hợp Transactional Outbox Pattern

## 1. Khái niệm (Backend)
Mô hình Outbox đảm bảo tính toàn vẹn 100%: Dữ liệu lưu xuống DB thành công thì chắc chắn Event Kafka cũng sẽ được gửi thành công (dù hệ thống Kafka có sập đi chăng nữa, khi hồi phục sẽ gửi bù).

## 2. Tích hợp React (Best Practices)
- Hoàn toàn trong suốt với Frontend, mang lại sự yên tâm tuyệt đối về mặt dữ liệu. Frontend không cần xử lý thêm gì.
