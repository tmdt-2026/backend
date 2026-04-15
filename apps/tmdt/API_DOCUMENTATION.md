# API Gateway — Tài Liệu API

> Service: tmdt / API Gateway
> Base URL: `http://localhost:3000`
> Content-Type: `application/json`

## Tổng quan

Gateway không chứa business logic; nó chỉ reverse proxy các route HTTP sang từng service phía sau.

## Health

| Method | Path      | Mô tả                  |
| ------ | --------- | ---------------------- |
| `GET`  | `/health` | Trả trạng thái gateway |

## Route map

| Prefix trên gateway   | Service đích      |
| --------------------- | ----------------- |
| `/api/v1/auth`        | User Service      |
| `/api/v1/users`       | User Service      |
| `/api/v1/addresses`   | User Service      |
| `/api/v1/fcm`         | User Service      |
| `/internal/users`     | User Service      |
| `/api/v1/products`    | Product Service   |
| `/internal/products`  | Product Service   |
| `/api/v1/inventory`   | Inventory Service |
| `/internal/inventory` | Inventory Service |
| `/api/v1/reviews`     | Review Service    |
| `/api/v1/comments`    | Review Service    |
| `/api/v1/uploads`     | Review Service    |
| `/internal/reviews`   | Review Service    |
| `/api/v1/config`      | Config Service    |
| `/internal/config`    | Config Service    |

## Ghi chú

- Gateway giữ nguyên request body và response của service đích.
- File upload `multipart/form-data` cho review service đi qua gateway mà không cần đổi format.
- Nếu service đích ngừng hoạt động, gateway trả `502 BAD_GATEWAY`.
