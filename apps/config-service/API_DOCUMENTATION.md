# Config Service — Tài Liệu API

> Service: Config Service
> Base URL: `http://localhost:3011/api/v1`
> Transport: HTTP + RabbitMQ
> Content-Type: `application/json`

## Tổng quan

Config Service quản lý settings và banners dùng chung cho toàn hệ thống. Một phần API public, phần còn lại dành cho admin/staff hoặc service nội bộ. Response HTTP được bọc theo format `success/data`.

## Xác thực

- `GET /config/settings` và `GET /config/banners` là public.
- Các route admin/staff cần JWT Bearer token.
- Các route `/internal/*` cần header `X-Service-Token` khớp `INTERNAL_SERVICE_TOKEN`.

## Settings API

| Method   | Path                            | Auth                  | Mô tả                                   |
| -------- | ------------------------------- | --------------------- | --------------------------------------- | ----------------------------- |
| `GET`    | `/config/settings`              | Public                | Trả settings public ở dạng object phẳng |
| `GET`    | `/config/settings/group/:group` | Bearer + roles `admin | staff`                                  | Danh sách settings theo group |
| `GET`    | `/config/settings/:key`         | Bearer                | Lấy 1 setting theo key                  |
| `POST`   | `/config/settings`              | Bearer + role `admin` | Tạo setting                             |
| `PUT`    | `/config/settings/:key`         | Bearer + role `admin` | Cập nhật setting                        |
| `DELETE` | `/config/settings/:key`         | Bearer + role `admin` | Xoá setting                             |

### Body quan trọng

`POST /config/settings`

```json
{
  "key": "site_name",
  "value": "TMDT Shop",
  "type": "string",
  "group": "general",
  "description": "Tên hiển thị của hệ thống",
  "isPublic": true
}
```

`PUT /config/settings/:key`

```json
{
  "value": "false",
  "settingType": "boolean",
  "description": "Bật/tắt chế độ bảo trì",
  "isPublic": true
}
```

`GET /config/settings/group/:group?includePrivate=true`

- `includePrivate=false` là mặc định.
- Chỉ admin mới có thể lấy private settings của group.

## Banners API

| Method   | Path                              | Auth                  | Mô tả                         |
| -------- | --------------------------------- | --------------------- | ----------------------------- | ------------------------- |
| `GET`    | `/config/banners`                 | Public                | Banner active theo `position` |
| `GET`    | `/config/banners/all`             | Bearer + roles `admin | staff`                        | Danh sách banner quản trị |
| `POST`   | `/config/banners`                 | Bearer + role `admin` | Tạo banner                    |
| `PATCH`  | `/config/banners/reorder`         | Bearer + role `admin` | Sắp xếp lại thứ tự banner     |
| `PUT`    | `/config/banners/:id`             | Bearer + role `admin` | Cập nhật banner               |
| `DELETE` | `/config/banners/:id`             | Bearer + role `admin` | Xoá banner                    |
| `PATCH`  | `/config/banners/:id/toggle`      | Bearer + role `admin` | Bật/tắt banner                |
| `POST`   | `/config/banners/:id/track-click` | Public                | Tăng clickCount               |

### Body quan trọng

`POST /config/banners`

```json
{
  "title": "Khuyến mãi mùa hè",
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

## Internal API

| Method | Path                                   | Mô tả                              |
| ------ | -------------------------------------- | ---------------------------------- |
| `GET`  | `/internal/config/settings/:key`       | Lấy 1 setting kèm giá trị đã parse |
| `GET`  | `/internal/config/settings?keys=a,b,c` | Lấy nhiều setting cùng lúc         |

## Event outbound

- `config.setting_updated`
- `config.maintenance_changed`
- `config.banner_changed`

## Lỗi thường gặp

- `SETTING_NOT_FOUND`
- `SETTING_KEY_EXISTS`
- `SETTING_PROTECTED`
- `SETTING_NOT_PUBLIC`
- `BANNER_NOT_FOUND`
- `BANNER_POSITION_MISMATCH`
- `INVALID_DATES`
