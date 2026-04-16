# User Service — Tài Liệu API

> **Service:** User Service
> **Base URL:** `http://localhost:3001/api/v1`
> **Port:** `3001`
> **Version:** 1.0
> **Content-Type:** `application/json`

---

## Mục Lục

1. [Tổng Quan](#1-tổng-quan)
2. [Xác Thực](#2-xác-thực)
3. [Format Response](#3-format-response)
4. [Error Codes](#4-error-codes)
5. [Auth Endpoints](#5-auth-endpoints)
6. [User Endpoints](#6-user-endpoints)
7. [Address Endpoints](#7-address-endpoints)
8. [FCM Token Endpoints](#8-fcm-token-endpoints)
9. [Internal Endpoints](#9-internal-endpoints-service-to-service)
10. [Health Check](#10-health-check)
11. [RabbitMQ Events](#11-rabbitmq-events)

---

## 1. Tổng Quan

### Rate Limiting

| Endpoint | Giới hạn |
|----------|---------|
| `POST /auth/register` | 5 req/phút/IP |
| `POST /auth/login` | 10 req/phút/IP |
| `POST /auth/forgot-password` | 3 req/phút/IP |
| Tất cả endpoints còn lại | 30 req/phút/IP |

### Roles

| Role | Mô tả |
|------|-------|
| `guest` | Chưa đăng nhập — chỉ gọi được public endpoints |
| `customer` | Đã đăng nhập — quản lý profile, địa chỉ, FCM token của mình |
| `staff` | Xem danh sách user và thông tin chi tiết |
| `admin` | Toàn quyền: xem, khoá/mở, phân quyền user |
| `internal` | Service khác — dùng `X-Service-Token` header |

---

## 2. Xác Thực

### JWT Bearer Token

Các endpoint yêu cầu xác thực cần gửi `Authorization` header:

```
Authorization: Bearer <accessToken>
```

**Access Token:** hết hạn sau **15 phút**
**Refresh Token:** hết hạn sau **30 ngày**, dùng để lấy access token mới

### Internal Service Token

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
    "path": "/api/v1/auth/login",
    "timestamp": "2026-04-13T10:00:00.000Z"
  }
}
```

---

## 4. Error Codes

| Code | HTTP Status | Mô tả |
|------|------------|-------|
| `EMAIL_ALREADY_EXISTS` | 409 | Email đã được đăng ký |
| `PHONE_ALREADY_EXISTS` | 409 | Số điện thoại đã được đăng ký |
| `INVALID_CREDENTIALS` | 401 | Email hoặc mật khẩu không đúng |
| `USER_INACTIVE` | 403 | Tài khoản bị khoá hoặc chưa kích hoạt |
| `INVALID_TOKEN` | 401 | Token không hợp lệ |
| `TOKEN_EXPIRED` | 401 | Token đã hết hạn |
| `TOKEN_REVOKED` | 401 | Token đã bị thu hồi |
| `INVALID_RESET_TOKEN` | 400 | Token đặt lại mật khẩu không hợp lệ hoặc hết hạn |
| `INVALID_CURRENT_PASSWORD` | 400 | Mật khẩu hiện tại không đúng |
| `USER_NOT_FOUND` | 404 | Không tìm thấy người dùng |
| `CANNOT_DEACTIVATE_SELF` | 400 | Không thể khoá tài khoản của chính mình |
| `ADDRESS_NOT_FOUND` | 404 | Không tìm thấy địa chỉ |
| `ADDRESS_LIMIT_EXCEEDED` | 400 | Đã đạt giới hạn 10 địa chỉ |

---

## 5. Auth Endpoints

### 5.1 Đăng Ký

**`POST /auth/register`**

Tạo tài khoản mới với role `customer`.

**Auth:** Không yêu cầu
**Rate limit:** 5 req/phút

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "Password123",
  "userName": "Nguyen Van A",
  "phoneNumber": "0901234567"
}
```

| Field | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `email` | string | ✅ | Email hợp lệ, dùng để đăng nhập |
| `password` | string | ✅ | Tối thiểu 8 ký tự, phải có chữ hoa, chữ thường và số |
| `userName` | string | ✅ | Tên hiển thị |
| `phoneNumber` | string | ❌ | 10–11 chữ số |

**Response `201`:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userName": "Nguyen Van A",
      "email": "user@example.com",
      "phoneNumber": "0901234567",
      "isActive": true,
      "roles": ["customer"],
      "fullName": "Nguyen Van A",
      "avatarUrl": null,
      "createdAt": "2026-04-13T10:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Lỗi có thể xảy ra:** `EMAIL_ALREADY_EXISTS`, `PHONE_ALREADY_EXISTS`

---

### 5.2 Đăng Nhập

**`POST /auth/login`**

**Auth:** Không yêu cầu
**Rate limit:** 10 req/phút

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "Password123",
  "deviceId": "device-uuid-optional"
}
```

| Field | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `email` | string | ✅ | |
| `password` | string | ✅ | |
| `deviceId` | string | ❌ | ID thiết bị, dùng để quản lý refresh token theo thiết bị |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userName": "Nguyen Van A",
      "email": "user@example.com",
      "phoneNumber": "0901234567",
      "isActive": true,
      "roles": ["customer"],
      "fullName": "Nguyen Van A",
      "avatarUrl": null,
      "createdAt": "2026-04-13T10:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Lỗi có thể xảy ra:** `INVALID_CREDENTIALS`, `USER_INACTIVE`

---

### 5.3 Làm Mới Token

**`POST /auth/refresh`**

Dùng refresh token để lấy cặp token mới. Refresh token cũ bị vô hiệu hoá sau khi dùng (rotation).

> ⚠️ Nếu refresh token cũ bị dùng lại sau khi đã rotation → toàn bộ session bị thu hồi (phát hiện đánh cắp token).

**Auth:** Không yêu cầu

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Lỗi có thể xảy ra:** `INVALID_TOKEN`, `TOKEN_EXPIRED`, `TOKEN_REVOKED`

---

### 5.4 Đăng Xuất

**`POST /auth/logout`**

Thu hồi refresh token. Access token vẫn còn hiệu lực đến khi hết hạn (15 phút).

**Auth:** Yêu cầu Bearer token

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "message": "Đăng xuất thành công"
  }
}
```

---

### 5.5 Quên Mật Khẩu

**`POST /auth/forgot-password`**

Gửi link đặt lại mật khẩu qua email (thông qua Notification Service).

**Auth:** Không yêu cầu
**Rate limit:** 3 req/phút

> ℹ️ Response luôn trả về thành công dù email có tồn tại hay không (bảo mật — không tiết lộ email đã đăng ký).

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "message": "Nếu email tồn tại, link đặt lại mật khẩu đã được gửi"
  }
}
```

---

### 5.6 Đặt Lại Mật Khẩu

**`POST /auth/reset-password`**

Đặt mật khẩu mới bằng token nhận được qua email. Token có hiệu lực **15 phút**.

**Auth:** Không yêu cầu

**Request Body:**

```json
{
  "token": "uuid-reset-token-from-email",
  "newPassword": "NewPassword123"
}
```

| Field | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `token` | string | ✅ | Token nhận được trong email |
| `newPassword` | string | ✅ | Tối thiểu 8 ký tự, có chữ hoa, chữ thường và số |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "message": "Đặt lại mật khẩu thành công"
  }
}
```

> Sau khi đặt lại thành công, toàn bộ refresh token của user bị thu hồi (buộc đăng nhập lại).

**Lỗi có thể xảy ra:** `INVALID_RESET_TOKEN`

---

### 5.7 Đổi Mật Khẩu

**`POST /auth/change-password`**

Đổi mật khẩu khi đã đăng nhập.

**Auth:** Yêu cầu Bearer token

**Request Body:**

```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword456"
}
```

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "message": "Đổi mật khẩu thành công"
  }
}
```

> Sau khi đổi thành công, toàn bộ refresh token bị thu hồi (buộc đăng nhập lại trên tất cả thiết bị).

**Lỗi có thể xảy ra:** `INVALID_CURRENT_PASSWORD`, `USER_NOT_FOUND`

---

### 5.8 Thông Tin Người Dùng Hiện Tại (từ Token)

**`GET /auth/me`**

Trả về thông tin được decode từ access token (không query DB).

**Auth:** Yêu cầu Bearer token

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "roles": ["customer"]
  }
}
```

---

## 6. User Endpoints

### 6.1 Xem Profile

**`GET /users/me`**

Lấy thông tin đầy đủ của người dùng đang đăng nhập (query DB).

**Auth:** Yêu cầu Bearer token

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userName": "Nguyen Van A",
    "email": "user@example.com",
    "phoneNumber": "0901234567",
    "isActive": true,
    "roles": ["customer"],
    "fullName": "Nguyen Van A",
    "avatarUrl": "https://cdn.example.com/avatars/abc.jpg",
    "dateOfBirth": "1995-08-15T00:00:00.000Z",
    "gender": "male",
    "createdAt": "2026-04-13T10:00:00.000Z",
    "updatedAt": "2026-04-13T12:00:00.000Z"
  }
}
```

---

### 6.2 Cập Nhật Profile

**`PATCH /users/me`**

Tất cả fields đều optional — chỉ gửi fields muốn thay đổi.

**Auth:** Yêu cầu Bearer token

**Request Body:**

```json
{
 "userName": "Nguyen Van B",
  "fullName": "Nguyễn Văn B",
  "avatarUrl": "https://cdn.example.com/avatars/new.jpg",
  "dateOfBirth": "1995-08-15",
  "gender": "male",
  "phoneNumber": "0909876543"
}
```

| Field | Type | Mô tả |
|-------|------|-------|
| `userName` | string | Tên đăng nhập hiển thị |
| `fullName` | string | Họ và tên đầy đủ |
| `avatarUrl` | string (URL) | Đường dẫn ảnh đại diện |
| `dateOfBirth` | string (`YYYY-MM-DD`) | Ngày sinh |
| `gender` | `male` \| `female` \| `other` | Giới tính |
| `phoneNumber` | string | 10–11 chữ số, phải là duy nhất |

**Response `200`:** _(cùng format với GET /users/me)_

**Lỗi có thể xảy ra:** `PHONE_ALREADY_EXISTS`, `USER_NOT_FOUND`

---

### 6.3 Danh Sách Users (Admin/Staff)

**`GET /users`**

**Auth:** Yêu cầu Bearer token
**Roles:** `admin`, `staff`

**Query Parameters:**

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `search` | string | — | Tìm theo email hoặc userName |
| `isActive` | boolean | — | Lọc theo trạng thái (true/false) |
| `page` | number | 1 | Trang hiện tại |
| `limit` | number | 20 | Số bản ghi mỗi trang (tối đa 100) |

**Ví dụ:** `GET /users?search=nguyen&isActive=true&page=1&limit=10`

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "userName": "Nguyen Van A",
        "email": "user@example.com",
        "phoneNumber": "0901234567",
        "isActive": true,
        "roles": ["customer"],
        "fullName": "Nguyễn Văn A",
        "avatarUrl": null,
        "createdAt": "2026-04-13T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 10,
      "totalPages": 15
    }
  }
}
```

---

### 6.4 Chi Tiết User (Admin/Staff)

**`GET /users/:id`**

**Auth:** Yêu cầu Bearer token
**Roles:** `admin`, `staff`

**Path Params:** `id` — UUID của user

**Response `200`:** _(cùng format với GET /users/me)_

**Lỗi có thể xảy ra:** `USER_NOT_FOUND`

---

### 6.5 Khoá/Mở Tài Khoản (Admin)

**`PATCH /users/:id/active`**

**Auth:** Yêu cầu Bearer token
**Roles:** `admin`

> ⚠️ Admin không thể khoá tài khoản của chính mình.
> Khi khoá user, toàn bộ refresh token của user đó bị thu hồi.

**Request Body:**

```json
{
  "isActive": false
}
```

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "message": "Tài khoản đã bị khoá"
  }
}
```

**Lỗi có thể xảy ra:** `USER_NOT_FOUND`, `CANNOT_DEACTIVATE_SELF`

---

### 6.6 Phân Quyền (Admin)

**`PATCH /users/:id/roles`**

Thay thế toàn bộ roles của user.

**Auth:** Yêu cầu Bearer token
**Roles:** `admin`

**Request Body:**

```json
{
  "roles": ["staff"]
}
```

| Field | Type | Mô tả |
|-------|------|-------|
| `roles` | string[] | Danh sách roles mới. Giá trị hợp lệ: `admin`, `staff`, `customer` |

**Response `200`:** _(thông tin user đầy đủ với roles mới)_

**Lỗi có thể xảy ra:** `USER_NOT_FOUND`

---

## 7. Address Endpoints

Tất cả endpoints địa chỉ yêu cầu đăng nhập. Mỗi user tối đa **10 địa chỉ**. Địa chỉ đầu tiên được tạo tự động trở thành mặc định.

### 7.1 Danh Sách Địa Chỉ

**`GET /users/me/addresses`**

**Auth:** Yêu cầu Bearer token

**Response `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id": "addr-uuid-1",
      "userId": "user-uuid",
      "label": "Nhà",
      "fullName": "Nguyễn Văn A",
      "phoneNumber": "0901234567",
      "province": "Hồ Chí Minh",
      "district": "Quận 1",
      "ward": "Phường Bến Nghé",
      "street": "123 Đường Lê Lợi",
      "isDefault": true,
      "createdAt": "2026-04-13T10:00:00.000Z",
      "updatedAt": "2026-04-13T10:00:00.000Z"
    }
  ]
}
```

> Địa chỉ mặc định (`isDefault: true`) luôn được trả về đầu tiên.

---

### 7.2 Thêm Địa Chỉ

**`POST /users/me/addresses`**

**Auth:** Yêu cầu Bearer token

**Request Body:**

```json
{
  "label": "Nhà",
  "fullName": "Nguyễn Văn A",
  "phoneNumber": "0901234567",
  "province": "Hồ Chí Minh",
  "district": "Quận 1",
  "ward": "Phường Bến Nghé",
  "street": "123 Đường Lê Lợi",
  "isDefault": false
}
```

| Field | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `label` | string | ❌ | Nhãn địa chỉ (VD: "Nhà", "Công ty") |
| `fullName` | string | ✅ | Người nhận |
| `phoneNumber` | string | ✅ | SĐT người nhận (10–11 số) |
| `province` | string | ✅ | Tỉnh/Thành phố |
| `district` | string | ✅ | Quận/Huyện |
| `ward` | string | ✅ | Phường/Xã |
| `street` | string | ✅ | Số nhà, tên đường |
| `isDefault` | boolean | ❌ | Đặt làm địa chỉ mặc định |

**Response `201`:** _(object địa chỉ vừa tạo)_

**Lỗi có thể xảy ra:** `ADDRESS_LIMIT_EXCEEDED`

---

### 7.3 Cập Nhật Địa Chỉ

**`PATCH /users/me/addresses/:id`**

Tất cả fields đều optional.

**Auth:** Yêu cầu Bearer token

**Request Body:**

```json
{
  "fullName": "Nguyễn Văn B",
  "street": "456 Đường Nguyễn Huệ"
}
```

**Response `200`:** _(object địa chỉ sau khi cập nhật)_

**Lỗi có thể xảy ra:** `ADDRESS_NOT_FOUND`

---

### 7.4 Xoá Địa Chỉ

**`DELETE /users/me/addresses/:id`**

**Auth:** Yêu cầu Bearer token

> Nếu xoá địa chỉ mặc định, địa chỉ mới nhất còn lại sẽ tự động trở thành mặc định.

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "message": "Đã xóa địa chỉ"
  }
}
```

