# Promotion Service — Tài Liệu API

> Service: Promotion Service  
> Base URL: `http://localhost:3006/api/v1`  
> Health: `http://localhost:3006/api/v1/health`  
> RMQ Queue: `promotion_queue`  
> Content-Type: `application/json`

## Tổng quan

Promotion Service quản lý voucher/khuyến mãi và tính toán giảm giá cho đơn hàng.

- API trả JSON trực tiếp từ controller/service.
- Có validate request bằng class-validator.
- Không yêu cầu Bearer token trong code hiện tại.

## RabbitMQ RPC

Promotion Service đã bật transport RMQ và hỗ trợ các pattern sau:

| Pattern                             | Payload                         | Mô tả                          |
| ----------------------------------- | ------------------------------- | ------------------------------ |
| `{ cmd: 'ping' }`                   | `any`                           | Kiểm tra trạng thái service    |
| `{ cmd: 'promotion.apply' }`        | `{ code, userId, orderAmount }` | Tính giảm giá từ voucher       |
| `{ cmd: 'promotion.find-by-code' }` | `{ code }`                      | Tra cứu voucher active theo mã |

## HTTP API

| Method   | Path                | Auth   | Mô tả                                           |
| -------- | ------------------- | ------ | ----------------------------------------------- |
| `GET`    | `/health`           | Public | Kiểm tra trạng thái service và kết nối database |
| `POST`   | `/promotions`       | Public | Tạo voucher mới                                 |
| `GET`    | `/promotions`       | Public | Danh sách voucher, hỗ trợ lọc `isActive`        |
| `GET`    | `/promotions/:id`   | Public | Lấy chi tiết voucher theo id                    |
| `PATCH`  | `/promotions/:id`   | Public | Cập nhật voucher                                |
| `DELETE` | `/promotions/:id`   | Public | Xoá voucher                                     |
| `POST`   | `/promotions/apply` | Public | Tính giảm giá theo mã voucher                   |

## Mô hình dữ liệu chính

### DiscountType

- `PERCENTAGE`: Giảm theo phần trăm.
- `FIXED_AMOUNT`: Giảm số tiền cố định.

### Promotion

Các trường quan trọng:

- `id`: UUID
- `code`: mã voucher (duy nhất)
- `name`: tên voucher
- `description`: mô tả
- `discountType`: `PERCENTAGE` hoặc `FIXED_AMOUNT`
- `discountValue`: giá trị giảm
- `maxDiscount`: mức trần giảm giá (thường dùng cho `%`)
- `minOrderValue`: giá trị đơn tối thiểu
- `startDate`, `endDate`: thời gian hiệu lực
- `usageLimit`, `perUserLimit`: giới hạn sử dụng
- `isActive`: trạng thái hoạt động

## Chi tiết endpoint

### 1) Health check

`GET /health`

Response mẫu khi OK:

```json
{
  "status": "ok",
  "service": "promotion-service",
  "database": "connected",
  "timestamp": "2026-04-16T03:20:00.000Z"
}
```

### 2) Tạo voucher

`POST /promotions`

Request body:

```json
{
  "code": "SPRING2026",
  "name": "Khuyến mãi mùa xuân",
  "description": "Giảm 10% tối đa 100000",
  "discountType": "PERCENTAGE",
  "discountValue": 10,
  "maxDiscount": 100000,
  "minOrderValue": 500000,
  "startDate": "2026-04-01T00:00:00.000Z",
  "endDate": "2026-04-30T23:59:59.000Z",
  "usageLimit": 1000,
  "perUserLimit": 1,
  "isActive": true
}
```

Response mẫu:

