# Inventory Service - API Documentation

> Service: Inventory Service
> Base URL: `http://localhost:3003/api/v1`
> Content-Type: `application/json`
> Transport: HTTP + RabbitMQ

## Tong quan

Inventory Service quan ly ton kho theo `productVariantId`, bao gom nhap kho, dieu chinh, low-stock va lich su giao dich.

## Xac thuc

- Da so endpoint can JWT Bearer token.
- Endpoint noi bo `POST /inventory/bulk-check` can `X-Service-Token`.

## Health

| Method | Path      | Auth   | Mo ta         |
| ------ | --------- | ------ | ------------- |
| `GET`  | `/health` | Public | Health check. |

## HTTP API

| Method  | Path                                 | Auth                      | Mo ta                                 |
| ------- | ------------------------------------ | ------------------------- | ------------------------------------- |
| `GET`   | `/inventory`                         | Bearer (`admin`, `staff`) | Danh sach ton kho (co paging/filter). |
| `GET`   | `/inventory/low-stock`               | Bearer (`admin`, `staff`) | Danh sach variant sap het hang.       |
| `POST`  | `/inventory/bulk-check`              | `X-Service-Token`         | Kiem tra du hang cho nhieu item.      |
| `GET`   | `/inventory/:variantId`              | Bearer (`admin`, `staff`) | Chi tiet ton kho cua 1 variant.       |
| `GET`   | `/inventory/:variantId/transactions` | Bearer (`admin`, `staff`) | Lich su giao dich cua variant.        |
| `POST`  | `/inventory/:variantId/import`       | Bearer (`admin`, `staff`) | Nhap kho.                             |
| `POST`  | `/inventory/:variantId/adjustment`   | Bearer (`admin`)          | Dieu chinh ton kho theo so thuc te.   |
| `PATCH` | `/inventory/:variantId/threshold`    | Bearer (`admin`)          | Cap nhat nguong low-stock.            |

### Query params

`GET /inventory`

- `page` (default `1`)
- `limit` (default `20`, max `100`)
- `variantId` (UUID)
- `lowStockOnly` (`true|false`, default `false`)
- `zeroStockOnly` (`true|false`, default `false`)
- `sortBy` (`quantity|reservedQuantity|updatedAt`, default `updatedAt`)
- `sortOrder` (`asc|desc`, default `desc`)

`GET /inventory/low-stock`

- `includeZero` (`true|false`, default `true`)
- `page`, `limit`

`GET /inventory/:variantId/transactions`

- `page`, `limit`
- `type` (`import|export_sale|export_return|reserve|release_reserve|adjustment`)
- `fromDate`, `toDate` (ISO date string)

### Body mau

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
  "note": "Nhap tu lo hang 2026-04",
  "referenceId": "GRN-0001"
}
```

`POST /inventory/:variantId/adjustment`

```json
{
  "quantityAfter": 85,
  "note": "Kiem ke cuoi ngay"
}
```

`PATCH /inventory/:variantId/threshold`

```json
{
  "lowStockThreshold": 10
}
```

## RabbitMQ

### Consumer patterns

- `product.variant_created`
- `order.created`
- `order.confirmed`
- `order.cancelled`

### Publisher events

- `inventory.stock_low`
- `inventory.stock_updated`
- `order.reserve_failed`

## Loi thuong gap

- `INVENTORY_NOT_FOUND`
- `INSUFFICIENT_STOCK`
- `variantId` khong dung dinh dang UUID
