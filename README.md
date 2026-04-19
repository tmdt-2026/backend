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

Gateway nhận request HTTP và proxy đến đúng service.

| Prefix                        | Service           |
| ----------------------------- | ----------------- |
| `/api/v1/auth`                | User Service      |
| `/api/v1/users`               | User Service      |
| `/api/v1/addresses`           | User Service      |
| `/api/v1/users/me/fcm-tokens` | User Service      |
| `/internal/users`             | User Service      |
| `/api/v1/products`            | Product Service   |
| `/internal/products`          | Product Service   |
| `/api/v1/inventory`           | Inventory Service |
| `/internal/inventory`         | Inventory Service |
| `/api/v1/reviews`             | Review Service    |
| `/api/v1/comments`            | Review Service    |
| `/api/v1/uploads`             | Review Service    |
| `/internal/reviews`           | Review Service    |
| `/api/v1/config`              | Config Service    |
| `/internal/config`            | Config Service    |
| `/api/v1/orders`              | Order Service     |
| `/internal/orders`            | Order Service     |
| `/api/v1/payments`            | Payment Service   |
| `/internal/payments`          | Payment Service   |

## Tài liệu API theo service

- [User Service](apps/user-service/API_DOCUMENTATION.md)
- [Product Service](apps/product-service/API_DOCUMENTATION.md)
- [Inventory Service](apps/inventory-service/API_DOCUMENTATION.md)
- [Review Service](apps/review-service/API_DOCUMENTATION.md)
- [Config Service](apps/config-service/API_DOCUMENTATION.md)
- [Promotion Service](apps/promotion-service/API_DOCUMENTATION.md)
- [API Gateway](apps/tmdt/API_DOCUMENTATION.md)

## Ghi chú về database

- `init.sql` chỉ tạo database, không chạy migration Prisma.
- Mỗi service có schema Prisma riêng nên cần migrate riêng từng schema.
- Root `prisma.config.ts` dùng `DATABASE_URL` từ môi trường và schema mặc định `prisma/schema.prisma`; với repo này nên luôn truyền `--schema=...` khi migrate hoặc generate theo từng service.