```json
{
  "id": "8b54d1ef-a120-4aef-b3a7-8a2ea29e1783",
  "code": "SPRING2026",
  "name": "Khuyến mãi mùa xuân",
  "description": "Giảm 10% tối đa 100000",
  "discountType": "PERCENTAGE",
  "discountValue": "10.00",
  "maxDiscount": "100000.00",
  "minOrderValue": "500000.00",
  "startDate": "2026-04-01T00:00:00.000Z",
  "endDate": "2026-04-30T23:59:59.000Z",
  "usageLimit": 1000,
  "perUserLimit": 1,
  "isActive": true,
  "createdAt": "2026-04-16T03:20:00.000Z",
  "updatedAt": "2026-04-16T03:20:00.000Z"
}
```

### 3) Lấy danh sách voucher

`GET /promotions`

Query hỗ trợ:

- `isActive=true|false`

Ví dụ:

- `GET /promotions`
- `GET /promotions?isActive=true`

### 4) Lấy chi tiết voucher

`GET /promotions/:id`

Ví dụ:

- `GET /promotions/8b54d1ef-a120-4aef-b3a7-8a2ea29e1783`

### 5) Cập nhật voucher

`PATCH /promotions/:id`

Chỉ gửi các trường cần đổi.

Request body ví dụ:

```json
{
  "name": "Khuyến mãi tháng 4",
  "discountValue": 12,
  "maxDiscount": 120000,
  "isActive": true
}
```

### 6) Xoá voucher

`DELETE /promotions/:id`

Ví dụ:

- `DELETE /promotions/8b54d1ef-a120-4aef-b3a7-8a2ea29e1783`

### 7) Áp dụng voucher

`POST /promotions/apply`

Request body:

```json
{
  "code": "SPRING2026",
  "userId": "a245bb75-1111-4f50-88ee-02f7c5489f0d",
  "orderAmount": 1200000
}
```

Logic tính giảm:

- Nếu `discountType = PERCENTAGE`: giảm theo `%` của `orderAmount`.
- Nếu có `maxDiscount`: số tiền giảm không vượt quá `maxDiscount`.
- Nếu `discountType = FIXED_AMOUNT`: giảm đúng `discountValue`.

Response mẫu:

```json
{
  "promotionId": "8b54d1ef-a120-4aef-b3a7-8a2ea29e1783",
  "code": "SPRING2026",
  "discountAmount": 100000,
  "finalAmount": 1100000
}
```

## Lỗi thường gặp

- `400 Bad Request`
  - `Mã voucher đã tồn tại`
  - `Voucher không tồn tại hoặc đã hết hạn`
  - `Voucher ngoài thời gian sử dụng`
  - `Đơn hàng tối thiểu ...`
  - Lỗi validate DTO (thiếu field, sai kiểu dữ liệu)
- `404 Not Found`
  - `Không tìm thấy voucher`

## Ví dụ cURL

Tạo voucher:

```bash
curl --location 'http://localhost:3006/api/v1/promotions' \
--header 'Content-Type: application/json' \
--data '{
  "code": "SPRING2026",
  "name": "Khuyến mãi mùa xuân",
  "discountType": "PERCENTAGE",
  "discountValue": 10,
  "maxDiscount": 100000,
  "minOrderValue": 500000,
  "startDate": "2026-04-01T00:00:00.000Z",
  "endDate": "2026-04-30T23:59:59.000Z",
  "isActive": true
}'
```

Apply voucher:

```bash
curl --location 'http://localhost:3006/api/v1/promotions/apply' \
--header 'Content-Type: application/json' \
--data '{
  "code": "SPRING2026",
  "userId": "a245bb75-1111-4f50-88ee-02f7c5489f0d",
  "orderAmount": 1200000
}'
```

## Ghi chú kỹ thuật

- Trong code hiện tại, apply voucher chỉ tính toán giảm giá và trả kết quả, chưa ghi nhận usage vào bảng `PROMOTION_USAGES`.
- Các trường `usageLimit` và `perUserLimit` hiện chưa được enforce trong luồng apply.
- Query `isActive` đang đọc trực tiếp từ query string; nếu cần chặt chẽ hơn nên parse boolean rõ ràng ở controller/service.
