# Order Service — Tài Liệu API

> **Service:** Order Service
> **Base URL:** `http://localhost:3005/api/v1`
> **Port:** `3005`
> **Version:** 1.0
> **Content-Type:** `application/json`

---

## Mục Lục

1. [Tổng Quan](#1-tổng-quan)
2. [Xác Thực](#2-xác-thực)
3. [Format Response](#3-format-response)
4. [Error Codes](#4-error-codes)
5. [Order Endpoints](#5-order-endpoints)
6. [Health Check](#6-health-check)
7. [RabbitMQ Events](#7-rabbitmq-events)

---

## 1. Tổng Quan

Order Service quản lý tất cả các đơn hàng trong hệ thống. Cung cấp các endpoint để:
- Tạo đơn hàng mới
- Xem danh sách và chi tiết đơn hàng
- Cập nhật trạng thái đơn hàng
- Hủy đơn hàng
- Lấy thông tin đơn hàng qua RabbitMQ (được gọi bởi Review Service)

### Roles

| Role       | Mô tả                                    |
| ---------- | ---------------------------------------- |
| `customer` | Tạo đơn hàng, xem các đơn của mình       |
| `staff`    | Xem danh sách tất cả đơn, cập nhật trạng thái |
| `admin`    | Toàn quyền quản lý đơn hàng              |

### Order Status

| Status       | Mô tả                                     |
| ------------ | ----------------------------------------- |
| `pending`    | Chờ xác nhận                              |
| `confirmed`  | Đã xác nhận, chờ lấy hàng                 |
| `shipping`   | Đang giao                                 |
| `delivered`  | Đã giao                                   |
| `cancelled`  | Bị hủy                                    |

### Payment Methods

| Method         | Mô tả                          |
| -------------- | ------------------------------ |
| `cod`          | Thanh toán khi nhận hàng        |
| `vnpay`        | Cổng thanh toán VNPay          |
| `momo`         | Cổng thanh toán Momo           |
| `bank_transfer`| Chuyển khoản ngân hàng          |

### Payment Type

| Type         | Mô tả                          |
| ------------ | ------------------------------ |
| `full`       | Thanh toán toàn bộ             |
| `installment`| Thanh toán trả góp              |

---

## 2. Xác Thực

### JWT Bearer Token

Các endpoint yêu cầu xác thực cần gửi `Authorization` header:

```
Authorization: Bearer <accessToken>
```

**Access Token:** hết hạn sau **15 phút**

### Internal Service Call

Order Service có thể được gọi từ các service khác qua RabbitMQ:

```
MessagePattern: { cmd: 'order.get-by-id' }
Payload: { id: string }
```

---

## 3. Format Response

### Thành công

```json
{
  "success": true,
  "data": { ... }
}
```

### Lỗi

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Mô tả lỗi",
    "statusCode": 400,
    "path": "/api/v1/orders",
    "timestamp": "2026-04-20T10:00:00.000Z"
  }
}
```

---

## 4. Error Codes

| Code                         | HTTP Status | Mô tả                                        |
| ---------------------------- | ----------- | -------------------------------------------- |
| `ORDER_NOT_FOUND`            | 404         | Không tìm thấy đơn hàng                      |
| `ORDER_CREATION_FAILED`      | 400         | Tạo đơn hàng thất bại                        |
| `INVALID_PAYMENT_METHOD`     | 400         | Phương thức thanh toán không hợp lệ          |
| `INVALID_ORDER_STATUS`       | 400         | Trạng thái đơn hàng không hợp lệ             |
| `INVALID_ADDRESS`            | 400         | Địa chỉ giao hàng không hợp lệ               |
| `EMPTY_ITEMS`                | 400         | Đơn hàng không có sản phẩm                    |
| `INSUFFICIENT_INVENTORY`     | 400         | Hàng tồn kho không đủ                        |
| `CANNOT_CANCEL_ORDER`        | 400         | Không thể hủy đơn hàng ở trạng thái hiện tại |
| `PERMISSION_DENIED`          | 403         | Không có quyền truy cập đơn hàng này          |
| `USER_NOT_FOUND`             | 404         | Người dùng không tồn tại                     |

---

## 5. Order Endpoints

### 5.1 Tạo Đơn Hàng

**`POST /orders`**

Alias dành cho ngữ cảnh hóa đơn:

**`POST /orders/invoices`**

Luu y nghiep vu moi:
- Moi `product_variant_id` trong `items` se duoc order-service goi sang product-service de kiem tra ton tai va trang thai active truoc khi tao don.
- Neu variant khong ton tai, da ngung kinh doanh, hoac quantity vuot ton kho hien tai thi request bi tu choi voi `400`.

Tạo một đơn hàng mới.

**Auth:** Yêu cầu Bearer token
**Roles:** `customer`, `staff`, `admin`

**Request Body:**

```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "promotion_id": "promotion-uuid-optional",
  "payment_type": "full",
  "payment_method": "vnpay",
  "shipping_name": "Nguyễn Văn A",
  "shipping_phone": "0901234567",
  "shipping_province": "TP. Hồ Chí Minh",
  "shipping_district": "Quận 1",
  "shipping_ward": "Phường Bến Nghé",
  "shipping_street": "123 Đường Nguyễn Huệ",
  "note": "Giao hàng vào buổi sáng",
  "items": [
    {
      "product_variant_id": "variant-uuid-1",
      "product_name": "Áo thun trắng",
      "variant_label": "Size L",
      "quantity": 2,
      "import_price": 50000,
      "price": 150000,
      "item_discount": 0
    },
    {
      "product_variant_id": "variant-uuid-2",
      "product_name": "Quần jean xanh",
      "variant_label": "Size M",
      "quantity": 1,
      "import_price": 100000,
      "price": 300000,
      "item_discount": 30000
    }
  ]
}
```

| Field                   | Type                                      | Bắt buộc | Mô tả                                          |
| ----------------------- | ----------------------------------------- | -------- | ---------------------------------------------- |
| `user_id`               | string (UUID)                             | ✅       | ID người dùng tạo đơn                          |
| `promotion_id`          | string (UUID)                             | ❌       | ID mã khuyến mại (nếu có)                      |
| `payment_type`          | `full` \| `installment`                   | ✅       | Loại thanh toán                                |
| `payment_method`        | `cod` \| `vnpay` \| `momo` \| `bank_transfer` | ✅ | Phương thức thanh toán                         |
| `shipping_name`         | string                                    | ✅       | Tên người nhận hàng                            |
| `shipping_phone`        | string                                    | ✅       | Số điện thoại người nhận (10-11 chữ số)        |
| `shipping_province`     | string                                    | ✅       | Tỉnh/Thành phố giao hàng                       |
| `shipping_district`     | string                                    | ✅       | Quận/Huyện giao hàng                           |
| `shipping_ward`         | string                                    | ✅       | Phường/Xã giao hàng                            |
| `shipping_street`       | string                                    | ✅       | Địa chỉ chi tiết                               |
| `note`                  | string                                    | ❌       | Ghi chú cho đơn hàng (tối đa 500 ký tự)        |
| `items`                 | Array                                     | ✅       | Danh sách sản phẩm trong đơn (tối thiểu 1 item) |

**Items Object:**

| Field                   | Type    | Bắt buộc | Mô tả                                    |
| ----------------------- | ------- | -------- | ---------------------------------------- |
| `product_variant_id`    | string  | ✅       | ID của biến thể sản phẩm                 |
| `product_name`          | string  | ✅       | Tên sản phẩm                             |
| `variant_label`         | string  | ❌       | Nhãn biến thể (vd: Size, Màu)            |
| `quantity`              | number  | ✅       | Số lượng (tối thiểu 1)                   |
| `import_price`          | number  | ✅       | Giá nhập (tối thiểu 0)                   |
| `price`                 | number  | ✅       | Giá bán (tối thiểu 0)                    |
| `item_discount`         | number  | ❌       | Giảm giá cho item (tối thiểu 0)          |

**Response `201`:**

```json
{
  "success": true,
  "data": {
    "id": "order-uuid",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "order_code": "ORD-20260420-001",
    "status": "pending",
    "payment_type": "full",
    "payment_method": "vnpay",
    "payment_status": "unpaid",
    "total_amount": 720000,
    "discount_amount": 30000,
    "shipping_fee": 30000,
    "final_amount": 720000,
    "shipping_address": {
      "name": "Nguyễn Văn A",
      "phone": "0901234567",
      "province": "TP. Hồ Chí Minh",
      "district": "Quận 1",
      "ward": "Phường Bến Nghé",
      "street": "123 Đường Nguyễn Huệ"
    },
    "items": [...],
    "note": "Giao hàng vào buổi sáng",
    "createdAt": "2026-04-20T10:00:00.000Z",
    "updatedAt": "2026-04-20T10:00:00.000Z"
  }
}
```

**Lỗi có thể xảy ra:** `ORDER_CREATION_FAILED`, `EMPTY_ITEMS`, `INSUFFICIENT_INVENTORY`, `INVALID_PAYMENT_METHOD`

---

### 5.2 Danh Sách Đơn Hàng

**`GET /orders`**

Xem danh sách tất cả đơn hàng (chỉ staff/admin).

**Auth:** Yêu cầu Bearer token
**Roles:** `admin`, `staff`

**Query Parameters:**

| Param      | Type   | Default | Mô tả                                      |
| ---------- | ------ | ------- | ------------------------------------------ |
| `status`   | string | -       | Lọc theo trạng thái (pending, confirmed, shipping, delivered, cancelled) |
| `page`     | number | 1       | Trang (bắt đầu từ 1)                       |
| `limit`    | number | 10      | Số lượng trên mỗi trang (tối đa 100)       |
| `sort`     | string | -desc   | Sắp xếp theo trường (vd: createdAt, updatedAt) |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "order-uuid-1",
        "order_code": "ORD-20260420-001",
        "user_id": "user-uuid",
        "status": "pending",
        "total_amount": 720000,
        "payment_status": "unpaid",
        "createdAt": "2026-04-20T10:00:00.000Z"
      },
      {
        "id": "order-uuid-2",
        "order_code": "ORD-20260420-002",
        "user_id": "user-uuid-2",
        "status": "confirmed",
        "total_amount": 350000,
        "payment_status": "paid",
        "createdAt": "2026-04-20T09:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

---

### 5.3 Chi Tiết Đơn Hàng

**`GET /orders/:id`**

Alias dành cho ngữ cảnh hóa đơn:

**`GET /orders/invoices/:id`**

Xem chi tiết một đơn hàng. Customer chỉ có thể xem đơn của chính mình.

**Auth:** Yêu cầu Bearer token
**Roles:** `customer`, `staff`, `admin`

**Path Parameters:**

| Param | Type   | Mô tả                    |
| ----- | ------ | ------------------------ |
| `id`  | string | ID đơn hàng (UUID)       |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "id": "order-uuid",
    "order_code": "ORD-20260420-001",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "payment_type": "full",
    "payment_method": "vnpay",
    "payment_status": "unpaid",
    "total_amount": 720000,
    "discount_amount": 30000,
    "shipping_fee": 30000,
    "final_amount": 720000,
    "shipping_address": {
      "name": "Nguyễn Văn A",
      "phone": "0901234567",
      "province": "TP. Hồ Chí Minh",
      "district": "Quận 1",
      "ward": "Phường Bến Nghé",
      "street": "123 Đường Nguyễn Huệ"
    },
    "items": [
      {
        "product_variant_id": "variant-uuid-1",
        "product_name": "Áo thun trắng",
        "variant_label": "Size L",
        "quantity": 2,
        "price": 150000,
        "item_discount": 0,
        "subtotal": 300000
      }
    ],
    "note": "Giao hàng vào buổi sáng",
    "createdAt": "2026-04-20T10:00:00.000Z",
    "updatedAt": "2026-04-20T10:00:00.000Z"
  }
}
```

**Lỗi có thể xảy ra:** `ORDER_NOT_FOUND`, `PERMISSION_DENIED`

---

### 5.4 Cập Nhật Trạng Thái Đơn Hàng

**`PATCH /orders/:id/status`**

Cập nhật trạng thái đơn hàng (chỉ staff/admin).

**Auth:** Yêu cầu Bearer token
**Roles:** `admin`, `staff`

**Path Parameters:**

| Param | Type   | Mô tả                    |
| ----- | ------ | ------------------------ |
| `id`  | string | ID đơn hàng (UUID)       |

**Request Body:**

```json
{
  "status": "confirmed",
  "note": "Đã xác nhận đơn hàng"
}
```

| Field   | Type                                                   | Bắt buộc | Mô tả                                     |
| ------- | ------------------------------------------------------ | -------- | ----------------------------------------- |
| `status`| `pending` \| `confirmed` \| `shipping` \| `delivered` \| `cancelled` | ✅ | Trạng thái mới |
| `note`  | string                                                 | ❌       | Ghi chú cập nhật                          |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "id": "order-uuid",
    "order_code": "ORD-20260420-001",
    "status": "confirmed",
    "updated_by": "staff-uuid",
    "updatedAt": "2026-04-20T10:30:00.000Z"
  }
}
```

**Lỗi có thể xảy ra:** `ORDER_NOT_FOUND`, `INVALID_ORDER_STATUS`

---

### 5.5 Hủy Đơn Hàng

**`POST /orders/:id/cancel`**

Hủy một đơn hàng. Customer có thể hủy đơn của mình nếu chưa confirmed. Staff/Admin có thể hủy đơn ở các trạng thái nhất định.

**Auth:** Yêu cầu Bearer token
**Roles:** `customer`, `staff`, `admin`

**Path Parameters:**

| Param | Type   | Mô tả                    |
| ----- | ------ | ------------------------ |
| `id`  | string | ID đơn hàng (UUID)       |

**Request Body:**

```json
{
  "reason": "Tôi muốn hủy đơn hàng này"
}
```

| Field   | Type   | Bắt buộc | Mô tả                    |
| ------- | ------ | -------- | ------------------------ |
| `reason`| string | ❌       | Lý do hủy đơn hàng       |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "id": "order-uuid",
    "order_code": "ORD-20260420-001",
    "status": "cancelled",
    "cancellation_reason": "Tôi muốn hủy đơn hàng này",
    "cancelled_at": "2026-04-20T10:45:00.000Z"
  }
}
```

**Lỗi có thể xảy ra:** `ORDER_NOT_FOUND`, `CANNOT_CANCEL_ORDER`, `PERMISSION_DENIED`

---

### 5.6 Xóa Đơn Hàng

**`DELETE /orders/:id`**

Xóa một đơn hàng (thường dành cho admin).

**Auth:** Yêu cầu Bearer token
**Roles:** `admin`

**Path Parameters:**

| Param | Type   | Mô tả                    |
| ----- | ------ | ------------------------ |
| `id`  | string | ID đơn hàng (UUID)       |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "message": "Xóa đơn hàng thành công"
  }
}
```

**Lỗi có thể xảy ra:** `ORDER_NOT_FOUND`

---

## 6. Health Check

### `GET /health`

Kiểm tra trạng thái dịch vụ.

**Auth:** Không yêu cầu

**Response `200`:**

```json
{
  "status": "ok",
  "timestamp": "2026-04-20T10:00:00.000Z"
}
```

---

## 7. RabbitMQ Events

### Outgoing Events (Order Service → Other Services)

| Event          | Trigger                          | Payload                          |
| -------------- | -------------------------------- | -------------------------------- |
| `order.created`| Khi đơn hàng được tạo             | `{ orderId, userId, items, ... }`|
| `order.confirmed` | Khi đơn hàng được xác nhận      | `{ orderId, status: 'confirmed' }`|
| `order.shipped`| Khi đơn hàng được giao            | `{ orderId, status: 'shipped' }` |
| `order.delivered` | Khi đơn hàng được giao thành công | `{ orderId, status: 'delivered' }` |
| `order.cancelled` | Khi đơn hàng bị hủy            | `{ orderId, reason, cancelledAt }` |

### Incoming Events (Other Services → Order Service)

| Event              | From Service    | Payload                          |
| ------------------ | --------------- | -------------------------------- |
| `payment.completed`| Payment Service | `{ orderId, paymentStatus }`     |
| `inventory.updated`| Inventory Service | `{ productVariantId, quantity }` |

---

## Ghi Chú

- Khi tạo đơn hàng, Order Service sẽ gọi Inventory Service để kiểm tra tồn kho.
- Nếu có mã khuyến mại, Order Service sẽ gọi Promotion Service để lấy chi tiết giảm giá.
- Khi đơn hàng được tạo, Notification Service sẽ được gọi để gửi email xác nhận đến khách hàng.
- Review Service gọi Order Service qua RabbitMQ để lấy thông tin đơn hàng khi tạo review.
