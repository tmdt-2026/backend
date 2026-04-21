# Notification Service — Tài Liệu API

> **Service:** Notification Service
> **Base URL:** `http://localhost:3009/api/v1`
> **Port:** `3009`
> **Version:** 1.0
> **Content-Type:** `application/json`

---

## Mục Lục

1. [Tổng Quan](#1-tổng-quan)
2. [Xác Thực](#2-xác-thực)
3. [Format Response](#3-format-response)
4. [Error Codes](#4-error-codes)
5. [Notification Endpoints](#5-notification-endpoints)
6. [Internal Endpoints](#6-internal-endpoints)
7. [Health Check](#7-health-check)
8. [Email Templates](#8-email-templates)
9. [RabbitMQ Events](#9-rabbitmq-events)

---

## 1. Tổng Quan

Notification Service quản lý tất cả các thông báo và email được gửi đến người dùng. Cung cấp các endpoint để:
- Gửi email theo template có sẵn
- Phát sóng thông báo đến nhiều người dùng (broadcast)
- Quản lý template email
- Xem lịch sử email đã gửi
- Gửi lại email

### Email Status

| Status      | Mô tả                                    |
| ----------- | ---------------------------------------- |
| `PENDING`   | Đang chờ gửi                             |
| `SENT`      | Đã gửi thành công                        |
| `FAILED`    | Gửi thất bại                             |
| `BOUNCED`   | Email bị từ chối (địa chỉ không hợp lệ) |
| `OPENED`    | Email đã được mở                         |
| `CLICKED`   | Có link trong email được click            |

### Email Template Keys

| Key                      | Mô tả                                   |
| ------------------------ | --------------------------------------- |
| `registration_welcome`   | Email chào mừng sau khi đăng ký         |
| `password_reset`         | Link đặt lại mật khẩu                   |
| `email_verification`     | Link xác minh email                      |
| `order_confirmation`     | Xác nhận đơn hàng                       |
| `order_shipped`          | Thông báo đơn hàng đã được giao          |
| `order_delivered`        | Thông báo đơn hàng đã nhận               |
| `payment_success`        | Xác nhận thanh toán thành công          |
| `payment_failed`         | Thông báo thanh toán thất bại            |
| `promotion_available`    | Thông báo về khuyến mại có sẵn          |
| `review_request`         | Yêu cầu viết review sau khi mua          |
| `admin_broadcast`        | Thông báo phát sóng từ admin             |

---

## 2. Xác Thực

### JWT Bearer Token (Public Endpoints)

Các endpoint public yêu cầu xác thực cần gửi `Authorization` header:

```
Authorization: Bearer <accessToken>
```

**Access Token:** hết hạn sau **15 phút**

### Internal Service Token (Internal Endpoints)

Các endpoint `/internal/*` yêu cầu header:

```
X-Service-Token: <INTERNAL_SERVICE_TOKEN>
```

Giá trị được cấu hình qua biến môi trường `INTERNAL_SERVICE_TOKEN`.

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
    "path": "/api/v1/notifications/broadcast",
    "timestamp": "2026-04-20T10:00:00.000Z"
  }
}
```

---

## 4. Error Codes

| Code                         | HTTP Status | Mô tả                                        |
| ---------------------------- | ----------- | -------------------------------------------- |
| `TEMPLATE_NOT_FOUND`         | 404         | Template email không tồn tại                 |
| `TEMPLATE_INACTIVE`          | 400         | Template đang bị vô hiệu hoá                 |
| `MISSING_TEMPLATE_VARIABLES` | 400         | Thiếu các biến cần thiết cho template        |
| `INVALID_EMAIL`              | 400         | Địa chỉ email không hợp lệ                   |
| `INVALID_RECIPIENTS`         | 400         | Danh sách người nhận không hợp lệ            |
| `EMAIL_LOG_NOT_FOUND`        | 404         | Không tìm thấy lịch sử email                 |
| `CANNOT_RESEND`              | 400         | Không thể gửi lại email ở trạng thái hiện tại |
| `RATE_LIMIT_EXCEEDED`        | 429         | Quá many requests, vui lòng thử lại sau     |
| `MAILER_ERROR`               | 500         | Lỗi từ mail server                           |

---

## 5. Notification Endpoints

### 5.1 Phát Sóng Thông Báo

**`POST /notifications/broadcast`**

Gửi thông báo email đến nhiều người dùng cùng lúc.

**Auth:** Yêu cầu Bearer token
**Roles:** `admin` (chỉ admin mới có quyền)

**Request Body:**

```json
{
  "templateKey": "promotion_available",
  "recipients": [
    {
      "email": "user1@example.com",
      "name": "Nguyễn Văn A"
    },
    {
      "email": "user2@example.com",
      "name": "Trần Thị B"
    }
  ],
  "variables": {
    "promotionName": "Flash Sale 50%",
    "promoCode": "FLASH50",
    "expiresAt": "2026-04-25",
    "discountPercent": 50
  }
}
```

| Field          | Type                                 | Bắt buộc | Mô tả                                          |
| -------------- | ------------------------------------ | -------- | ---------------------------------------------- |
| `templateKey`  | string                               | ❌       | Key template (mặc định: `admin_broadcast`)     |
| `recipients`   | Array<BroadcastRecipientDto>         | ✅       | Danh sách người nhận (1-500 người)             |
| `variables`    | Record<string, unknown>              | ❌       | Biến để render template                        |

**BroadcastRecipientDto:**

| Field   | Type   | Bắt buộc | Mô tả                              |
| ------- | ------ | -------- | ---------------------------------- |
| `email` | string | ✅       | Email người nhận (phải hợp lệ)     |
| `name`  | string | ❌       | Tên người nhận (hiển thị trong email) |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "total": 2,
    "succeeded": 2,
    "failed": 0,
    "broadcastId": "broadcast-uuid",
    "timestamp": "2026-04-20T10:00:00.000Z"
  }
}
```

**Lỗi có thể xảy ra:** `TEMPLATE_NOT_FOUND`, `TEMPLATE_INACTIVE`, `INVALID_RECIPIENTS`, `MISSING_TEMPLATE_VARIABLES`, `RATE_LIMIT_EXCEEDED`

---

## 6. Internal Endpoints

### 6.1 Gửi Email

**`POST /internal/notifications/send`**

Gửi email từ một service khác (sử dụng internal service token). Endpoint này là non-blocking — email được gửi trong background.

**Auth:** Yêu cầu `X-Service-Token` header
**Caller:** Các service khác trong hệ thống (User Service, Order Service, etc.)

**Request Body:**

```json
{
  "templateKey": "password_reset",
  "toEmail": "user@example.com",
  "toName": "Nguyễn Văn A",
  "variables": {
    "resetToken": "token-uuid",
    "resetUrl": "https://example.com/reset-password?token=token-uuid",
    "userName": "Nguyễn Văn A",
    "expiresIn": "15 minutes"
  },
  "referenceType": "user_password_reset",
  "referenceId": "user-uuid"
}
```

| Field            | Type                    | Bắt buộc | Mô tả                                          |
| ---------------- | ----------------------- | -------- | ---------------------------------------------- |
| `templateKey`    | string                  | ✅       | Key template email                             |
| `toEmail`        | string (email)          | ✅       | Email người nhận                               |
| `toName`         | string                  | ❌       | Tên người nhận                                 |
| `variables`      | Record<string, unknown> | ❌       | Biến để render template                        |
| `referenceType`  | string                  | ❌       | Loại tham chiếu (vd: order, user, payment)     |
| `referenceId`    | string                  | ❌       | ID tham chiếu (để đảm bảo idempotency)         |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "logId": "log-uuid",
    "status": "PENDING",
    "templateKey": "password_reset",
    "toEmail": "user@example.com",
    "createdAt": "2026-04-20T10:00:00.000Z"
  }
}
```

> ℹ️ Response trả về ngay với status `PENDING`. Email sẽ được gửi trong background với retry tự động.

**Lỗi có thể xảy ra:** `TEMPLATE_NOT_FOUND`, `TEMPLATE_INACTIVE`, `INVALID_EMAIL`, `MISSING_TEMPLATE_VARIABLES`, `MAILER_ERROR`

---

### 6.2 Xem Lịch Sử Email

**`GET /internal/notifications/logs`**

Xem danh sách lịch sử gửi email (dành cho internal service).

**Auth:** Yêu cầu `X-Service-Token` header

**Query Parameters:**

| Param          | Type   | Default | Mô tả                                      |
| -------------- | ------ | ------- | ------------------------------------------ |
| `templateKey`  | string | -       | Lọc theo template                          |
| `referenceType`| string | -       | Lọc theo loại tham chiếu                   |
| `referenceId`  | string | -       | Lọc theo ID tham chiếu                     |
| `status`       | string | -       | Lọc theo trạng thái (PENDING, SENT, FAILED, BOUNCED, OPENED, CLICKED) |
| `toEmail`      | string | -       | Lọc theo email người nhận                  |
| `startDate`    | string | -       | Từ ngày (ISO 8601: YYYY-MM-DD)             |
| `endDate`      | string | -       | Đến ngày (ISO 8601: YYYY-MM-DD)            |
| `page`         | number | 1       | Trang (bắt đầu từ 1)                       |
| `limit`        | number | 20      | Số lượng trên mỗi trang (tối đa 100)       |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "log-uuid-1",
        "templateKey": "password_reset",
        "toEmail": "user@example.com",
        "toName": "Nguyễn Văn A",
        "status": "SENT",
        "subject": "Đặt lại mật khẩu",
        "referenceType": "user_password_reset",
        "referenceId": "user-uuid",
        "sentAt": "2026-04-20T10:00:30.000Z",
        "createdAt": "2026-04-20T10:00:00.000Z",
        "updatedAt": "2026-04-20T10:00:30.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

---

### 6.3 Gửi Lại Email

**`POST /internal/notifications/logs/:logId/resend`**

Gửi lại email đã gửi trước đó (chỉ có thể gửi lại email có status `FAILED` hoặc `BOUNCED`).

**Auth:** Yêu cầu `X-Service-Token` header

**Path Parameters:**

| Param   | Type   | Mô tả                                |
| ------- | ------ | ------------------------------------ |
| `logId` | string | ID lịch sử email (UUID)              |

**Request Body (Optional):**

```json
{
  "variables": {
    "resetToken": "new-token-uuid",
    "resetUrl": "https://example.com/reset-password?token=new-token-uuid"
  }
}
```

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "logId": "log-uuid",
    "status": "PENDING",
    "attempt": 2,
    "lastError": null,
    "createdAt": "2026-04-20T10:00:00.000Z",
    "resentAt": "2026-04-20T10:05:00.000Z"
  }
}
```

**Lỗi có thể xảy ra:** `EMAIL_LOG_NOT_FOUND`, `CANNOT_RESEND`

---

## 7. Health Check

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

## 8. Email Templates

### Template Variables Reference

Mỗi template có các biến cần cung cấp:

| Template Key             | Bắt buộc Variables                | Mô tả                               |
| ------------------------ | --------------------------------- | ----------------------------------- |
| `registration_welcome`   | `userName`, `activationUrl`       | Email chào mừng đăng ký             |
| `password_reset`         | `resetUrl`, `expiresIn`, `userName` | Link đặt lại mật khẩu             |
| `email_verification`     | `verificationUrl`, `userName`     | Link xác minh email                 |
| `order_confirmation`     | `orderCode`, `totalAmount`, `items` | Xác nhận đơn hàng                 |
| `order_shipped`          | `orderCode`, `trackingNumber`, `estimatedDelivery` | Đơn đã giao |
| `order_delivered`        | `orderCode`, `deliveryDate`       | Đơn đã nhận                         |
| `payment_success`        | `orderCode`, `amount`, `transactionId` | Thanh toán thành công          |
| `payment_failed`         | `orderCode`, `failureReason`      | Thanh toán thất bại                 |
| `promotion_available`    | `promotionName`, `promoCode`, `discountPercent` | Khuyến mại có sẵn |
| `review_request`         | `productName`, `orderCode`, `reviewUrl` | Yêu cầu review               |

---

## 9. RabbitMQ Events

### Incoming Events (Other Services → Notification Service)

| Event                 | From Service    | Payload                                    |
| --------------------- | --------------- | ------------------------------------------ |
| `user.registered`     | User Service    | `{ userId, email, userName }`              |
| `password.reset-requested` | User Service | `{ userId, email, resetToken, expiresAt }` |
| `order.created`       | Order Service   | `{ orderId, userId, email, items, total }` |
| `order.shipped`       | Order Service   | `{ orderId, trackingNumber }`              |
| `order.delivered`     | Order Service   | `{ orderId, deliveredAt }`                 |
| `payment.completed`   | Payment Service | `{ transactionId, orderId, amount }`       |
| `payment.failed`      | Payment Service | `{ transactionId, orderId, reason }`       |

---

## Ghi Chú

### Idempotency

Khi gửi email từ internal service với `referenceType` và `referenceId`, Notification Service sẽ kiểm tra xem email này đã được gửi trước đó chưa. Nếu đã gửi, email mới sẽ không được gửi lại (đảm bảo idempotency).

```json
{
  "referenceType": "user_password_reset",
  "referenceId": "user-uuid"
}
```

### Retry Strategy

Email thất bại sẽ được gửi lại tự động theo chiến lược:
- **Attempt 1:** Ngay lập tức
- **Attempt 2:** Sau 5 phút
- **Attempt 3:** Sau 15 phút
- **Attempt 4:** Sau 1 giờ
- **Attempt 5:** Sau 3 giờ

Sau 5 lần thử thất bại, email sẽ được đánh dấu là `FAILED`.

### Rate Limiting

- Mỗi admin có thể gửi tối đa **100 broadcast emails/giờ**.
- Mỗi service có thể gửi tối đa **1000 internal emails/giờ**.

### Best Practices

1. **Luôn cung cấp `referenceType` và `referenceId`** để đảm bảo idempotency.
2. **Sử dụng template keys có sẵn** thay vì tạo template mới.
3. **Render HTML email trên client** thay vì gửi HTML trực tiếp để tránh injection.
4. **Test email trước khi phát sóng** bằng cách gửi đến một email test.
5. **Monitor email delivery status** bằng cách kiểm tra logs.
