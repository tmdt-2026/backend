# Product Service - API Documentation

> Service: Product Service
> Base URL: `http://localhost:3004/api/v1`
> Content-Type: `application/json`
> Transport: HTTP + RabbitMQ

## Tong quan

Product Service quan ly danh muc, model, san pham va bien the san pham.

- Service da ap JWT + role guard cho HTTP API.
- Endpoint tao/sua/xoa product, category, model, variant yeu cau role `admin`.
- Response tra truc tiep tu service, khong co wrapper `success/data`.

## Health

| Method | Path      | Auth   | Mo ta         |
| ------ | --------- | ------ | ------------- |
| `GET`  | `/health` | Public | Health check. |

## HTTP API

| Method   | Path                                  | Auth   | Mo ta                                         |
| -------- | ------------------------------------- | ------ | --------------------------------------------- |
| `GET`    | `/products/categories`                | Public | Lay danh sach categories.                     |
| `POST`   | `/products/categories`                | Admin  | Tao category moi.                             |
| `GET`    | `/products/models`                    | Public | Lay danh sach models.                         |
| `POST`   | `/products/models`                    | Admin  | Tao model moi.                                |
| `POST`   | `/products`                           | Admin  | Tao san pham moi kem variants.                |
| `POST`   | `/products/:id/variants`              | Admin  | Tao them variant cho san pham da co.          |
| `GET`    | `/products`                           | Public | Danh sach san pham, ho tro filter.            |
| `GET`    | `/products/category/:categoryId`      | Public | Tim san pham theo category.                   |
| `GET`    | `/products/:id`                       | Public | Lay chi tiet san pham.                        |
| `GET`    | `/products/:id/variants`              | Public | Lay danh sach variant cua 1 san pham.         |
| `PATCH`  | `/products/:id`                       | Admin  | Cap nhat san pham.                            |
| `DELETE` | `/products/:id`                       | Admin  | Xoa mem san pham.                             |
| `GET`    | `/products/variants/:variantId`       | Public | Lay chi tiet 1 variant.                       |
| `PATCH`  | `/products/variants/:variantId`       | Admin  | Cap nhat thong tin variant.                   |
| `PATCH`  | `/products/variants/:variantId/price` | Admin  | Cap nhat gia variant va ghi lich su thay doi. |
| `DELETE` | `/products/variants/:variantId`       | Admin  | Xoa mem variant.                              |

### Query params

`GET /products`

- `categoryId`
- `isActive=true|false`

### Body mau

`POST /products`

```json
{
  "name": "iPhone 16 Pro",
  "modelId": "101",
  "categoryId": "5",
  "imgUrl": "https://cdn.example.com/products/iphone-16-pro.jpg",
  "description": "Mau dien thoai cao cap",
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
  "reason": "Dieu chinh theo bang gia moi",
  "changedBy": "user-id-uuid"
}
```

`POST /products/:id/variants`

```json
{
  "color": "Blue",
  "ram": 8,
  "storage": 128,
  "importPrice": 18000000,
  "originalPrice": 24990000,
  "price": 22990000,
  "stockQuantity": 15,
  "isActive": true
}
```

`PATCH /products/:id`

```json
{
  "name": "iPhone 16 Pro Max",
  "categoryId": "550e8400-e29b-41d4-a716-446655440000",
  "modelId": "550e8400-e29b-41d4-a716-446655440001",
  "description": "Cap nhat thong tin",
  "isActive": true
}
```

Luu y: `UpdateProductDto` dang validate `categoryId` va `modelId` theo UUID, trong khi create cho phep ID chuoi thong thuong.

## RabbitMQ RPC

| Pattern                                   | Payload                                    | Ket qua                            |
| ----------------------------------------- | ------------------------------------------ | ---------------------------------- |
| `{ cmd: 'ping' }`                         | `{}`                                       | Trang thai service                 |
| `{ cmd: 'product.get-by-id' }`            | `{ id }`                                   | `{ success: true, data: product }` |
| `{ cmd: 'product.find-all' }`             | `{ categoryId?, isActive? }`               | Danh sach san pham                 |
| `{ cmd: 'product.get-variant' }`          | `{ variantId }`                            | Thong tin variant                  |
| `{ cmd: 'product.check-active' }`         | `{ productId }`                            | Trang thai ton tai va active       |
| `{ cmd: 'product.update-variant-price' }` | `{ variantId, price, changedBy, reason? }` | Variant da cap nhat                |

## Loi thuong gap

- `404` khi khong tim thay product/variant.
- `PATCH /products/variants/:variantId/price` yeu cau `changedBy`.