**Lỗi có thể xảy ra:** `ADDRESS_NOT_FOUND`

---

### 7.5 Đặt Địa Chỉ Mặc Định

**`PATCH /users/me/addresses/:id/default`**

**Auth:** Yêu cầu Bearer token

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "message": "Đã đặt địa chỉ mặc định"
  }
}
```

**Lỗi có thể xảy ra:** `ADDRESS_NOT_FOUND`

---

## 8. FCM Token Endpoints

Quản lý Firebase Cloud Messaging token để nhận push notification.

### 8.1 Đăng Ký FCM Token

**`POST /users/me/fcm-tokens`**

**Auth:** Yêu cầu Bearer token

> Nếu token đã tồn tại (đăng ký cho user khác), nó sẽ được gán lại cho user hiện tại.

**Request Body:**

```json
{
  "token": "fcm-token-string-from-firebase-sdk",
  "deviceType": "android"
}
```

| Field | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `token` | string | ✅ | FCM token lấy từ Firebase SDK |
| `deviceType` | `android` \| `ios` \| `web` | ✅ | Loại thiết bị |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "message": "FCM token đã được đăng ký"
  }
}
```

---

### 8.2 Xoá FCM Token

**`DELETE /users/me/fcm-tokens/:token`**

Xoá FCM token khi đăng xuất khỏi thiết bị.

