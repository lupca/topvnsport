import { expect, test, Page } from "@playwright/test";

const getAuthHeaders = async (request) => {
  const loginResponse = await request.post("http://localhost:18100/api/auth/login", {
    data: { username: "admin", password: "password123" }
  });
  const { access_token } = await loginResponse.json();
  return { Authorization: `Bearer ${access_token}` };
};

const login = async (page: Page) => {
  page.on("console", msg => console.log("BROWSER CONSOLE:", msg.text()));
  page.on("pageerror", err => console.log("BROWSER ERROR:", err.message));
  await page.goto("/login");
  await page.getByPlaceholder("Tên đăng nhập").fill("admin");
  await page.getByPlaceholder("Mật khẩu").fill("password123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/");
};

const createTestProduct = async (page: Page, suffix: string) => {
  const authHeaders = await getAuthHeaders(page.request);

  const categoryResponse = await page.request.get("http://localhost:18100/categories", {
    headers: authHeaders
  });
  expect(categoryResponse.ok()).toBeTruthy();
  const categories = await categoryResponse.json();
  const categoryId = categories[0].id;
  const categoryName = categories[0].name;

  const familyResponse = await page.request.get("http://localhost:18100/attribute-families", {
    headers: authHeaders
  });
  expect(familyResponse.ok()).toBeTruthy();
  const families = await familyResponse.json();
  const familyId = families[0].id;
  const familyName = families[0].name;

  const createResponse = await page.request.post("http://localhost:18100/products", {
    headers: authHeaders,
    data: {
      product_code: `RACE-TEST-${suffix}`,
      name: `Test Race Condition ${suffix}`,
      description: "Product for testing race condition fix",
      category_id: categoryId,
      family_id: familyId,
      weight: 100,
      length: 10,
      width: 10,
      height: 10,
      is_pre_order: false,
      dts_days: 7,
      status: "Draft",
      tier_variations: [],
      variants: [
        {
          tier_1_option: null,
          tier_2_option: null,
          sku_code: `RACE-TEST-${suffix}-SKU`,
          price: 100000,
          stock: 10,
        },
      ],
      media: [],
    },
  });
  expect(createResponse.ok()).toBeTruthy();
  
  const product = await createResponse.json();
  return { productId: product.id, categoryId, categoryName, familyId, familyName };
};

