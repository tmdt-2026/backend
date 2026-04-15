# Product Service — Tài Liệu API

> Service: Product Service
> Base URL: `http://localhost:3004/api/v1`
> Transport: HTTP + RabbitMQ
> Content-Type: `application/json`

## Tổng quan

Product Service quản lý sản phẩm, biến thể, giá và trạng thái hoạt động. HTTP API trả JSON trực tiếp từ controller/service, không có lớp `success/data` wrapper.

## HTTP API

| Method   | Path                                  | Auth   | Mô tả                                                        |
| -------- | ------------------------------------- | ------ | ------------------------------------------------------------ |
| `POST`   | `/products`                           | Bearer | Tạo sản phẩm mới cùng danh sách variants                     |
| `GET`    | `/products`                           | Public | Danh sách sản phẩm, hỗ trợ lọc theo `categoryId`, `isActive` |
| `GET`    | `/products/:id`                       | Public | Lấy chi tiết sản phẩm                                        |
| `PATCH`  | `/products/:id`                       | Bearer | Cập nhật sản phẩm                                            |
| `DELETE` | `/products/:id`                       | Bearer | Xoá mềm sản phẩm và variants                                 |
| `PATCH`  | `/products/variants/:variantId`       | Bearer | Cập nhật variant                                             |
| `PATCH`  | `/products/variants/:variantId/price` | Bearer | Cập nhật giá variant và ghi lịch sử                          |

### Body quan trọng

`POST /products`

```json
{
  "name": "iPhone 16 Pro",
  "modelId": "101",
  "categoryId": "5",
  "imgUrl": "https://cdn.example.com/products/iphone-16-pro.jpg",
  "description": "Mẫu điện thoại cao cấp",
  "variants": [
    {
      "color": "Natural Titanium",
      "ram": 8,
      "storage": 256,
      "importPrice": 25000000,
      "price": 29990000,
      "stockQuantity": 20,
      "isActive": true
    }
  ]
}
```

`PATCH /products/variants/:variantId/price`

```json
{
  "price": 31990000,
  "reason": "Điều chỉnh theo bảng giá mới",
  "changedBy": "user-id-uuid"
}
```

## Filter và quy ước

- `GET /products?categoryId=...&isActive=true|false`
- Xoá sản phẩm là xoá mềm: service gắn `deletedAt` và set `isActive=false`.
- `GET /products/:id` trả sản phẩm kèm variants, category và model.

## RabbitMQ RPC

| cmd                            | Payload                                    | Kết quả                                   |
| ------------------------------ | ------------------------------------------ | ----------------------------------------- |
| `ping`                         | `{}`                                       | Trạng thái service                        |
| `product.get-by-id`            | `{ id }`                                   | `{ success: true, data: product }`        |
| `product.find-all`             | `{ categoryId?, isActive? }`               | Danh sách sản phẩm                        |
| `product.get-variant`          | `{ variantId }`                            | `{ stockQuantity, isActive }`             |
| `product.check-active`         | `{ productId }`                            | Trạng thái tồn tại và active của sản phẩm |
| `product.update-variant-price` | `{ variantId, price, changedBy, reason? }` | Variant đã cập nhật                       |

## Lỗi thường gặp

- `404` khi không tìm thấy sản phẩm hoặc variant.
- `PATCH /products/variants/:variantId/price` yêu cầu `changedBy` hợp lệ.
- `UpdateProductDto` hiện dùng `UUID` cho `categoryId` và `modelId` trong code update, nên client cần gửi đúng định dạng mà validation đang chấp nhận.