**Auth:** Yêu cầu Bearer token

**Path Params:** `token` — FCM token string cần xoá

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "message": "FCM token đã được xoá"
  }
}
```

---

## 9. Internal Endpoints (Service-to-Service)

Các endpoint này dành cho service khác trong hệ thống gọi đến. Yêu cầu header `X-Service-Token`.

**Base path:** `/api/v1/internal/users`
**Auth:** `X-Service-Token: <INTERNAL_SERVICE_TOKEN>`

---

### 9.1 Lấy Thông Tin User

**`GET /internal/users/:id`**

Lấy thông tin đầy đủ của một user theo ID. Dùng bởi Order Service, Review Service, v.v.

**Headers:**
```
X-Service-Token: internal-secret-token
```

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userName": "Nguyen Van A",
    "email": "user@example.com",
    "phoneNumber": "0901234567",
    "isActive": true,
    "roles": ["customer"],
    "fullName": "Nguyễn Văn A",
    "avatarUrl": null
  }
}
```

**Lỗi có thể xảy ra:** `INVALID_TOKEN` (401) nếu không tìm thấy user

---

### 9.2 Lấy Nhiều Users (Batch)

**`POST /internal/users/batch`**

Lấy thông tin nhiều users cùng lúc theo danh sách ID. Dùng để enrich dữ liệu (VD: lấy tên người mua trong danh sách đơn hàng).

