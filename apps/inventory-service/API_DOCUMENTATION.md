# Inventory Service — Tài Liệu API

> Service: Inventory Service
> Base URL: `http://localhost:3003/api/v1`
> Transport: HTTP + RabbitMQ
> Content-Type: `application/json`

## Tổng quan

Inventory Service quản lý tồn kho theo `productVariantId`, ghi nhận giao dịch nhập/xuất/điều chỉnh và phát sự kiện khi tồn kho thay đổi. Response HTTP được bọc theo format `success/data`.

## Xác thực

- Hầu hết API cần JWT Bearer token.
- Các endpoint `admin/staff` yêu cầu role tương ứng.
- `POST /inventory/bulk-check` dùng cho service nội bộ và yêu cầu `X-Service-Token`.

## HTTP API

| Method  | Path                                 | Auth                  | Mô tả                           |
| ------- | ------------------------------------ | --------------------- | ------------------------------- | ------------------------------ |
| `GET`   | `/health`                            | Public                | Health check                    |
| `GET`   | `/inventory`                         | Bearer + roles `admin | staff`                          | Danh sách tồn kho              |
| `GET`   | `/inventory/low-stock`               | Bearer + roles `admin | staff`                          | Danh sách variant sắp hết hàng |
| `POST`  | `/inventory/bulk-check`              | `X-Service-Token`     | Kiểm tra đủ hàng cho nhiều item |
| `GET`   | `/inventory/:variantId`              | Bearer + roles `admin | staff`                          | Chi tiết tồn kho của 1 variant |
| `GET`   | `/inventory/:variantId/transactions` | Bearer + roles `admin | staff`                          | Lịch sử giao dịch              |
| `POST`  | `/inventory/:variantId/import`       | Bearer + roles `admin | staff`                          | Nhập kho                       |
| `POST`  | `/inventory/:variantId/adjustment`   | Bearer + role `admin` | Điều chỉnh tồn kho              |
| `PATCH` | `/inventory/:variantId/threshold`    | Bearer + role `admin` | Cập nhật ngưỡng low-stock       |

### Body quan trọng

`POST /inventory/bulk-check`

```json
{
  "items": [
    { "productVariantId": "uuid-1", "quantity": 2 },
    { "productVariantId": "uuid-2", "quantity": 1 }
  ]
}
```

`POST /inventory/:variantId/import`

```json
{
  "quantity": 100,
  "note": "Nhập từ lô hàng 2026-04",
  "referenceId": "GRN-0001"
}
```

`POST /inventory/:variantId/adjustment`

```json
{
  "quantityAfter": 85,
  "note": "Kiểm kê thực tế cuối ngày"
}
```

`PATCH /inventory/:variantId/threshold`

```json
{ "lowStockThreshold": 10 }
```

## Response chính

- `GET /inventory` trả `data` là danh sách inventory và `meta` gồm `page`, `limit`, `total`, `totalPages`.
- `GET /inventory/:variantId` trả một inventory đã map: `id`, `productVariantId`, `quantity`, `reservedQuantity`, `availableQuantity`, `lowStockThreshold`, `isLowStock`.
- `POST /inventory/bulk-check` trả `data.allAvailable` và `data.items[]` với `requested`, `available`, `sufficient`.
- `POST /inventory/:variantId/import` trả transaction vừa tạo và snapshot inventory mới.

## RabbitMQ events

### Consumer

- `product.variant_created`
- `order.created`
- `order.confirmed`
- `order.cancelled`

### Publisher

- `inventory.stock_low`
- `inventory.stock_updated`
- `order.reserve_failed`

## Lỗi thường gặp

- `INVENTORY_NOT_FOUND` khi chưa có record tồn kho cho variant.
- `INSUFFICIENT_STOCK` khi không đủ hàng để reserve hoặc xuất.
- `variantId` trong HTTP API phải là UUID hợp lệ.
