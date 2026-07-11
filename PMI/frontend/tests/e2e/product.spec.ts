import { expect, test } from "@playwright/test";

const buildUploadFile = (name: string) => ({
  name,
  mimeType: "image/png",
  buffer: Buffer.from("fake-image-content"),
});

test("create product with image upload flow", async ({ page }) => {
  await page.route("**/pmi-api/upload", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ image_url: "https://example.com/uploaded-image.png" }),
    });
  });

  const suffix = Date.now();
  const productName = `Ao test e2e ${suffix}`;
  const parentSku = `E2E-${suffix}`;

  const familyResponse = await page.request.get("http://localhost:18101/attribute-families");
  expect(familyResponse.ok()).toBeTruthy();
  const families = await familyResponse.json();
  expect(families.length).toBeGreaterThan(0);

  await page.goto("/catalog");
  await expect(page.getByText("Đang tải danh sách sản phẩm...")).not.toBeVisible({ timeout: 60000 });

  await page.getByRole("button", { name: "Thêm 1 sản phẩm mới" }).click();

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: "attached" });
  await fileInput.setInputFiles(buildUploadFile("cover.png"));

  await page.getByPlaceholder("Nhập tên sản phẩm (Ví dụ: Áo thun nam Cotton 100% cổ tròn)").fill(productName);
  await page.getByPlaceholder("Ví dụ: TSHIRT-PARENT").fill(parentSku);
  await page.locator('select[name="category_id"]').selectOption({ index: 1 });
  await page.locator('select[name="family_id"]').selectOption(String(families[0].id));
  await page
    .getByPlaceholder("Mô tả thông tin chi tiết về sản phẩm của bạn (chất liệu, công dụng, thông số kỹ thuật...)")
    .fill("Mo ta san pham e2e dai hon 10 ky tu");

  await page.locator('input[name="weight"]').fill("500");
  await page.locator('input[name="variants.0.barcode"]').fill(`${parentSku}-BARCODE`);
  await page.locator('input[name="variants.0.price"]').fill("150000");
  await page.locator('input[name="variants.0.stock"]').fill("9");

  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/products") && response.request().method() === "POST"
  );

  await page.getByRole("button", { name: "Lưu & Hiển thị" }).click();

  const createResponse = await createResponsePromise;
  if (!createResponse.ok()) {
    const errorBody = await createResponse.json();
    throw new Error(`API Error: ${JSON.stringify(errorBody)}`);
  }
  expect(createResponse.ok()).toBeTruthy();
  expect(createResponse.ok()).toBeTruthy();

  await expect(page.getByRole("heading", { name: "Danh Sách Sản Phẩm", exact: true })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(parentSku)).toBeVisible();
});

test("edit existing product", async ({ page }) => {
  const suffix = Date.now();
  const parentSku = `EDIT-${suffix}`;
  const originalName = `Ao edit goc ${suffix}`;
  const updatedName = `Ao edit moi ${suffix}`;

  const categoryResponse = await page.request.get("http://localhost:18101/categories");
  expect(categoryResponse.ok()).toBeTruthy();
  const categories = await categoryResponse.json();
  expect(categories.length).toBeGreaterThan(0);
  const categoryId = categories[0].id;

  const familyResponse = await page.request.get("http://localhost:18101/attribute-families");
  expect(familyResponse.ok()).toBeTruthy();
  const families = await familyResponse.json();
  expect(families.length).toBeGreaterThan(0);
  const familyId = families[0].id;

  const createResponse = await page.request.post("http://localhost:18101/products", {
    data: {
      product_code: parentSku,
      name: originalName,
      description: "Mo ta du do dai toi thieu cho test edit",
      category_id: categoryId,
      family_id: familyId,
      weight: 250,
      length: 30,
      width: 20,
      height: 5,
      is_pre_order: false,
      dts_days: 7,
      status: "Draft",
      tier_variations: [],
      variants: [
        {
          tier_1_option: null,
          tier_2_option: null,
          sku_code: `${parentSku}-BASE`,
          price: 100000,
          stock: 5,
        },
      ],
      media: [],
    },
  });
  expect(createResponse.ok()).toBeTruthy();

  await page.goto("/catalog");
  await expect(page.getByText("Đang tải danh sách sản phẩm...")).not.toBeVisible({ timeout: 60000 });

  await page.getByPlaceholder("Tìm Tên sản phẩm, SKU sản phẩm, SKU phân loại...").fill(parentSku);

  const filterResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/products") &&
      response.url().includes("q=") &&
      response.request().method() === "GET"
  );
  await page.getByRole("button", { name: "Áp dụng" }).click();
  await filterResponsePromise;

  const row = page.locator("tr", { hasText: parentSku }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.getByRole("button", { name: "Cập nhật" }).click();

  await page.getByPlaceholder("Nhập tên sản phẩm (Ví dụ: Áo thun nam Cotton 100% cổ tròn)").fill(updatedName);
  const updateResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/products/") && response.request().method() === "PUT"
  );
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  const updateResponse = await updateResponsePromise;
  expect(updateResponse.ok()).toBeTruthy();

  await expect(page.getByRole("heading", { name: "Danh Sách Sản Phẩm", exact: true })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("Đang tải danh sách sản phẩm...")).not.toBeVisible({ timeout: 60000 });

  const searchInput = page.getByPlaceholder("Tìm Tên sản phẩm, SKU sản phẩm, SKU phân loại...");
  await searchInput.fill(parentSku);
  await expect(searchInput).toHaveValue(parentSku);

  const finalFilterResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/products") &&
      response.url().includes("q=") &&
      response.request().method() === "GET"
  );
  await page.getByRole("button", { name: "Áp dụng" }).click();
  await finalFilterResponsePromise;

  await expect(page.getByText(updatedName)).toBeVisible();
});
