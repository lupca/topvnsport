# Hướng Dẫn Kiểm Thử E2E & Tích Hợp (E2E & Integration Testing Guide)

Tài liệu này hướng dẫn các lập trình viên cách chạy, chỉnh sửa, viết mới các bài kiểm thử E2E (Playwright) và kiểm thử tích hợp (Pytest), cũng như cách hoạt động của hệ thống CI/CD.

---

## 1. Tổng Quan Hệ Thống Kiểm Thử (Testing Overview)

Hệ thống có hai bộ suite kiểm thử tự động chính:
1. **PIM Frontend E2E Tests (Playwright)**:
   - Vị trí: `PMI/frontend/tests/e2e/`
   - Mục tiêu: Kiểm thử các luồng giao diện của hệ thống quản lý sản phẩm (PIM/PMI) như tạo sản phẩm mới, upload ảnh, chỉnh sửa sản phẩm, đồng bộ variant.
2. **System Full-Flow Integration Tests (Pytest + Playwright)**:
   - Vị trí: `e2e_tests/tests/`
   - Mục tiêu: Kiểm thử luồng tích hợp toàn hệ thống (End-to-End) giữa Web Frontend -> PMI -> OMS -> WMS. Tạo sản phẩm ở PMI -> Đồng bộ kho ở WMS -> Khách đặt hàng ở Web -> OMS nhận đơn nháp -> Xác nhận -> WMS nhận đơn xuất kho.

---

## 2. Cách Chạy Test Ở Local (Running Tests Locally)

### 2.1. Chạy Playwright E2E Tests (Dành cho PMI Frontend)

#### Cách 1: Chạy trực tiếp trên máy Host (Khuyên dùng nếu Host có Node.js)
1. Đảm bảo các dịch vụ E2E của PMI đang chạy (API, DB, MinIO):
   ```bash
   docker compose -f PMI/docker-compose.e2e.yml up -d api db minio
   ```
2. Cài đặt các trình duyệt Playwright (nếu chạy lần đầu):
   ```bash
   cd PMI/frontend
   npx playwright install --with-deps
   ```
3. Khởi chạy test:
   ```bash
   npx playwright test
   # Hoặc chỉ chạy trên Chromium:
   npx playwright test --project=chromium
   # Hoặc chạy ở giao diện UI trực quan:
   npx playwright test --ui
   ```

#### Cách 2: Chạy bên trong Docker Container `pim-frontend` (Môi trường Alpine)
Nếu bạn không muốn cài đặt Node/Playwright trên máy host, bạn có thể chạy trực tiếp trong container của frontend. Do container chạy Alpine Linux (sử dụng musl-libc), cần thực hiện các cấu hình tương thích sau:

1. **Chuẩn bị môi trường tương thích và trình duyệt trong Container**:
   ```bash
   # Cài đặt lớp tương thích glibc (gcompat) để chạy các trình duyệt Playwright tải về
   docker exec -u 0 pim-frontend apk add --no-cache gcompat
   # Cài đặt trình duyệt native của Alpine nếu cần (Chromium đã có sẵn, cài thêm Firefox nếu muốn)
   docker exec -u 0 pim-frontend apk add --no-cache firefox
   ```
2. **Khởi động các dịch vụ E2E ở máy Host**:
   ```bash
   # Dừng các container dev trùng cổng nếu có (oms_db, oms_backend)
   docker stop oms_db oms_backend
   # Khởi động cụm dịch vụ E2E
   docker compose -f PMI/docker-compose.e2e.yml up -d api db minio
   ```
3. **Thiết lập Port Proxy bên trong Container**:
   Do E2E API map ra cổng `18101` trên máy Host, còn container `pim-frontend` thuộc mạng dev (`pmi_default`) nên không kết nối trực tiếp được. Chạy lệnh proxy TCP để chuyển tiếp từ cổng `18101` của container về máy Host (`172.19.0.1`):
   ```bash
   docker exec -d pim-frontend node -e "const net = require('net'); net.createServer(s => { const c = net.connect(18101, '172.19.0.1'); s.pipe(c).pipe(s); c.on('error', () => s.destroy()); s.on('error', () => c.destroy()); }).listen(18101, '127.0.0.1')"
   ```
4. **Khởi động E2E Web Server phụ ở cổng 3001**:
   Vì máy chủ dev hiện tại (cổng 3000) đang kết nối với Database dev, cần chạy thêm một instance Next.js ở cổng `3001` trỏ API về cổng E2E (`18101`):
   ```bash
   docker exec -d -w /app pim-frontend env PMI_API_PROXY_TARGET=http://localhost:18101 PORT=3001 npm run dev
   ```