**Headers:**
```
X-Service-Token: internal-secret-token
```

**Request Body:**

```json
{
  "ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001"
  ]
}
```

**Response `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userName": "Nguyen Van A",
      "email": "user@example.com",
      "isActive": true,
      "roles": ["customer"],
      "fullName": "Nguyễn Văn A",
      "avatarUrl": null
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "userName": "Tran Thi B",
      "email": "userb@example.com",
      "isActive": true,
      "roles": ["customer"],
      "fullName": "Trần Thị B",
      "avatarUrl": null
    }
  ]
}
```

> Nếu `ids` rỗng hoặc không phải array, trả về `[]`.

---

## 10. Health Check

**`GET /api/v1/health`**

Kiểm tra trạng thái service và kết nối database.

**Auth:** Không yêu cầu

**Response khi OK `200`:**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "user-service",
    "database": "connected",
    "timestamp": "2026-04-13T10:00:00.000Z"
  }
}
```

**Response khi lỗi DB `200`:**

```json
{
  "success": true,
  "data": {
    "status": "error",
    "service": "user-service",
    "database": "disconnected",
    "timestamp": "2026-04-13T10:00:00.000Z"
  }
}
```

---

## 11. RabbitMQ Events

User Service **publish** các event sau đến RabbitMQ (exchange: `apple_shop`, queue: `notification_queue`). Các service khác có thể subscribe để xử lý.

### 11.1 `user.registered`

Phát khi user đăng ký thành công. Notification Service dùng event này để gửi email chào mừng.

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "fullName": "Nguyễn Văn A"
}
```