test.describe("Product Edit - Category/Family Race Condition Fix", () => {
  
  test("TC1: Category and Family should display correctly on edit page load", async ({ page }) => {
    await login(page);
    
    const suffix = Date.now();
    const { productId, categoryName, familyName } = await createTestProduct(page, String(suffix));

    await page.goto(`/catalog/edit/${productId}`);

    // Wait for form to be ready
    const categorySelect = page.locator('select[name="category_id"]');
    const familySelect = page.locator('select[name="family_id"]');

    // Verify both selects have the correct values selected (not empty/placeholder)
    await expect(categorySelect).not.toHaveValue("0", { timeout: 15000 });
    await expect(familySelect).not.toHaveValue("0", { timeout: 15000 });

    // Verify the displayed text contains the expected names
    const categorySelectedText = await categorySelect.locator("option:checked").textContent();
    const familySelectedText = await familySelect.locator("option:checked").textContent();

    expect(categorySelectedText).toContain(categoryName);
    expect(familySelectedText).toContain(familyName);
  });

  test("TC2: Category and Family should display correctly after multiple page reloads", async ({ page }) => {
    await login(page);
    
    const suffix = Date.now();
    const { productId, categoryName, familyName } = await createTestProduct(page, String(suffix));

    // Reload 5 times and verify each time
    for (let i = 0; i < 5; i++) {
      await page.goto(`/catalog/edit/${productId}`);

      const categorySelect = page.locator('select[name="category_id"]');
      const familySelect = page.locator('select[name="family_id"]');

      // Wait for values to be populated
      await expect(categorySelect).not.toHaveValue("0", { timeout: 15000 });
      await expect(familySelect).not.toHaveValue("0", { timeout: 15000 });

      // Verify correct values
      const categorySelectedText = await categorySelect.locator("option:checked").textContent();
      const familySelectedText = await familySelect.locator("option:checked").textContent();

      expect(categorySelectedText, `Reload ${i + 1}: Category should be selected`).toContain(categoryName);
      expect(familySelectedText, `Reload ${i + 1}: Family should be selected`).toContain(familyName);
    }
  });

  test("TC3: Category and Family should display correctly with slow network", async ({ page }) => {
    await login(page);
    
    const suffix = Date.now();
    const { productId, categoryName, familyName } = await createTestProduct(page, String(suffix));

    // Simulate slow network - delay API responses
    await page.route("**/categories", async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay
      await route.continue();
    });

    await page.route("**/attribute-families", async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5s delay
      await route.continue();
    });

    await page.route("**/products/**", async (route) => {
      if (route.request().method() === "GET") {
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5s delay - product loads faster
        await route.continue();
      } else {
        await route.continue();
      }
    });

    await page.goto(`/catalog/edit/${productId}`);

    const categorySelect = page.locator('select[name="category_id"]');
    const familySelect = page.locator('select[name="family_id"]');

    // Even with slow network, values should eventually appear correctly
    await expect(categorySelect).not.toHaveValue("0", { timeout: 30000 });
    await expect(familySelect).not.toHaveValue("0", { timeout: 30000 });

    const categorySelectedText = await categorySelect.locator("option:checked").textContent();
    const familySelectedText = await familySelect.locator("option:checked").textContent();

    expect(categorySelectedText).toContain(categoryName);
    expect(familySelectedText).toContain(familyName);
  });

  test("TC4: Category and Family should display correctly when product loads before options", async ({ page }) => {
    await login(page);
    
    const suffix = Date.now();
    const { productId, categoryName, familyName } = await createTestProduct(page, String(suffix));

    // Simulate race condition: product loads BEFORE options
    await page.route("**/categories", async (route) => {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Categories load very slow (3s)
      await route.continue();
    });

    await page.route("**/attribute-families", async (route) => {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Families load very slow (3s)
      await route.continue();
    });

    // Product loads immediately (no delay)
    await page.goto(`/catalog/edit/${productId}`);

    const categorySelect = page.locator('select[name="category_id"]');
    const familySelect = page.locator('select[name="family_id"]');

    // This is the CRITICAL test - even when product loads first, values should appear after options load
    await expect(categorySelect).not.toHaveValue("0", { timeout: 30000 });
    await expect(familySelect).not.toHaveValue("0", { timeout: 30000 });

    const categorySelectedText = await categorySelect.locator("option:checked").textContent();
    const familySelectedText = await familySelect.locator("option:checked").textContent();

    expect(categorySelectedText).toContain(categoryName);
    expect(familySelectedText).toContain(familyName);
  });

  test("TC5: Create new product - dropdowns should be selectable", async ({ page }) => {
    await login(page);

    await page.goto("/catalog");
    await expect(page.getByText("Đang tải danh sách sản phẩm...")).not.toBeVisible({ timeout: 60000 });

    await page.getByRole("button", { name: "Thêm 1 sản phẩm mới" }).click();

    const categorySelect = page.locator('select[name="category_id"]');
    const familySelect = page.locator('select[name="family_id"]');

    // Wait for options to load (using nth(1) selector instead of invalid expect.greaterThan syntax)
    await expect(categorySelect.locator("option").nth(1)).toBeAttached({ timeout: 15000 });
    await expect(familySelect.locator("option").nth(1)).toBeAttached({ timeout: 15000 });

    // Select first non-placeholder option
    await categorySelect.selectOption({ index: 1 });
    await familySelect.selectOption({ index: 1 });

    // Verify selection worked
    await expect(categorySelect).not.toHaveValue("0");
    await expect(familySelect).not.toHaveValue("0");
  });

  test("TC6: Duplicate product - Category and Family should be pre-filled", async ({ page }) => {
    await login(page);
    
    const suffix = Date.now();
    const { productId, categoryName, familyName } = await createTestProduct(page, String(suffix));

    // Navigate to duplicate page
    await page.goto(`/catalog/copy/${productId}`);

    const categorySelect = page.locator('select[name="category_id"]');
    const familySelect = page.locator('select[name="family_id"]');

    // Values should be pre-filled from source product
    await expect(categorySelect).not.toHaveValue("0", { timeout: 15000 });
    await expect(familySelect).not.toHaveValue("0", { timeout: 15000 });

    const categorySelectedText = await categorySelect.locator("option:checked").textContent();
    const familySelectedText = await familySelect.locator("option:checked").textContent();

    expect(categorySelectedText).toContain(categoryName);
    expect(familySelectedText).toContain(familyName);
  });

});
