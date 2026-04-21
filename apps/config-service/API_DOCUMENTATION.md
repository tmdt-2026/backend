# Config Service - API Documentation

> Service: Config Service
> Base URL: `http://localhost:3011/api/v1`
> Content-Type: `application/json`
> Transport: HTTP + RabbitMQ

## Tong quan

Config Service quan ly settings va banners dung chung cho toan he thong.

- Public endpoints: lay settings public, lay banners active, track click banner, health check.
- Auth endpoints: can JWT Bearer token.
- Internal endpoints: can header `X-Service-Token`.

## Xac thuc

- JWT Bearer: `Authorization: Bearer <token>`
- Internal service token: `X-Service-Token: <INTERNAL_SERVICE_TOKEN>`

## Health

| Method | Path      | Auth   | Mo ta         |
| ------ | --------- | ------ | ------------- |
| `GET`  | `/health` | Public | Health check. |

## Settings API

| Method   | Path                            | Auth                      | Mo ta                                  |
| -------- | ------------------------------- | ------------------------- | -------------------------------------- |
| `GET`    | `/config/settings`              | Public                    | Tra settings public dang object phang. |
| `GET`    | `/config/settings/group/:group` | Bearer (`admin`, `staff`) | Lay danh sach settings theo group.     |
| `GET`    | `/config/settings/:key`         | Bearer                    | Lay 1 setting theo key.                |
| `POST`   | `/config/settings`              | Bearer (`admin`)          | Tao setting moi.                       |
| `PUT`    | `/config/settings/:key`         | Bearer (`admin`)          | Cap nhat setting.                      |
| `DELETE` | `/config/settings/:key`         | Bearer (`admin`)          | Xoa setting.                           |

### Query params

- `GET /config/settings/group/:group?includePrivate=true|false`
- Mac dinh `includePrivate=false`.
- Chi `admin` moi duoc lay private settings.

### Body mau

`POST /config/settings`

```json
{
  "key": "site_name",
  "value": "TMDT Shop",
  "type": "string",
  "group": "general",
  "description": "Ten hien thi he thong",
  "isPublic": true
}
```

`PUT /config/settings/:key`

```json
{
  "value": "false",
  "settingType": "boolean",
  "description": "Bat/tat bao tri",
  "isPublic": true
}
```

## Banners API

| Method   | Path                              | Auth                      | Mo ta                                  |
| -------- | --------------------------------- | ------------------------- | -------------------------------------- |
| `GET`    | `/config/banners`                 | Public                    | Lay banners active, filter `position`. |
| `GET`    | `/config/banners/all`             | Bearer (`admin`, `staff`) | Danh sach banners cho quan tri.        |
| `POST`   | `/config/banners`                 | Bearer (`admin`)          | Tao banner moi.                        |
| `PATCH`  | `/config/banners/reorder`         | Bearer (`admin`)          | Sap xep thu tu banner theo position.   |
| `PUT`    | `/config/banners/:id`             | Bearer (`admin`)          | Cap nhat banner.                       |
| `DELETE` | `/config/banners/:id`             | Bearer (`admin`)          | Xoa banner.                            |
| `PATCH`  | `/config/banners/:id/toggle`      | Bearer (`admin`)          | Bat/tat banner (`isActive`).           |
| `POST`   | `/config/banners/:id/track-click` | Public                    | Tang clickCount cho banner.            |

### Query params

- `GET /config/banners?position=home_main`
- `GET /config/banners/all?position=...&isActive=true|false&page=1&limit=20`

### Body mau

`POST /config/banners`

```json
{
  "title": "Khuyen mai mua he",
  "imageUrl": "https://cdn.example.com/banner.jpg",
  "mobileImageUrl": "https://cdn.example.com/banner-mobile.jpg",
  "targetUrl": "/products",
  "altText": "Summer sale",
  "position": "home_main",
  "sortOrder": 1,
  "startDate": "2026-04-01T00:00:00.000Z",
  "endDate": "2026-05-01T00:00:00.000Z",
  "isActive": true
}
```

`PATCH /config/banners/reorder`

```json
{
  "position": "home_main",
  "orderedIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

`PATCH /config/banners/:id/toggle`

```json
{
  "isActive": false
}
```

## Internal API

| Method | Path                                   | Auth              | Mo ta                                          |
| ------ | -------------------------------------- | ----------------- | ---------------------------------------------- |
| `GET`  | `/internal/config/settings/:key`       | `X-Service-Token` | Lay 1 setting va gia tri da parse.             |
| `GET`  | `/internal/config/settings?keys=a,b,c` | `X-Service-Token` | Lay nhieu setting; key khong ton tai tra null. |

## Events outbound

- `config.setting_updated`
- `config.maintenance_changed`
- `config.banner_changed`

## Loi thuong gap

- `SETTING_NOT_FOUND`
- `SETTING_KEY_EXISTS`
- `SETTING_PROTECTED`
- `SETTING_NOT_PUBLIC`
- `BANNER_NOT_FOUND`
- `BANNER_POSITION_MISMATCH`
- `INVALID_DATES`
