# TMDT Backend

Nền tảng backend thương mại điện tử dùng NestJS microservices, RabbitMQ và Prisma.

Các service đang có trong luồng chạy chính:

- API Gateway: `tmdt` (port `3000`)
- User Service (port `3001`)
- Review Service (port `3002`)
- Inventory Service (port `3003`)
- Product Service (port `3004`)
- Order Service (port `3005`)
- Promotion Service (port `3006`)
- Payment Service (port `3007`)
- Notification Service (port `3009`)
- Config Service (port `3011`)

Hạ tầng phụ trợ:

- RabbitMQ (ports `5672`, `15672`)
- MySQL (port `3306`)

Lưu ý:

- `cart-service` đang bị comment trong [docker-compose.yml](docker-compose.yml).
- `order-service` và `payment-service` đã có source code trong [apps](apps) và hiện được khai báo trong [docker-compose.yml](docker-compose.yml).

## Kiến trúc nhanh

```text
Client -> API Gateway (3000)
              |
              +--> User Service (3001)
              +--> Review Service (3002)
              +--> Inventory Service (3003)
              +--> Product Service (3004)
              +--> Order Service (3005)
              +--> Promotion Service (3006)
              +--> Payment Service (3007)
              +--> Notification Service (3009)
              +--> Config Service (3011)

RabbitMQ: amqp://tmdt:tmdt2026@localhost:5672
MySQL: localhost:3306
```

## Yêu cầu

- Docker Desktop hoặc Docker Engine + Docker Compose
- Node.js 20+ nếu muốn chạy ngoài Docker
- npm 10+

## Cấu hình môi trường

Repo dùng file [.env.docker](.env.docker) cho chạy bằng Docker. File này đã chứa sẵn URL RabbitMQ, port và `DATABASE_URL` cho từng service.

Các giá trị quan trọng:

- `RABBITMQ_URL=amqp://tmdt:tmdt2026@rabbitmq:5672`
- `DATABASE_URL=mysql://root:password@mysql:3306/db_users`
- `INVENTORY_DATABASE_URL=mysql://root:password@mysql:3306/db_inventory`
- `REVIEW_DATABASE_URL=mysql://root:password@mysql:3306/db_reviews`
- `PRODUCT_DATABASE_URL=mysql://root:password@mysql:3306/db_products`
- `CONFIG_DATABASE_URL=mysql://root:password@mysql:3306/db_config`
- `PROMOTION_DATABASE_URL=mysql://root:password@mysql:3306/db_promotions`
- `NOTIFICATION_DATABASE_URL=mysql://root:password@mysql:3306/db_notifications`

## Chạy bằng Docker

### 1. Cài dependencies

```bash
npm install
```

### 2. Khởi động hạ tầng

```bash
docker compose up -d mysql rabbitmq
```

Lần đầu chạy, MySQL sẽ tự tạo các database từ [init.sql](init.sql).

### 3. Tạo Prisma client

```bash
npm run prisma:generate
```

### 4. Chạy migration

Chạy sau khi MySQL đã sẵn sàng:

```bash
npm run prisma:migrate
```

Tạo dữ liệu

```bash
npm run seed:all
```

### 5. Chạy toàn bộ hệ thống

```bash
docker compose up -d --build
```

### 6. Kiểm tra trạng thái

```bash
docker compose ps --all
```

- Gateway: http://localhost:3000/health
- User Service: http://localhost:3001/api/v1/health
- Review Service: http://localhost:3002/api/v1/health
- Inventory Service: http://localhost:3003/api/v1/health
- Product Service: http://localhost:3004/api/v1/health
- Order Service: http://localhost:3005/orders
- Promotion Service: http://localhost:3006/api/v1/health
- Payment Service: http://localhost:3007/api/payments
- Notification Service: http://localhost:3009/api/v1/health
- Config Service: http://localhost:3011/api/v1/health
- RabbitMQ UI: http://localhost:15672
  - Username: `tmdt`
  - Password: `tmdt2026`

Nếu service báo `unhealthy`, kiểm tra log:

```bash
docker compose logs -f user-service review-service inventory-service product-service order-service payment-service config-service promotion-service notification-service
```

## Chạy local không dùng Docker

Khuyến nghị dùng Docker Compose để chạy full hệ thống.

Nếu cần chạy local:

1. Chạy hạ tầng bằng Docker (`mysql`, `rabbitmq`).
2. Dùng file [.env.docker](.env.docker) làm base env, đổi host DB/RabbitMQ về `localhost` nếu chạy service ngoài container.
3. Chạy:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
```

4. Start từng service theo nhu cầu (ví dụ):

```bash
npx nest start tmdt --watch
npx nest start user-service --watch
npx nest start review-service --watch
npx nest start inventory-service --watch
npx nest start product-service --watch
npx nest start order-service --watch
npx nest start payment-service --watch
npx nest start config-service --watch
npx nest start promotion-service --watch
npx nest start notification-service --watch
```

## Script hữu ích

Trong `package.json` có sẵn:

- `npm run build`
- `npm run start:dev`
- `npm run start:prod`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run seed:all`
- `npm run seed:user-service`
- `npm run seed:product-service`
- `npm run seed:inventory-service`
- `npm run seed:review-service`
- `npm run seed:config-service`
- `npm run seed:promotion-service`
- `npm run seed:notification-service`

