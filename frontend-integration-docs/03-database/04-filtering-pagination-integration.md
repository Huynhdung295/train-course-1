# Tích hợp QueryDSL / Pagination / Filtering

## 1. Khái niệm (Backend)
Backend hỗ trợ tìm kiếm động nhiều điều kiện (ví dụ: Lọc đơn hàng theo Ngày tạo + Trạng thái + Tổng tiền > X) thông qua QueryDSL/JPA Specifications và phân trang dữ liệu (Pagination).

## 2. Cách sử dụng (Backend APIs)
Backend nhận các tham số trên URL Query String.
Ví dụ: GET /api/v1/orders?page=0&size=10&status=COMPLETED&sort=createdAt,desc

## 3. Output (JSON Format)
Dữ liệu trả về theo chuẩn Page<T> của Spring:
`json
{
  "content": [ { "id": 1 }, { "id": 2 } ],
  "pageable": {
    "pageNumber": 0,
    "pageSize": 10
  },
  "totalElements": 50,
  "totalPages": 5
}
`

## 4. Tích hợp React (Best Practices)
- **Thư viện UI khuyên dùng:** Dùng Ant Design Table hoặc MUI DataGrid để dễ dàng kết nối với Pagination từ API.
- **Thư viện fetch:** React Query kết hợp với tính năng keepPreviousData: true để giao diện không bị giật mờ (flickering) khi chuyển sang trang 2, 3.
- **Cấu trúc URL:** Lưu trạng thái phân trang và bộ lọc vào URL của Frontend (ví dụ /orders?page=2&status=COMPLETED) bằng eact-router-dom (useSearchParams) để user có thể F5 hoặc copy link gửi cho người khác mà không bị mất kết quả lọc.

## 5. Cách Test
- Trên giao diện Frontend, đổi bộ lọc, bấm sang trang 2, sau đó Refresh trang web (F5). Nếu kết quả trang 2 và bộ lọc vẫn giữ nguyên thì chứng tỏ tích hợp đúng chuẩn.
