# Tích hợp Clean & Hexagonal Architecture

## 1. Khái niệm (Backend)
Backend được thiết kế theo kiến trúc Hexagonal (Ports and Adapters). Core logic (Domain/Use Cases) được tách biệt hoàn toàn khỏi Framework, Database và UI.
- **Inbound Ports (Controllers):** Nơi nhận request từ Frontend (React).
- **Outbound Ports (Repositories/Clients):** Nơi Backend gọi DB hoặc dịch vụ bên thứ 3 (như Stripe).

## 2. Cách sử dụng (Backend APIs)
Mọi tương tác từ Frontend với Backend đều đi qua các Controllers (Inbound Adapters). Ví dụ: OrderController.java.
- API endpoints thường có version (ví dụ: /api/v1/orders).
- Payload gửi lên (Command) và Dữ liệu trả về (Response) đã được chuẩn hóa.

## 3. Output (JSON Format)
Dữ liệu trả về luôn bọc trong ApiResponse<T>:
`json
{
  "status": "success",
  "message": "Order created successfully",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "totalAmount": 105.50
  }
}
`

## 4. Tích hợp React (Best Practices)
- **Cấu trúc thư mục React:** Áp dụng tư tưởng Hexagonal bằng cách tạo thư mục src/services/ (chứa api calls) và src/domain/ (chứa interfaces/types) tách biệt với src/components/.
- **Thư viện khuyên dùng:** 
  - Axios: Tạo một instance trung tâm (xios.create()) để cấu hình base URL và interceptors.
  - React Query (@tanstack/react-query): Quản lý server state, tự động cache, retry và xử lý loading/error. Không nên tự viết useEffect để fetch data.
  
**Ví dụ tích hợp:**
`	ypescript
// src/services/orderService.ts
export const createOrder = async (payload: CreateOrderDto) => {
  const { data } = await axiosInstance.post<ApiResponse<Order>>('/api/v1/orders', payload);
  return data.data; // Trả về lõi dữ liệu
};

// src/hooks/useCreateOrder.ts
export const useCreateOrder = () => {
  return useMutation(createOrder, {
    onSuccess: () => { queryClient.invalidateQueries(['orders']) }
  });
};
`

## 5. Cách Test
- **Postman:** Gọi POST /api/v1/orders với JSON body chuẩn.
- **Frontend Test:** Sử dụng msw (Mock Service Worker) để giả lập API trả về ApiResponse khi test component React bằng Jest/React Testing Library.