## API Gateway

Gateway nhan request HTTP va proxy den dung service.

| Prefix                        | Service              |
| ----------------------------- | -------------------- |
| `/api/v1/auth`                | User Service         |
| `/api/v1/users`               | User Service         |
| `/api/v1/addresses`           | User Service         |
| `/api/v1/users/me/fcm-tokens` | User Service         |
| `/internal/users`             | User Service         |
| `/api/v1/products`            | Product Service      |
| `/internal/products`          | Product Service      |
| `/api/v1/inventory`           | Inventory Service    |
| `/internal/inventory`         | Inventory Service    |
| `/api/v1/reviews`             | Review Service       |
| `/api/v1/comments`            | Review Service       |
| `/api/v1/uploads`             | Review Service       |
| `/internal/reviews`           | Review Service       |
| `/api/v1/config`              | Config Service       |
| `/internal/config`            | Config Service       |
| `/api/v1/orders`              | Order Service        |
| `/internal/orders`            | Order Service        |
| `/api/v1/payments`            | Payment Service      |
| `/internal/payments`          | Payment Service      |
| `/api/v1/notifications`       | Notification Service |
| `/internal/notifications`     | Notification Service |
| `/api/v1/promotions`          | Promotion Service    |
| `/internal/promotions`        | Promotion Service    |

## Tài liệu API theo service

- [User Service](apps/user-service/API_DOCUMENTATION.md)
- [Product Service](apps/product-service/API_DOCUMENTATION.md)
- [Inventory Service](apps/inventory-service/API_DOCUMENTATION.md)
- [Review Service](apps/review-service/API_DOCUMENTATION.md)
- [Config Service](apps/config-service/API_DOCUMENTATION.md)
- [Promotion Service](apps/promotion-service/API_DOCUMENTATION.md)
- [API Gateway](apps/tmdt/API_DOCUMENTATION.md)

## Hướng dẫn sử dụng cho Frontend

Frontend chỉ nên gọi qua Gateway, không gọi trực tiếp từng service.

- Base URL local: `http://localhost:3000`
- API prefix: `/api/v1`
- Health check nhanh: `GET /health`

### 1. Cấu hình API client

Ví dụ với Axios:

```ts
import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});
```

### 2. Luồng đăng nhập/đăng xuất

1. Đăng ký: `POST /auth/register`
2. Đăng nhập: `POST /auth/login`
3. Lưu `accessToken` + `refreshToken`
4. Khi `401`: gọi `POST /auth/refresh`, cập nhật token rồi retry request
5. Đăng xuất: `POST /auth/logout`

Chi tiết payload: xem [apps/user-service/API_DOCUMENTATION.md](apps/user-service/API_DOCUMENTATION.md)

### 3. Mapping API theo màn hình Frontend

- Trang chủ:
  - `GET /config/settings`
  - `GET /config/banners`
- Danh sách sản phẩm:
  - `GET /products?categoryId=...&isActive=true`
  - `GET /products/categories`
  - `GET /products/models`
- Chi tiết sản phẩm:
  - `GET /products/:id`
  - `GET /reviews/products/:productId`
  - `GET /reviews/products/:productId/stats`
  - `GET /comments/products/:productId`
- Tài khoản người dùng:
  - `GET /users/me`
  - `PATCH /users/me`
  - `GET /users/me/addresses`
  - `POST /users/me/addresses`
- Giỏ hàng/checkout (phía FE):
  - Kiểm tra voucher: `POST /promotions/apply`
  - (Khi có flow order/payment đầy đủ) gọi thêm `/orders` và `/payments`

### 4. Endpoint cần token

Các nhóm thường cần `Authorization: Bearer <token>`:

- `/users/*`
- `/orders/*`
- `/payments/*`
- `/promotions/apply`
- Các endpoint ghi dữ liệu review/comment (`POST/PUT/PATCH/DELETE`)

Các endpoint public phổ biến:

- `/products/*` (hiện tại)
- `/config/settings`, `/config/banners`
- `/reviews/products/*`, `/comments/products/*`
- `/promotions` (GET)

### 5. Quy ước xử lý lỗi trên FE

- `400`: hiển thị thông báo theo message backend.
- `401`: refresh token rồi retry 1 lần.
- `403`: báo người dùng không đủ quyền.
- `404`: hiển thị trạng thái không tìm thấy (sản phẩm/voucher/...)
- `502`: backend service phía sau gateway đang không sẵn sàng.

### 6. File upload review

Gửi `multipart/form-data` cho `POST /reviews`:

- Fields: `orderId`, `productId`, `rating`, `content`
- Files: field name `images` (tối đa 5 file)

Chi tiết giới hạn và response: xem [apps/review-service/API_DOCUMENTATION.md](apps/review-service/API_DOCUMENTATION.md)

## Ghi chú về database

- `init.sql` chỉ tạo database, không chạy migration Prisma.
- Mỗi service có schema Prisma riêng nên cần migrate riêng từng schema.
- Root `prisma.config.ts` dùng `DATABASE_URL` từ môi trường và schema mặc định `prisma/schema.prisma`; với repo này nên luôn truyền `--schema=...` khi migrate hoặc generate theo từng service.
