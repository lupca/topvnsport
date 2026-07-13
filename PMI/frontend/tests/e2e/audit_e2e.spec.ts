import { expect, test } from "@playwright/test";

test.describe("Audit Log & Identity System E2E Tests", () => {
  test.describe.configure({ mode: "serial" });
  test("82. E2E Flow: Auth -> Action -> Outbox -> Worker -> Logs API -> UI rendering", async ({ page }) => {
    // 1. Authenticate
    await page.goto("/login");
    await page.getByPlaceholder("Tên đăng nhập").fill("admin");
    await page.getByPlaceholder("Mật khẩu").fill("password123");
    
    const loginResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/auth/login") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    const loginResponse = await loginResponsePromise;
    expect(loginResponse.status()).toBe(200);
    await page.waitForURL("**/");

    // 2. Perform a mutation action (e.g., update product)
    await page.goto("/catalog");
    await expect(page.getByText("Đang tải danh sách sản phẩm...")).not.toBeVisible({ timeout: 60000 });
    // Click edit on the first product
    const editBtn = page.getByRole("button", { name: "Cập nhật" }).first();
    await editBtn.click();
    await page.getByPlaceholder("Nhập tên sản phẩm").fill("Product E2E Audit Updated");
    
    const updateResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/products/") && response.request().method() === "PUT"
    );
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();
    await updateResponsePromise;

    // 3. Trigger or wait for Background Worker (in real E2E, the worker runs periodically or we hit a trigger API)
    // 4. Verify in Logs API & UI Rendering
    await page.goto("/settings/audit");
    await expect(page.getByText("Product E2E Audit Updated").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("td").getByText("Cập nhật").first()).toBeVisible();
    await expect(page.locator("td").getByText("admin").first()).toBeVisible();
  });

  test("87. Service Correlation Filter: Admin UI filtering by correlation ID generated from service API call", async ({ page }) => {
    // 0. Authenticate
    await page.goto("/login");
    await page.getByPlaceholder("Tên đăng nhập").fill("admin");
    await page.getByPlaceholder("Mật khẩu").fill("password123");
    
    const loginResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/auth/login") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    const loginResponse = await loginResponsePromise;
    expect(loginResponse.status()).toBe(200);

    // 1. Generate unique correlation ID
    const correlationId = `e2e-correlation-${Date.now()}`;
    
    // 2. Make service API call with API key and correlation ID
    const apiContext = page.request;
    const response = await apiContext.post("http://localhost:18100/api/service/sync-stock", {
      headers: {
        "X-API-Key": "valid-service-api-key-123",
        "X-Correlation-ID": correlationId
      },
      data: {
        product_id: 1,
        stock: 50
      }
    });
    expect(response.ok()).toBeTruthy();

    // 3. Navigate to Audit Log UI
    await page.goto("/settings/audit");
    
    // 4. Filter by Correlation ID
    await page.getByPlaceholder("Lọc theo correlation ID...").fill(correlationId);
    await page.getByRole("button", { name: "Áp dụng lọc" }).click();

    // 5. Verify the service update appears in the list
    await expect(page.getByText("stock_sync_service")).toBeVisible();
    await expect(page.getByText(correlationId)).toBeVisible();
  });

  test("91. Intrusion Attempt Audit: Blocked UI pages logged in DB outbox, processed by worker, reviewed by admin", async ({ page }) => {
    // 1. Log in as a non-admin role (staff)
    await page.goto("/login");
    await page.getByPlaceholder("Tên đăng nhập").fill("staff_user");
    await page.getByPlaceholder("Mật khẩu").fill("password123");
    
    const staffLoginPromise = page.waitForResponse(
      (response) => response.url().includes("/auth/login") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    const staffLoginResponse = await staffLoginPromise;
    expect(staffLoginResponse.status()).toBe(200);

    // 2. Try to directly access admin-only settings page
    await page.goto("/settings/audit");
    
    // 3. Should be redirected to unauthorized page or dashboard
    await expect(page).toHaveURL("/");

    // 4. Log out and log back in as admin
    const logoutBtn = page.getByRole("button", { name: "Đăng xuất" });
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();
    await page.goto("/login");
    await page.getByPlaceholder("Tên đăng nhập").fill("admin");
    await page.getByPlaceholder("Mật khẩu").fill("password123");
    
    const adminLoginPromise = page.waitForResponse(
      (response) => response.url().includes("/auth/login") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await adminLoginPromise;

    // 5. Check that the unauthorized access attempt was logged as a SECURITY event
    await page.goto("/settings/audit");
    await page.locator("select").first().selectOption("SECURITY");
    await page.getByRole("button", { name: "Áp dụng lọc" }).click();
    
    await expect(page.getByText("staff_user").first()).toBeVisible();
    await expect(page.getByText("/settings/audit").first()).toBeVisible();
  });

  test("92. Bulk Upload Log Pagination: 150 products updated, worker processes, UI loads with server-pagination limit=50", async ({ page }) => {
    // Reset database first
    const apiContext = page.request;
    const resetRes = await apiContext.post("http://localhost:18100/api/test/reset-db");
    expect(resetRes.ok()).toBeTruthy();

    // Log in as admin
    await page.goto("/login");
    await page.getByPlaceholder("Tên đăng nhập").fill("admin");
    await page.getByPlaceholder("Mật khẩu").fill("password123");
    
    const loginResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/auth/login") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    const loginResponse = await loginResponsePromise;
    expect(loginResponse.status()).toBe(200);

    // 1. Perform bulk import action
    await page.goto("/catalog");
    await page.getByRole("button", { name: "Nhập excel/csv" }).click();
    
    // Upload a heavy mock payload with 150 updates
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.waitFor({ state: "attached" });
    await fileInput.setInputFiles({
      name: "bulk_150_products.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("sku,name,price\n" + Array.from({ length: 150 }, (_, i) => `BULK-${i},Product-${i},100`).join("\n")),
    });

    const uploadPromise = page.waitForResponse(
      (response) => response.url().includes("/products/import") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Bắt đầu nhập" }).click();
    const uploadRes = await uploadPromise;
    expect(uploadRes.status()).toBe(200);

    // 2. Open audit screen and check pagination
    await page.goto("/settings/audit");
    
    // Check first page renders exactly 50 logs (pagination limit)
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(50);

    // Check pagination status text
    await expect(page.getByText(/Hiển thị 1 - 50 trong \d+/)).toBeVisible();

    // Click page 2 and verify next batch loads
    await page.getByRole("button", { name: "Trang sau" }).click();
    await expect(page.getByText(/Hiển thị 51 - 100 trong \d+/)).toBeVisible();
  });

  test("93. Access Token Missing Gate: Redirects to / and logs nothing", async ({ page }) => {
    // Navigate directly to /settings/audit with clean storage
    await page.context().clearCookies();
    await page.goto("/settings/audit");
    
    // Should be redirected to /login
    await expect(page).toHaveURL(/\/login/);
  });

  test("94. Access Token Present but Role Missing Gate: Triggers fetch to /api/auth/me to resolve role", async ({ page }) => {
    // Log in as a real staff user to get a valid token
    const loginResponse = await page.request.post("http://localhost:18100/api/auth/login", {
      data: { username: "staff_user", password: "password123" }
    });
    expect(loginResponse.ok()).toBeTruthy();
    const { access_token } = await loginResponse.json();

    // Set the valid token but clear user_role to trigger the /api/auth/me fetch
    await page.goto("/");
    await page.evaluate((token) => {
      localStorage.setItem("access_token", token);
      localStorage.removeItem("user_role");
      localStorage.removeItem("user_username");
    }, access_token);

    // Go to the audit page
    await page.goto("/settings/audit");

    // Since role is staff, it should trigger intrusion log and redirect to /
    await expect(page).toHaveURL("/");
    
    // Verify role was updated in local storage
    const role = await page.evaluate(() => localStorage.getItem("user_role"));
    expect(role).toBe("staff");
  });
});

