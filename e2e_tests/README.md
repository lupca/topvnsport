# E2E Tests

Bộ test này chạy trên môi trường live local/CI bằng `pytest-playwright` + `httpx`.

## Chạy local

1. Khởi động toàn bộ hệ thống:

```bash
./start_all.sh --no-watch
```

2. Cài dependencies E2E:

```bash
python -m pip install -r e2e_tests/requirements.txt
python -m playwright install chromium
```

3. Chạy test full flow:

```bash
pytest e2e_tests/tests/test_full_flow.py -v -s --headed
```

Nếu muốn chạy cả bộ E2E trong thư mục này:

```bash
pytest e2e_tests/ -v
```

## Biến môi trường

- `E2E_WEB_BASE_URL`: mặc định `http://localhost:13103`
- `E2E_PMI_API_URL`: mặc định `http://localhost:18100`
- `E2E_OMS_API_URL`: mặc định `http://localhost:18101`
- `E2E_WMS_API_URL`: mặc định `http://localhost:18102`
