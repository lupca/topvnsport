import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class ProductPage extends BasePage {
  readonly titleInput: Locator;
  readonly priceInput: Locator;
  readonly submitButton: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    super(page);
    // These selectors are examples and should match your actual UI
    this.titleInput = page.getByLabel(/Product Name/i);
    this.priceInput = page.getByLabel(/Price/i);
    this.submitButton = page.getByRole('button', { name: /Save Product/i });
    this.successMessage = page.getByText(/Product saved successfully/i);
  }

  async gotoCreateProduct() {
    await this.navigate('/products/create');
    await this.waitForNetworkIdle();
  }

  async createProduct(title: string, price: string) {
    await this.fillInput(this.titleInput, title);
    await this.fillInput(this.priceInput, price);
    await this.clickButton(this.submitButton);
  }
}