---

### 11.2 `user.password_reset`

Phát khi user yêu cầu đặt lại mật khẩu. Notification Service dùng event này để gửi email chứa reset token.

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "resetToken": "uuid-reset-token"
}
```

---

### 11.3 `user.account_locked`

Phát khi admin khoá tài khoản user.

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com"
}
```

---

## Phụ Lục — Cấu Trúc JWT

### Access Token Payload

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "roles": ["customer"],
  "type": "access",
  "iat": 1744538400,
  "exp": 1744539300
}
```

### Refresh Token Payload

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "jti": "uuid-unique-token-id",
  "deviceId": "device-uuid",
  "type": "refresh",
  "iat": 1744538400,
  "exp": 1747130400
}
```

---

## Phụ Lục — Environment Variables

| Biến | Default | Mô tả |
|------|---------|-------|
| `PORT` | `3001` | Port HTTP server |
| `NODE_ENV` | `development` | Môi trường |
| `DATABASE_URL` | — | MySQL connection string |
| `RABBITMQ_URL` | `amqp://tmdt:tmdt2026@rabbitmq:5672` | RabbitMQ URL |
| `JWT_SECRET` | — | **Bắt buộc thay đổi ở production** |
| `JWT_ACCESS_EXPIRY` | `15m` | Thời hạn access token |
| `JWT_REFRESH_EXPIRY` | `30d` | Thời hạn refresh token |
| `BCRYPT_ROUNDS` | `12` | Số rounds bcrypt |
| `INTERNAL_SERVICE_TOKEN` | — | **Bắt buộc thay đổi ở production** |
| `CORS_ORIGIN` | `*` | CORS origin |
