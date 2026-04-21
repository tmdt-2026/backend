# Payment Service — Tài Liệu API

> **Service:** Payment Service
> **Base URL:** `http://localhost:3007/api/v1`
> **Port:** `3007`
> **Version:** 1.0
> **Content-Type:** `application/json`

---

## Mục Lục

1. [Tổng Quan](#1-tổng-quan)
2. [Xác Thực](#2-xác-thực)
3. [Format Response](#3-format-response)
4. [Error Codes](#4-error-codes)
5. [Payment Endpoints](#5-payment-endpoints)
6. [Health Check](#6-health-check)
7. [Webhooks](#7-webhooks)
8. [RabbitMQ Events](#8-rabbitmq-events)

---

## 1. Tổng Quan

Payment Service quản lý tất cả giao dịch thanh toán trong hệ thống. Cung cấp các endpoint để:
- Tạo URL thanh toán qua các cổng thanh toán (VNPay, Momo, ...)
- Xử lý callback từ cổng thanh toán
- Quản lý trạng thái thanh toán
- Lưu trữ lịch sử giao dịch

### Supported Payment Gateways

| Gateway         | Mô tả                                    |
| --------------- | ---------------------------------------- |
| `vnpay`         | Cổng thanh toán VNPay (thẻ, QR, ví)     |
| `momo`          | Ví Momo                                  |
| `bank_transfer` | Chuyển khoản ngân hàng                   |
| `cod`           | Thanh toán khi nhận hàng (không xử lý tại service này) |

### Payment Status

| Status      | Mô tả                                    |
| ----------- | ---------------------------------------- |
| `unpaid`    | Chưa thanh toán                          |
| `pending`   | Đang xử lý                               |
| `paid`      | Đã thanh toán thành công                 |
| `failed`    | Thanh toán thất bại                      |
| `cancelled` | Thanh toán bị hủy                        |
| `refunded`  | Hoàn tiền                                |

---

## 2. Xác Thực

### JWT Bearer Token

Các endpoint yêu cầu xác thực cần gửi `Authorization` header:

```
Authorization: Bearer <accessToken>
```

**Access Token:** hết hạn sau **15 phút**

### Webhook (Public)

Endpoint callback từ cổng thanh toán không yêu cầu xác thực:

```
GET /payments/vnpay_return?vnp_TxnRef=...&vnp_ResponseCode=00&...
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
    "path": "/api/v1/payments/create-url",
    "timestamp": "2026-04-20T10:00:00.000Z"
  }
}
```

---

## 4. Error Codes

| Code                         | HTTP Status | Mô tả                                        |
| ---------------------------- | ----------- | -------------------------------------------- |
| `INVALID_AMOUNT`             | 400         | Số tiền thanh toán không hợp lệ              |
| `ORDER_NOT_FOUND`            | 404         | Không tìm thấy đơn hàng                      |
| `ORDER_ALREADY_PAID`         | 400         | Đơn hàng này đã được thanh toán               |
| `PAYMENT_NOT_FOUND`          | 404         | Không tìm thấy giao dịch thanh toán           |
| `GATEWAY_ERROR`              | 502         | Lỗi từ cổng thanh toán                       |
| `GATEWAY_TIMEOUT`            | 504         | Cổng thanh toán timeout                      |
| `INVALID_SIGNATURE`          | 400         | Chữ ký callback không hợp lệ                 |
| `PAYMENT_PROCESSING_ERROR`   | 500         | Lỗi xử lý thanh toán                         |
| `INSUFFICIENT_PERMISSION`    | 403         | Không có quyền truy cập giao dịch này         |

---

## 5. Payment Endpoints

### 5.1 Tạo URL Thanh Toán

**`POST /payments/create-url`**

Tạo URL thanh toán để chuyển hướng người dùng đến cổng thanh toán.

**Auth:** Yêu cầu Bearer token
**Roles:** `customer`, `staff`, `admin`

**Request Body:**

```json
{
  "amount": 500000,
  "orderId": "order-uuid",
  "paymentMethod": "vnpay",
  "description": "Thanh toán đơn hàng ORD-20260420-001",
  "returnUrl": "https://example.com/payment-result",
  "notifyUrl": "https://example.com/payment-notify"
}
```

| Field              | Type                          | Bắt buộc | Mô tả                                          |
| ------------------ | ----------------------------- | -------- | ---------------------------------------------- |
| `amount`           | number                        | ✅       | Số tiền thanh toán (tính bằng VND, tối thiểu 1000) |
| `orderId`          | string (UUID)                 | ✅       | ID đơn hàng cần thanh toán                      |
| `paymentMethod`    | `vnpay` \| `momo` \| `bank_transfer` | ✅ | Phương thức thanh toán |
| `description`      | string                        | ❌       | Mô tả giao dịch                                |
| `returnUrl`        | string (URL)                  | ❌       | URL quay lại sau khi thanh toán (mặc định từ config) |
| `notifyUrl`        | string (URL)                  | ❌       | URL nhận webhook từ cổng thanh toán (mặc định từ config) |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "paymentUrl": "https://sandbox.vnpayment.vn/paygate?vnp_Version=2.1.0&vnp_Command=pay&...",
    "transactionId": "transaction-uuid",
    "orderId": "order-uuid",
    "amount": 500000,
    "paymentMethod": "vnpay",
    "status": "pending",
    "createdAt": "2026-04-20T10:00:00.000Z",
    "expiresAt": "2026-04-20T10:30:00.000Z"
  }
}
```

**Lỗi có thể xảy ra:** `INVALID_AMOUNT`, `ORDER_NOT_FOUND`, `ORDER_ALREADY_PAID`, `GATEWAY_ERROR`

---

### 5.2 VNPay Callback (Webhook)

**`GET /payments/vnpay_return`**

Endpoint callback từ VNPay khi người dùng hoàn tất thanh toán.

**Auth:** Không yêu cầu (public endpoint)

**Query Parameters (từ VNPay):**

```
?vnp_Amount=500000
&vnp_BankCode=VNPAYQR
&vnp_BankTmnCode=TmnCode
&vnp_CardType=CC
&vnp_OrderInfo=order-uuid
&vnp_PayDate=20260420101530
&vnp_ResponseCode=00
&vnp_TmnCode=TmnCode
&vnp_TransactionNo=12345678
&vnp_TxnRef=ORD-20260420-001
&vnp_SecureHash=signature
```

> ℹ️ Payment Service sẽ xác minh chữ ký và cập nhật trạng thái giao dịch.

**Response `200`:**

```json
{
  "message": "Thành công",
  "orderId": "order-uuid",
  "status": "paid"
}
```

hoặc khi thất bại:

```json
{
  "message": "Thất bại",
  "orderId": "order-uuid",
  "status": "failed"
}
```

**Lỗi có thể xảy ra:** `INVALID_SIGNATURE`, `PAYMENT_PROCESSING_ERROR`

---

### 5.3 Lấy Chi Tiết Giao Dịch

**`GET /payments/:transactionId`**

Lấy thông tin chi tiết của một giao dịch thanh toán.

**Auth:** Yêu cầu Bearer token
**Roles:** `customer`, `staff`, `admin`

**Path Parameters:**

| Param             | Type   | Mô tả                                |
| ----------------- | ------ | ------------------------------------ |
| `transactionId`   | string | ID giao dịch thanh toán (UUID)       |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "id": "transaction-uuid",
    "orderId": "order-uuid",
    "amount": 500000,
    "paymentMethod": "vnpay",
    "paymentGateway": "vnpay",
    "status": "paid",
    "description": "Thanh toán đơn hàng ORD-20260420-001",
    "gatewayTransactionId": "12345678",
    "gatewayResponseCode": "00",
    "gatewayResponseMessage": "Thành công",
    "paidAt": "2026-04-20T10:15:00.000Z",
    "createdAt": "2026-04-20T10:00:00.000Z",
    "updatedAt": "2026-04-20T10:15:00.000Z"
  }
}
```

**Lỗi có thể xảy ra:** `PAYMENT_NOT_FOUND`, `INSUFFICIENT_PERMISSION`

---

### 5.4 Danh Sách Giao Dịch

**`GET /payments`**

Xem danh sách các giao dịch thanh toán.

**Auth:** Yêu cầu Bearer token

**Query Parameters:**

| Param      | Type   | Default | Mô tả                                      |
| ---------- | ------ | ------- | ------------------------------------------ |
| `status`   | string | -       | Lọc theo trạng thái (unpaid, pending, paid, failed, cancelled, refunded) |
| `orderId`  | string | -       | Lọc theo ID đơn hàng                       |
| `method`   | string | -       | Lọc theo phương thức thanh toán            |
| `startDate`| string | -       | Lọc từ ngày (ISO 8601: YYYY-MM-DD)         |
| `endDate`  | string | -       | Lọc đến ngày (ISO 8601: YYYY-MM-DD)        |
| `page`     | number | 1       | Trang (bắt đầu từ 1)                       |
| `limit`    | number | 10      | Số lượng trên mỗi trang (tối đa 100)       |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "transaction-uuid-1",
        "orderId": "order-uuid-1",
        "amount": 500000,
        "paymentMethod": "vnpay",
        "status": "paid",
        "paidAt": "2026-04-20T10:15:00.000Z",
        "createdAt": "2026-04-20T10:00:00.000Z"
      },
      {
        "id": "transaction-uuid-2",
        "orderId": "order-uuid-2",
        "amount": 250000,
        "paymentMethod": "momo",
        "status": "failed",
        "createdAt": "2026-04-19T15:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "totalPages": 5
    }
  }
}
```

---

### 5.5 Hoàn Tiền

**`POST /payments/:transactionId/refund`**

Hoàn tiền một giao dịch đã thanh toán.

**Auth:** Yêu cầu Bearer token
**Roles:** `admin`, `staff`

**Path Parameters:**

| Param             | Type   | Mô tả                                |
| ----------------- | ------ | ------------------------------------ |
| `transactionId`   | string | ID giao dịch thanh toán (UUID)       |

**Request Body:**

```json
{
  "amount": 500000,
  "reason": "Khách hàng yêu cầu hủy đơn hàng"
}
```

| Field   | Type   | Bắt buộc | Mô tả                                     |
| ------- | ------ | -------- | ----------------------------------------- |
| `amount`| number | ✅       | Số tiền hoàn lại (VND, tối đa = số tiền gốc) |
| `reason`| string | ❌       | Lý do hoàn tiền                           |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "id": "refund-uuid",
    "transactionId": "transaction-uuid",
    "orderId": "order-uuid",
    "amount": 500000,
    "reason": "Khách hàng yêu cầu hủy đơn hàng",
    "status": "processing",
    "createdAt": "2026-04-20T10:30:00.000Z"
  }
}
```

**Lỗi có thể xảy ra:** `PAYMENT_NOT_FOUND`, `INVALID_AMOUNT`, `GATEWAY_ERROR`

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

## 7. Webhooks

### VNPay Webhook

Payment Service nhận webhook từ VNPay tại endpoint `/payments/vnpay_return`.

**Quy trình:**
1. Người dùng hoàn tất thanh toán trên VNPay
2. VNPay gửi callback đến `returnUrl` (do client cung cấp)
3. Client gửi thông tin callback đến Payment Service hoặc VNPay gửi trực tiếp đến webhook
4. Payment Service xác minh chữ ký và cập nhật trạng thái giao dịch
5. Gửi event `payment.completed` qua RabbitMQ đến Order Service

---

## 8. RabbitMQ Events

### Outgoing Events (Payment Service → Other Services)

| Event                 | Trigger                          | Payload                                    |
| --------------------- | -------------------------------- | ------------------------------------------ |
| `payment.completed`   | Khi thanh toán thành công        | `{ transactionId, orderId, amount, status: 'paid' }` |
| `payment.failed`      | Khi thanh toán thất bại          | `{ transactionId, orderId, failureReason }` |
| `payment.refunded`    | Khi hoàn tiền thành công         | `{ transactionId, orderId, refundAmount }` |

### Incoming Events (Other Services → Payment Service)

| Event                 | From Service  | Payload                          |
| --------------------- | ------------- | -------------------------------- |
| `order.created`       | Order Service | `{ orderId, amount }`            |

---

## Ghi Chú

- Tất cả số tiền được tính bằng **VND** (đơn vị tiền tệ Việt Nam), nguyên tế.
- URL thanh toán sẽ hết hạn sau **15 phút**. Nếu hết hạn, cần tạo URL mới.
- Nếu thanh toán thất bại, khách hàng có thể tạo URL thanh toán mới.
- Khi thanh toán thành công, giao dịch được khóa và không thể thay đổi trạng thái trực tiếp (phải qua hoàn tiền).
- Payment Service sẽ gửi event `payment.completed` đến Order Service để Order Service cập nhật trạng thái đơn hàng.
- VNPay signature được tính bằng `HMAC SHA512` trên các thông số theo thứ tự.
