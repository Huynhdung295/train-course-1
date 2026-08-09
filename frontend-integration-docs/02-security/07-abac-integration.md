# Tích hợp ABAC (Fine-grained Auth)

## 1. Khái niệm (Backend)
ABAC (Attribute-Based Access Control) là cấp quyền linh hoạt dựa trên thuộc tính (Ví dụ: Bạn chỉ có quyền sửa Đơn Hàng NẾU đơn hàng đó do BẠN tạo, hoặc thuộc phòng ban của BẠN, và Đơn Hàng đó chưa hoàn thành). Khác với RBAC (Role) chỉ kiểm tra quyền tĩnh.

## 2. Cách sử dụng (Backend APIs)
Backend sử dụng @PreAuthorize với CustomPermissionEvaluator. Ví dụ: @PreAuthorize("hasPermission(#orderId, 'Order', 'EDIT')").

## 3. Output (JSON Format)
Tương tự quyền RBAC, nếu vi phạm sẽ bị lỗi 403 Forbidden.

## 4. Tích hợp React (Best Practices)
- Khó khăn lớn nhất ở Frontend là làm sao để biết có nên ẨN nút "Sửa đơn hàng" đi không (vì quyền phụ thuộc vào data của từng đơn hàng).
- **Giải pháp Frontend:**
  - Cách 1: Backend phải trả kèm các quyền (actions allowed) trong dữ liệu trả về của mỗi bản ghi.
    `json
    {
      "id": 1,
      "name": "Order 1",
      "_permissions": {
        "canEdit": true,
        "canDelete": false
      }
    }
    `
  - Cách 2: Frontend tự viết lại một hàm logic canEditOrder(user, order) tương tự như backend để kiểm tra. (Khuyên dùng Cách 1 để tránh duplicate business logic).

## 5. Cách Test
- Đăng nhập bằng user A. Thử gọi API sửa đơn hàng của user B. Kết quả mong đợi là Backend trả về 403 Forbidden.
