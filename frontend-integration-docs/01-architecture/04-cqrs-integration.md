# Tích hợp CQRS Pattern

## 1. Khái niệm (Backend)
CQRS (Command Query Responsibility Segregation) tách biệt việc ghi dữ liệu (Command) và đọc dữ liệu (Query).
Ở Backend: CommandBus dùng cho Create/Update/Delete, còn QueryBus dùng cho Read. Database có thể được tách biệt giữa Write DB và Read DB.

## 2. Cách sử dụng (Backend APIs)
- **Commands:** POST, PUT, DELETE (Thường trả về ít dữ liệu, hoặc chỉ trả về ID).
- **Queries:** GET (Có thể hỗ trợ phân trang, lọc, sắp xếp cực mạnh, trả về ViewModel tối ưu cho UI).

## 3. Output (JSON Format)
Queries trả về cấu trúc tối ưu (ví dụ ReadModel):
`json
{
  "status": "success",
  "data": {
    "items": [{ "id": "1", "summary": "Order 1" }],
    "totalElements": 1
  }
}
`

## 4. Tích hợp React (Best Practices)
- **Tách biệt Service:**
  - OrderCommandService.ts (Gửi POST/PUT, dùng React Query useMutation).
  - OrderQueryService.ts (Gửi GET, dùng React Query useQuery).
- **Thư viện khuyên dùng:**
  - React Query sinh ra để phục vụ CQRS!
  - useQuery dành cho Queries.
  - useMutation dành cho Commands. Sau khi mutation thành công, gọi queryClient.invalidateQueries(...) để bắt React Query đi lấy lại dữ liệu Read mới nhất.

## 5. Cách Test
- Test Command: Đảm bảo sau khi submit form, UI chặn double-click (nút submit bị disable) và gọi mutation chính xác.
- Test Query: Đảm bảo Pagination và Caching hoạt động (click trang 2 rồi quay về trang 1 không tốn thêm network request nếu đã cache).
