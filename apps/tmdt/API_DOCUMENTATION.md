# API Gateway - API Documentation

> Service: tmdt / API Gateway
> Base URL: `http://localhost:3000`
> Content-Type: `application/json`

## Tong quan

Gateway khong chua business logic, chi reverse proxy request HTTP toi cac service phia sau.

## Health

| Method | Path      | Mo ta                  |
| ------ | --------- | ---------------------- |
| `GET`  | `/health` | Tra trang thai gateway |

## Route map

| Prefix tren gateway           | Service dich          |
| ----------------------------- | --------------------- |
| `/api/v1/auth`                | User Service          |
| `/api/v1/users`               | User Service          |
| `/api/v1/addresses`           | User Service          |
| `/api/v1/users/me/fcm-tokens` | User Service          |
| `/internal/users`             | User Service          |
| `/api/v1/products`            | Product Service       |
| `/internal/products`          | Product Service       |
| `/api/v1/inventory`           | Inventory Service     |
| `/internal/inventory`         | Inventory Service     |
| `/api/v1/reviews`             | Review Service        |
| `/api/v1/comments`            | Review Service        |
| `/api/v1/uploads`             | Review Service        |
| `/internal/reviews`           | Review Service        |
| `/api/v1/config`              | Config Service        |
| `/internal/config`            | Config Service        |
| `/api/v1/orders`              | Order Service         |
| `/internal/orders`            | Order Service         |
| `/api/v1/payments`            | Payment Service       |
| `/internal/payments`          | Payment Service       |
| `/api/v1/notifications`       | Notification Service  |
| `/internal/notifications`     | Notification Service  |
| `/api/v1/promotions`          | Promotion Service     |
| `/internal/promotions`        | Promotion Service     |

## Ghi chu

- Gateway giu nguyen request body va response cua service dich.
- Request `multipart/form-data` duoc pass-through.
- Neu service dich khong san sang, gateway tra `502 BAD_GATEWAY` voi payload loi chuan.