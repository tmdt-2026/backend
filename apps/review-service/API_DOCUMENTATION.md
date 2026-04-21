# Review Service - API Documentation

> Service: Review Service
> Base URL: `http://localhost:3002/api/v1`
> Content-Type: `application/json`
> Transport: HTTP + RabbitMQ

## Tong quan

Review Service quan ly reviews va comments cho san pham.

## Xac thuc

Service ap global JWT + roles guard.

- Public: `GET /health`, `GET /reviews/products/:productId`, `GET /reviews/products/:productId/stats`, `GET /comments/products/:productId`
- Customer/Staff/Admin: tao review, tao comment, reply comment, xem review cua toi.
- Admin: xem danh sach reviews, an/hien review, an/hien comment.
- Customer: sua comment cua minh.
- Customer/Admin: xoa comment.
- Internal endpoint can `X-Service-Token`.

## Health

| Method | Path      | Auth   | Mo ta         |
| ------ | --------- | ------ | ------------- |
| `GET`  | `/health` | Public | Health check. |

## Reviews API

| Method  | Path                                 | Auth                          | Mo ta                              |
| ------- | ------------------------------------ | ----------------------------- | ---------------------------------- |
| `GET`   | `/reviews/products/:productId`       | Public                        | Danh sach review theo san pham.    |
| `GET`   | `/reviews/products/:productId/stats` | Public                        | Thong ke rating cua san pham.      |
| `POST`  | `/reviews`                           | Bearer (`customer`,`staff`,`admin`) | Tao review kem anh.      |
| `GET`   | `/reviews/me`                        | Bearer (`customer`,`staff`,`admin`) | Lay review cua toi.      |
| `GET`   | `/reviews`                           | Bearer (`admin`)              | Danh sach review cho quan tri.      |
| `PATCH` | `/reviews/:id/visibility`            | Bearer (`admin`)              | An/hien review.                    |

### Query params

`GET /reviews/products/:productId` va `GET /reviews/me`

- `page` (default `1`)
- `limit` (default `10`, max `50`)
- `rating` (`1..5`)
- `hasImage=true|false`
- `sortBy` (`createdAt|rating`, default `createdAt`)
- `sortOrder` (`asc|desc`, default `desc`)

`POST /reviews` dung `multipart/form-data`:

- Form fields: `orderId`, `productId`, `rating`, `content?`
- Files: field `images`, toi da 5 file, moi file toi da 5MB

## Comments API

| Method   | Path                            | Auth                          | Mo ta                                 |
| -------- | ------------------------------- | ----------------------------- | ------------------------------------- |
| `GET`    | `/comments/products/:productId` | Public                        | Cay comment theo san pham.            |
| `POST`   | `/comments`                     | Bearer (`customer`,`staff`,`admin`) | Tao comment goc.               |
| `POST`   | `/comments/:id/reply`           | Bearer (`customer`,`staff`,`admin`) | Tra loi comment.              |
| `PUT`    | `/comments/:id`                 | Bearer (`customer`)           | Sua comment trong cua so cho phep.    |
| `DELETE` | `/comments/:id`                 | Bearer (`customer`,`admin`)   | Xoa comment.                          |
| `PATCH`  | `/comments/:id/visibility`      | Bearer (`admin`)              | An/hien comment.                      |

`GET /comments/products/:productId` ho tro `page`, `limit`.

## Internal API

| Method | Path                                          | Auth              | Mo ta                                 |
| ------ | --------------------------------------------- | ----------------- | ------------------------------------- |
| `GET`  | `/internal/reviews/products/:productId/stats` | `X-Service-Token` | Lay thong ke noi bo (`productId`, `average`, `total`). |

## Events outbound

- `review.created`
- `comment.replied`

## Loi thuong gap

- `ORDER_NOT_FOUND`
- `NOT_ORDER_OWNER`
- `ORDER_NOT_COMPLETED`
- `PRODUCT_NOT_IN_ORDER`
- `ALREADY_REVIEWED`
- `TOO_MANY_IMAGES`
- `REVIEW_NOT_FOUND`
- `COMMENT_NOT_FOUND`
- `EDIT_WINDOW_EXPIRED`
- `MAX_DEPTH_EXCEEDED`