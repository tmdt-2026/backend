# Promotion Service - API Documentation

> Service: Promotion Service
> Base URL: `http://localhost:3006/api/v1`
> Content-Type: `application/json`
> Transport: HTTP + RabbitMQ

## Tong quan

Promotion Service quan ly voucher/khuyen mai va tinh giam gia cho don hang.

## Xac thuc

Service ap global JWT guard va roles guard.

- Public: `GET /health`, `GET /promotions`, `GET /promotions/:id`
- Admin: `POST /promotions`, `PATCH /promotions/:id`, `DELETE /promotions/:id`
- Customer/Staff/Admin: `POST /promotions/apply`

## Health

| Method | Path      | Auth   | Mo ta                                         |
| ------ | --------- | ------ | --------------------------------------------- |
| `GET`  | `/health` | Public | Kiem tra service va ket noi database.         |

## HTTP API

| Method   | Path                | Auth                          | Mo ta                                |
| -------- | ------------------- | ----------------------------- | ------------------------------------ |
| `POST`   | `/promotions`       | Bearer (`admin`)              | Tao voucher moi.                     |
| `GET`    | `/promotions`       | Public                        | Danh sach voucher, ho tro `isActive` |
| `GET`    | `/promotions/:id`   | Public                        | Chi tiet voucher theo id.            |
| `PATCH`  | `/promotions/:id`   | Bearer (`admin`)              | Cap nhat voucher.                    |
| `DELETE` | `/promotions/:id`   | Bearer (`admin`)              | Xoa voucher.                         |
| `POST`   | `/promotions/apply` | Bearer (`customer`,`staff`,`admin`) | Ap dung voucher cho don hang.  |

### Query params

`GET /promotions`

- `isActive=true|false`

### Body mau

`POST /promotions`

```json
{
  "code": "SPRING2026",
  "name": "Khuyen mai mua xuan",
  "description": "Giam 10% toi da 100000",
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

`POST /promotions/apply`

```json
{
  "code": "SPRING2026",
  "userId": "a245bb75-1111-4f50-88ee-02f7c5489f0d",
  "orderAmount": 1200000
}
```

Response mau:

```json
{
  "promotionId": "8b54d1ef-a120-4aef-b3a7-8a2ea29e1783",
  "code": "SPRING2026",
  "discountAmount": 100000,
  "finalAmount": 1100000
}
```

## RabbitMQ RPC

| Pattern                             | Payload                         | Mo ta                          |
| ----------------------------------- | ------------------------------- | ------------------------------ |
| `{ cmd: 'ping' }`                   | `any`                           | Kiem tra trang thai service.   |
| `{ cmd: 'promotion.apply' }`        | `{ code, userId, orderAmount }` | Tinh giam gia voucher.         |
| `{ cmd: 'promotion.find-by-code' }` | `{ code }`                      | Tra cuu voucher active theo ma.|

## Loi thuong gap

- `400 Bad Request`: ma voucher ton tai, voucher het han, khong dat dieu kien don toi thieu, loi validate DTO.
- `401 Unauthorized`: thieu/sai JWT o endpoint can auth.
- `403 Forbidden`: token hop le nhung khong dung role.
- `404 Not Found`: khong tim thay voucher.