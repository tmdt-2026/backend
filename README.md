# TMDT Backend

Nền tảng backend thương mại điện tử dùng NestJS microservices, RabbitMQ và Prisma. Repo hiện tại gồm các service sau:

- API Gateway: `tmdt`
- User Service
- Inventory Service
- Review Service
- Product Service
- Config Service

## Kiến trúc nhanh

```text
Client -> API Gateway (3000)
              |
              +--> User Service (3001)
              +--> Review Service (3002)
              +--> Inventory Service (3003)
              +--> Product Service (3004)
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

## Chạy bằng Docker

### 1. Khởi động hạ tầng

```bash
docker compose up -d mysql rabbitmq
```

Lần đầu chạy, MySQL sẽ tự tạo các database từ [init.sql](init.sql).

### 2. Tạo Prisma client

```bash
npm install
npm run prisma:generate
```

### 3. Chạy migrate cho từng service

Chạy sau khi MySQL đã sẵn sàng:

```bash
npx prisma migrate deploy --schema=apps/user-service/prisma/schema.prisma
npx prisma migrate deploy --schema=apps/inventory-service/prisma/schema.prisma
npx prisma migrate deploy --schema=apps/review-service/prisma/schema.prisma
npx prisma migrate deploy --schema=apps/product-service/prisma/schema.prisma
npx prisma migrate deploy --schema=apps/config-service/prisma/schema.prisma
```

Tạo dữ liệu

```bash
npm run seed:all
```

### 4. Chạy toàn bộ hệ thống

```bash
docker compose up -d --build
```

### 5. Kiểm tra trạng thái

- Gateway: http://localhost:3000/health
- User Service: http://localhost:3001/api/v1/health
- Review Service: http://localhost:3002/api/v1/health
- Inventory Service: http://localhost:3003/api/v1/health
- Product Service: http://localhost:3004/api/v1/health
- Config Service: http://localhost:3011/api/v1/health
- RabbitMQ UI: http://localhost:15672
  - Username: `tmdt`
  - Password: `tmdt2026`

## Chạy local không dùng Docker

Nếu muốn chạy từng service trên máy local, hãy đảm bảo MySQL và RabbitMQ đang chạy, sau đó:

```bash
npm install
npm run prisma:generate
npx prisma migrate deploy --schema=apps/user-service/prisma/schema.prisma
npx prisma migrate deploy --schema=apps/inventory-service/prisma/schema.prisma
npx prisma migrate deploy --schema=apps/review-service/prisma/schema.prisma
npx prisma migrate deploy --schema=apps/product-service/prisma/schema.prisma
npx prisma migrate deploy --schema=apps/config-service/prisma/schema.prisma
npm run start:dev
```

## Script hữu ích

Trong `package.json` có sẵn:

- `npm run build`
- `npm run start:dev`
- `npm run start:prod`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run seed:user-service`

Lưu ý: script `prisma:migrate` hiện chỉ bao gồm `user-service`, `inventory-service`, `review-service`, `product-service`. Nếu cần migrate `config-service`, hãy chạy lệnh `npx prisma migrate deploy --schema=apps/config-service/prisma/schema.prisma` như ở trên.

## API Gateway

Gateway nhận request HTTP và proxy đến đúng service.

| Prefix                | Service           |
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

## Tài liệu API theo service

- [User Service](apps/user-service/API_DOCUMENTATION.md)
- [Product Service](apps/product-service/API_DOCUMENTATION.md)
- [Inventory Service](apps/inventory-service/API_DOCUMENTATION.md)
- [Review Service](apps/review-service/API_DOCUMENTATION.md)
- [Config Service](apps/config-service/API_DOCUMENTATION.md)
- [API Gateway](apps/tmdt/API_DOCUMENTATION.md)

## Ghi chú về database

- `init.sql` chỉ tạo database, không chạy migration Prisma.
- Mỗi service có schema Prisma riêng nên cần migrate riêng từng schema.
- Root `prisma.config.ts` dùng `DATABASE_URL` từ môi trường và schema mặc định `prisma/schema.prisma`; với repo này nên luôn truyền `--schema=...` khi migrate hoặc generate theo từng service.
