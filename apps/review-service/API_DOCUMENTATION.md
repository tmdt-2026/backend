# Review Service — Tài Liệu API

> Service: Review Service
> Base URL: `http://localhost:3002/api/v1`
> Transport: HTTP + RabbitMQ
> Content-Type: `application/json`

## Tổng quan

Review Service quản lý product reviews và comments. Phần lớn response HTTP được bọc theo format `success/data`; riêng các endpoint public vẫn trả dữ liệu trực tiếp trong `data`.

## Xác thực

- `GET` public không cần token.
- `POST /reviews`, `GET /reviews/me`, `POST/PUT/DELETE/PATCH /comments/*` cần JWT Bearer token.
- Các route admin cần role `admin`.
- Internal endpoint cần `X-Service-Token`.

## Reviews API

| Method  | Path                                 | Auth                     | Mô tả                          |
| ------- | ------------------------------------ | ------------------------ | ------------------------------ | ------ | ------------------ |
| `GET`   | `/reviews/products/:productId`       | Public                   | Danh sách review theo sản phẩm |
| `GET`   | `/reviews/products/:productId/stats` | Public                   | Thống kê rating                |
| `POST`  | `/reviews`                           | Bearer + roles `customer | staff                          | admin` | Tạo review kèm ảnh |
| `GET`   | `/reviews/me`                        | Bearer + roles `customer | staff                          | admin` | Review của tôi     |
| `GET`   | `/reviews`                           | Bearer + role `admin`    | Danh sách review quản trị      |
| `PATCH` | `/reviews/:id/visibility`            | Bearer + role `admin`    | Ẩn/hiện review                 |

### Body quan trọng

`POST /reviews` là `multipart/form-data`:

- Form fields: `orderId`, `productId`, `rating`, `content?`
- Files: field `images`, tối đa 5 file, kích thước mỗi file tối đa 5MB

```json
{
  "orderId": "uuid",
  "productId": "uuid",
  "rating": 5,
  "content": "Sản phẩm đúng mô tả, đóng gói tốt"
}
```

`PATCH /reviews/:id/visibility`

```json
{
  "isVisible": false,
  "adminNote": "Nội dung không phù hợp"
}
```

### Stats response

`GET /reviews/products/:productId/stats` trả:

```json
{
  "productId": "uuid",
  "average": 4.8,
  "totalCount": 120,
  "distribution": { "five": 90, "four": 20, "three": 6, "two": 3, "one": 1 },
  "percentages": { "five": 75, "four": 17, "three": 5, "two": 2, "one": 1 }
}
```

## Comments API

| Method   | Path                            | Auth                     | Mô tả                             |
| -------- | ------------------------------- | ------------------------ | --------------------------------- | ----------- | --------------- |
| `GET`    | `/comments/products/:productId` | Public                   | Cây comment theo sản phẩm         |
| `POST`   | `/comments`                     | Bearer + roles `customer | staff                             | admin`      | Tạo comment gốc |
| `POST`   | `/comments/:id/reply`           | Bearer + roles `customer | staff                             | admin`      | Trả lời comment |
| `PUT`    | `/comments/:id`                 | Bearer + role `customer` | Sửa comment trong cửa sổ cho phép |
| `DELETE` | `/comments/:id`                 | Bearer + roles `customer | admin`                            | Xoá comment |
| `PATCH`  | `/comments/:id/visibility`      | Bearer + role `admin`    | Ẩn/hiện comment                   |

### Body quan trọng

`POST /comments`

```json
{
  "productId": "uuid",
  "content": "Mình muốn hỏi thêm về kích thước hộp sản phẩm"
}
```

`POST /comments/:id/reply`

```json
{ "content": "Bên mình sẽ phản hồi trong hôm nay" }
```

### Quy ước comment

- Comment tree có tối đa 3 tầng tính cả root.
- Cửa sổ sửa comment mặc định là 15 phút, cấu hình qua `app.commentEditWindowMs`.
- `GET /comments/products/:productId` chỉ trả comment visible.

## Internal API

| Method | Path                                          | Mô tả                      |
| ------ | --------------------------------------------- | -------------------------- |
| `GET`  | `/internal/reviews/products/:productId/stats` | Lấy thống kê review nội bộ |

## RabbitMQ events outbound

- `review.created`
- `comment.replied`

## Lỗi thường gặp

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