5. **Chạy Test**:
   ```bash
   docker exec -e BASE_URL=http://localhost:3001 -e CHROMIUM_PATH=/usr/bin/chromium pim-frontend npx playwright test --project=chromium
   ```
6. **Dọn dẹp**:
   Sau khi test xong, tắt cụm E2E và khởi động lại dịch vụ dev:
   ```bash
   docker compose -f PMI/docker-compose.e2e.yml down
   docker start oms_db oms_backend
   docker exec pim-frontend pkill -f "PORT=3001"
   docker exec pim-frontend pkill -f "net.connect"
   ```

---

### 2.2. Chạy Python Integration Tests (Toàn Luồng Hệ Thống)

1. Khởi động toàn bộ các dịch vụ trên máy Host:
   ```bash
   ./start_all.sh --no-watch
   ```
2. Kích hoạt môi trường ảo Python và chạy test:
   ```bash
   source venv/bin/activate
   pytest e2e_tests/
   ```

---

## 3. Lưu Ý Quan Trọng Khi Viết & Sửa Code Test (Best Practices)

Để tránh tình trạng test chạy chập chờn (flaky tests) hoặc bị nghẽn (race condition) trên CI/CD, hãy tuân thủ các nguyên tắc sau:

### 3.1. Tránh Race Condition khi Đợi API Response (`waitForResponse`)
Khi trang vừa được tải, một request `GET /products` (không lọc) tự động được bắn ra để load danh sách. Nếu ngay sau đó bạn tìm kiếm và đợi phản hồi bằng cách lắng nghe URL chứa `/products`, Playwright có thể nhận nhầm phản hồi của request đầu tiên (không có kết quả tìm kiếm) dẫn tới lỗi assert.

*   **Sai**:
    ```typescript
    const responsePromise = page.waitForResponse(r => r.url().includes("/products") && r.method() === "GET");
    await page.getByRole("button", { name: "Áp dụng" }).click();
    await responsePromise;
    ```
*   **Đúng (Luôn kiểm tra tham số lọc cụ thể như `q=` hoặc kiểm tra cache-buster)**:
    ```typescript
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes("/products") && r.url().includes("q=") && r.method() === "GET"
    );
    await page.getByRole("button", { name: "Áp dụng" }).click();
    await responsePromise;
    ```

### 3.2. Ngăn Ngừa Browser Caching (Đặc biệt trên Firefox)
Firefox thường lưu cache các request `GET` trùng URL rất mạnh. Khi bạn tìm kiếm cùng một từ khóa (ví dụ: mã SKU cha) trước và sau khi sửa sản phẩm, Firefox có thể trả về dữ liệu cũ từ cache khiến test fail.
*   **Giải pháp**: Frontend đã được tích hợp tham số cache-buster `_t=${Date.now()}` trong file [ProductList.tsx](file:///home/lupca/projects/topvnsport/PMI/frontend/src/components/ProductList.tsx). Hãy đảm bảo bất cứ API `GET` động nào cũng có cơ chế phá cache tương tự.

### 3.3. Xử Lý SKU Tự Động Sinh (Auto-generated SKU)
Backend có thuật toán tự sinh SKU nếu variant SKU để trống.
*   Khi giả lập dữ liệu E2E hoặc kiểm tra kết quả, hãy sử dụng helper `generateSkuCode` trong [skuHelper.ts](file:///home/lupca/projects/topvnsport/PMI/frontend/src/utils/skuHelper.ts) để sinh SKU đồng nhất với backend:
    ```typescript
    import { generateSkuCode } from "@/utils/skuHelper";
    const variantSku = generateSkuCode(parentSku, option1, option2);
    ```

---

## 4. Cấu Hình CI/CD Pipeline (GitHub Actions)

Mỗi khi push code hoặc tạo Pull Request lên nhánh `main`, hai luồng công việc sau sẽ hoạt động:

1. **`test.yml` (PIM Test Pipeline)**:
   - Chạy kiểm thử đơn vị (unit tests) backend bằng `pytest`.
   - Chạy kiểm thử đơn vị (unit tests) frontend bằng `vitest`.
   - Khởi động dịch vụ E2E qua docker-compose và chạy các bài test giao diện Playwright E2E.
   - Báo cáo kết quả kiểm thử và lưu trữ Playwright Traces làm artifact khi có lỗi xảy ra.
2. **`e2e_test.yml` (System Integration Pipeline)**:
   - Dựng toàn bộ hạ tầng (PMI, OMS, WMS, Web Frontend).
   - Chạy luồng tích hợp đặt hàng qua Python Playwright để đảm bảo dữ liệu chạy thông suốt giữa các phòng ban và dịch vụ.
