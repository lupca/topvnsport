# API key theo nhà bán hàng (seller API key)

Tài liệu này mô tả cơ chế API key dùng cho ứng dụng bên ngoài (ví dụ **VOMA Insights**) đọc dữ liệu VOMA qua Gateway. Mỗi key gắn với **một tenant và một nhà bán hàng (seller)**, chỉ gọi được một danh sách đường dẫn cố định theo phạm vi quyền (scope).

> API key **khác hoàn toàn** với `INTERNAL_SERVICE_TOKEN` (token nội bộ giữa OMS/WMS/PMI/Identity). Xem mục [Phân biệt với token nội bộ](#phân-biệt-với-token-nội-bộ).

## 1. Định dạng và lưu trữ

| Thuộc tính | Giá trị |
|---|---|
| Định dạng | `vk_<env>_<43 ký tự ngẫu nhiên urlsafe>` — `env` là `live` (production) hoặc `test` (dev/test) |
| Sinh key | `secrets.token_urlsafe(32)` (256 bit ngẫu nhiên) |
| Lưu trong DB | **chỉ** `key_hash` = SHA-256 (hex) của toàn bộ key; `prefix` (`vk_<env>_` + 8 ký tự ngẫu nhiên đầu, để nhận diện); `last4` |
| Gắn với | `tenant_id`, `seller_id`, `name`, `scopes`, `created_by`, `created_at`, `last_used_at`, `revoked_at`, `expires_at` (tuỳ chọn) |
| Bảng | `api_keys` (Identity, migration `20261109_000001`) |

Key đầy đủ chỉ xuất hiện **một lần** trong phản hồi tạo key. Sau đó không ai (kể cả quản trị viên) xem lại được.

`env` của key mới lấy từ biến `API_KEY_ENV` (`live`/`test`); nếu không đặt: `live` khi `ENV=production`, ngược lại `test`.

## 2. Phạm vi quyền (scope) và danh sách đường dẫn được phép

Đường dẫn tính theo Gateway (khớp **chính xác**, chỉ cho phép thêm một dấu `/` cuối; query string tự do):

| Scope | Nhãn trên UI | Method + đường dẫn |
|---|---|---|
| `insights:read` | Đọc dữ liệu cho VOMA Insights | `GET /api/pmi/products`, `GET /api/oms/orders`, `GET /api/wms/inbound-shipments` |
| `inbound:write` | Tạo phiếu nhập nháp | `POST /api/wms/inbound-shipments` |

Mọi đường dẫn/method khác (kể cả `GET /api/oms/orders/123`, `/api/identity/*`, đường dẫn mã hoá `%6F` hay có `..`) đều bị từ chối với API key. Danh sách nằm trong `identity-service/backend/utils/api_keys.py` (`API_KEY_ROUTE_RULES`).

## 3. Tạo, xem, thu hồi key

Chỉ **quản trị viên của tenant** (vai trò `admin` hoặc có quyền `identity:*` / `*`, giống trang Nhân sự) mới thao tác được, và chỉ với seller thuộc tenant của mình.

### Giao diện

Identity → menu **API key** (`/api-keys`):

1. Bấm **Tạo API key**, nhập tên gợi nhớ, chọn nhà bán hàng, tích quyền, (tuỳ chọn) ngày hết hạn.
2. Hộp thoại hiển thị key đầy đủ **một lần** kèm nút **Sao chép** và cảnh báo. Dán ngay vào ứng dụng đích (ví dụ trang Kết nối của VOMA Insights).
3. Danh sách chỉ hiển thị `prefix…last4`, seller, quyền, trạng thái (đang hoạt động / đã thu hồi / đã hết hạn), lần dùng cuối.
4. **Thu hồi** có hộp thoại xác nhận; có hiệu lực ngay ở request kế tiếp.

### API (Identity, qua Gateway `/api/identity/…` hoặc trực tiếp)

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@123"}' | jq -r .access_token)

# Danh sách seller của tenant (để chọn seller_id)
curl -s http://localhost:8080/api/identity/sellers/ -H "Authorization: Bearer $TOKEN"

# Tạo key (phản hồi 201 chứa "key" đầy đủ – chỉ một lần)
curl -s -X POST http://localhost:8080/api/identity/api-keys/ \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"VOMA Insights","seller_id":"<uuid>","scopes":["insights:read"],"expires_at":null}'

# Liệt kê (không bao giờ trả key/hash)
curl -s http://localhost:8080/api/identity/api-keys/ -H "Authorization: Bearer $TOKEN"

# Thu hồi (idempotent)
curl -s -X POST http://localhost:8080/api/identity/api-keys/<id>/revoke -H "Authorization: Bearer $TOKEN"
```

Lỗi: seller không thuộc tenant → 404; seller bị khoá hoặc `expires_at` ở quá khứ → 400; scope lạ / danh sách rỗng → 422; không phải admin → 403.

## 4. Gateway kiểm tra key như thế nào

```
Client ──X-API-Key: vk_…──► Nginx (auth_request) ──► Identity GET /auth/verify
                                 │   (X-Original-Method, X-Original-URI, X-API-Key, X-Seller-Id)
                                 │◄── 200 + X-User-*, X-Tenant-Id, X-Tenant-Code, X-Seller-Id
                                 │    401 / 403 → Gateway trả lỗi JSON, không gọi backend
                                 ▼
                     Backend (PMI/OMS/WMS) nhận đúng các header như request của nhân viên;
                     X-API-Key bị xoá, X-Tenant-Id / X-Seller-Id luôn lấy từ Identity
```

Identity (`/auth/verify`):

1. Nếu `X-API-Key` bắt đầu bằng `vk_` → nhánh API key; ngược lại xử lý JWT như trước (giá trị `X-API-Key` khác bị bỏ qua, không bao giờ xác thực được request từ bên ngoài).
2. Gửi đồng thời API key và `Authorization` → **401**.
3. Key sai định dạng / không tồn tại / đã thu hồi / hết hạn, hoặc tenant/seller bị khoá → **401**.
4. Có `X-Seller-Id` mà khác seller của key → **403**.
5. Method + đường dẫn ngoài danh sách, hoặc key thiếu scope tương ứng → **403**.
6. Hợp lệ → **200** với `X-User-Id: apikey:<id>`, `X-User-Username: apikey:<prefix>`, `X-User-Role: api_key`, `X-User-Permissions:` (rỗng), `X-Tenant-Id`, `X-Tenant-Code`, `X-Seller-Id` = seller của key. Cập nhật `last_used_at` tối đa 1 lần/phút (`API_KEY_LAST_USED_THROTTLE_SECONDS`, mặc định 60).

Với JWT, Identity trả lại nguyên giá trị `X-Seller-Id` client gửi (hành vi cũ), nên Gateway luôn có thể forward `X-Seller-Id` từ phản hồi của Identity cho mọi loại xác thực.

Gateway (`gateway/nginx/conf.d/locations.conf`, `locations.prod.conf`) trên mọi location có `auth_request`:

- `auth_request_set $auth_seller_id $upstream_http_x_seller_id;` và `proxy_set_header X-Seller-Id $auth_seller_id;` — header `X-Seller-Id` của client **không bao giờ** đi thẳng xuống backend.
- `proxy_set_header X-Tenant-Id $auth_tenant_id;` (dev trước đây chưa ghi đè – nay đã ghi đè).
- `proxy_set_header X-API-Key "";` — key không bao giờ tới backend.
- `error_page 403 = @auth_forbidden;` trả JSON 403.

### Base URL

| Môi trường | Base URL cho tích hợp | Ghi chú |
|---|---|---|
| Dev | `http://localhost:8080` | `/api/pmi/…`, `/api/oms/…`, `/api/wms/…` |
| Production | `https://api-identity.voma.vn` | Các location `/api/pmi/`, `/api/oms/`, `/api/wms/` mới trên host này (dùng chung chứng chỉ hiện có). Các host theo dịch vụ (`api-oms.voma.vn/orders`, `oms.voma.vn/oms-api/…`) **luôn từ chối** API key (403). |

### Ví dụ curl

```bash
KEY=vk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
BASE=https://api-identity.voma.vn   # dev: http://localhost:8080

curl -s "$BASE/api/oms/orders?page=1&limit=100&updated_since=2026-11-01T00:00:00Z" -H "X-API-Key: $KEY"
curl -s "$BASE/api/pmi/products?page=1&limit=100" -H "X-API-Key: $KEY"
curl -s "$BASE/api/wms/inbound-shipments" -H "X-API-Key: $KEY"

# Cần scope inbound:write
curl -s -X POST "$BASE/api/wms/inbound-shipments" -H "X-API-Key: $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"status":"pending","supplier_name":"NCC A","note":"Tạo từ VOMA Insights","warehouse_id":1,"items":[{"sku_code":"SKU-1","product_name":"Áo","expected_qty":10,"unit_cost":50000}]}'

# Kết quả mong đợi khi sai: 401 (key sai/thu hồi/hết hạn), 403 (thiếu scope, đường dẫn ngoài danh sách, X-Seller-Id khác seller của key)
```

Không cần gửi `X-Seller-Id`; nếu gửi thì phải đúng seller của key.

## 5. Phân biệt với token nội bộ

| | Seller API key | `INTERNAL_SERVICE_TOKEN` |
|---|---|---|
| Ai dùng | Ứng dụng bên ngoài, qua Gateway | OMS ↔ WMS ↔ PMI ↔ Identity (mạng Docker nội bộ, `/internal/*`) |
| Định dạng | luôn bắt đầu `vk_` | bất kỳ, **cấm** bắt đầu bằng `vk_` (service dừng khi khởi động nếu vi phạm) |
| Kiểm tra | Identity `/auth/verify` | từng backend so sánh hằng thời gian (`secrets.compare_digest`) |
| Cấu hình | DB Identity | biến môi trường **bắt buộc**, không còn giá trị mặc định trong code; thiếu → service báo lỗi rõ ràng khi khởi động |

- Backend nhận `X-API-Key: vk_…` trực tiếp → 401 ("External API keys are only accepted through the gateway").
- Gateway xoá `X-API-Key` trên các route có `auth_request`, nên token nội bộ cũng không thể dùng từ ngoài Internet.
- OMS gửi `PIM_API_KEY` khi gọi PMI/WMS; nếu không đặt thì dùng chính `INTERNAL_SERVICE_TOKEN`.
- PMI kiểm tra seller thuộc tenant qua `IDENTITY_SELLER_VALIDATION_URL` → Identity `GET /internal/sellers/{seller_id}?tenant_id=…` (xác thực bằng `INTERNAL_SERVICE_TOKEN`; Identity cần biến này, nếu thiếu endpoint trả 503). Gateway prod chặn `/internal/` và `/identity-api/internal/` từ bên ngoài (404).

## 6. Lưu ý bảo mật

- **Băm**: chỉ lưu SHA-256 của key; key có 256 bit ngẫu nhiên nên không cần salt/KDF chậm. Lộ DB không lộ key.
- **Hiển thị một lần**: key đầy đủ chỉ trả trong phản hồi tạo. Mất key → thu hồi và tạo key mới.
- **Thu hồi**: `revoked_at` được kiểm tra ở mọi request (không cache) → hiệu lực ngay.
- **Xoay vòng (rotation)**: tạo key mới cho cùng seller → cập nhật ứng dụng đích → kiểm tra `last_used_at` của key mới tăng → thu hồi key cũ. Có thể đặt `expires_at` để buộc xoay vòng định kỳ.
- **Phạm vi tối thiểu**: chỉ cấp `inbound:write` khi thật sự cần tạo phiếu nhập nháp.
- **Không gửi key qua chat/email**; ứng dụng đích phải lưu key mã hoá phía server, không lưu ở trình duyệt.
- **Backend chỉ được truy cập qua Gateway.** OMS/WMS lấy seller từ header `X-Seller-Id` và tin các header `X-User-*`/`X-Tenant-Id` do Gateway chèn. Nếu cổng backend (18100/18101/18102, hoặc 8000/8001/8002 trong mạng Docker) lộ ra ngoài, kẻ tấn công có thể tự đặt các header này. Trong production không được publish các cổng backend ra Internet; chỉ Gateway (80/443) được mở.
- Nhật ký: Identity ghi log khi tạo/thu hồi key (không ghi key). Backend thấy người gọi là `apikey:<prefix>` trong `X-User-Username`.

## 7. Cấu hình & kiểm thử

Biến môi trường liên quan:

| Biến | Service | Ghi chú |
|---|---|---|
| `INTERNAL_SERVICE_TOKEN` | OMS, WMS, PMI (bắt buộc); Identity (cho `/internal/*`) | dev compose có giá trị dev; prod lấy từ secret |
| `PIM_API_KEY` | OMS (tuỳ chọn) | mặc định = `INTERNAL_SERVICE_TOKEN` |
| `API_KEY_ENV` | Identity | `live` / `test` |
| `API_KEY_LAST_USED_THROTTLE_SECONDS` | Identity | mặc định 60 |
| `IDENTITY_SELLER_VALIDATION_URL` | PMI | dev: `http://identity-api:8000/internal/sellers/{seller_id}`, prod: `http://identity-api-prod:8000/internal/sellers/{seller_id}` |

Kiểm thử Identity (SQLite mặc định, hoặc Postgres):

```bash
cd identity-service/backend
pytest tests/test_api_keys.py
BYPASS_TESTCONTAINERS=true TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/identity_apikey_test pytest
```
