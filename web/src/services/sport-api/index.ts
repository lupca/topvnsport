import { Blog, Branch, Category, Product, StringOption } from '../../types';
import rawData from '../../data.json';
import { delay, OMS_API_URL, PMI_API_URL, SIMULATED_LATENCY } from './constants';
import { findExistingCustomerIdByPhone, findManualChannel, findStorefrontChannel, getChannels } from './omsHelpers';
import { extractItems, mapPmiProduct } from './productMappers';
import { CreateOrderPayload, OmsChannel, OmsCustomer, OmsCustomerInput, PmiProduct, SendOtpResponse, VerifyOtpResponse } from './types';

async function getCategories(): Promise<Category[]> {
  try {
    const response = await fetch(`${PMI_API_URL}/categories`);
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('Failed to fetch categories:', error);
    return [];
  }
}

async function getProducts(): Promise<Product[]> {
  await delay(SIMULATED_LATENCY);
  try {
    const [response, categories] = await Promise.all([
      fetch(`${PMI_API_URL}/products?limit=100`),
      getCategories()
    ]);

    if (!response.ok) {
      throw new Error(`PMI getProducts failed with status ${response.status}`);
    }

    const data = await response.json();
    const pmiProducts = extractItems<PmiProduct>(data);
    return pmiProducts.map((product) => mapPmiProduct(product, categories));
  } catch (error) {
    console.warn('Failed to fetch products:', error);
    return [];
  }
}

async function getProductById(id: string): Promise<Product | null> {
  await delay(SIMULATED_LATENCY);
  try {
    const [response, categories] = await Promise.all([
      fetch(`${PMI_API_URL}/products/${id}`),
      getCategories()
    ]);

    if (response.ok) {
      const pmiProduct = (await response.json()) as PmiProduct;
      return mapPmiProduct(pmiProduct, categories);
    }

    if (response.status !== 404) {
      throw new Error(`PMI getProductById failed with status ${response.status}`);
    }
  } catch (error) {
    console.error(error);
  }

  const products = await getProducts();
  return products.find((product) => product.id === id) || null;
}

async function getBlogs(): Promise<Blog[]> {
  await delay(SIMULATED_LATENCY);
  return JSON.parse(JSON.stringify(rawData.blogs)) as Blog[];
}

async function getBlogById(id: string): Promise<Blog | null> {
  const blog = rawData.blogs.find((item) => item.id === id);
  return blog ? (JSON.parse(JSON.stringify(blog)) as Blog) : null;
}

async function getBranches(): Promise<Branch[]> {
  return JSON.parse(JSON.stringify(rawData.branches)) as Branch[];
}

function resolveStringType(stiffness: string | undefined): StringOption['type'] {
  const stiffnessLower = stiffness?.toLowerCase() || '';
  if (stiffnessLower.includes('bền')) return 'Độ bền';
  if (stiffnessLower.includes('kiểm soát')) return 'Kiểm soát';
  return 'Trợ lực / Âm thanh';
}

function resolveStringBrand(brand: Product['brand']): StringOption['brand'] {
  if (brand === 'Lining') return 'Lining';
  if (brand === 'Victor') return 'Victor';
  return 'Yonex';
}

async function getStringOptions(): Promise<StringOption[]> {
  await delay(SIMULATED_LATENCY);
  try {
    const products = await getProducts();
    const stringProducts = products.filter((product) => product.category === 'Cước');

    if (stringProducts.length > 0) {
      return stringProducts.map((product) => ({
        id: product.id,
        name: product.name,
        brand: resolveStringBrand(product.brand),
        type: resolveStringType(product.specs.stiffness),
        thickness: product.attributes?.find((attribute) => attribute.code === 'thickness')?.value || '0.65mm',
        price: product.price,
        colors: product.colors || []
      }));
    }
  } catch (error) {
    console.warn('Failed to fetch dynamic string options from API:', error);
  }

  return JSON.parse(JSON.stringify(rawData.stringOptions)) as StringOption[];
}

async function getConstants() {
  return JSON.parse(JSON.stringify(rawData.constants));
}

async function createOrder(orderData: CreateOrderPayload) {
  const response = await fetch(`${OMS_API_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`Failed to create order: ${errorText}`) as any;
    error.status = response.status;
    throw error;
  }

  return response.json();
}

async function sendOtp(phoneNumber: string): Promise<SendOtpResponse> {
  const response = await fetch(`${OMS_API_URL}/api/sms/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: phoneNumber })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw {
      status: response.status,
      message: errorData.detail || 'Failed to send OTP'
    };
  }

  return response.json();
}

async function verifyOtp(phoneNumber: string, otpCode: string): Promise<VerifyOtpResponse> {
  const response = await fetch(`${OMS_API_URL}/api/sms/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: phoneNumber, otp_code: otpCode })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw {
      status: response.status,
      message: errorData.detail || 'Failed to verify OTP'
    };
  }

  return response.json();
}

async function findOrCreateCustomer(customer: OmsCustomerInput): Promise<number> {
  const existingCustomerId = await findExistingCustomerIdByPhone(customer.phone);
  if (existingCustomerId !== null) {
    return existingCustomerId;
  }

  const createResponse = await fetch(`${OMS_API_URL}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(customer)
  });

  if (createResponse.ok) {
    const created = (await createResponse.json()) as OmsCustomer;
    return created.id;
  }

  const fallbackCustomerId = await findExistingCustomerIdByPhone(customer.phone);
  if (fallbackCustomerId !== null) {
    return fallbackCustomerId;
  }

  const errorText = await createResponse.text();
  throw new Error(`Failed to create customer: ${errorText}`);
}

async function getOrCreateManualChannelId(): Promise<number> {
  const searchedChannels = await getChannels('MANUAL');
  const searchedManual = findManualChannel(searchedChannels);
  if (searchedManual) {
    return searchedManual.id;
  }

  const channels = await getChannels();
  const manual = findManualChannel(channels);
  if (manual) {
    return manual.id;
  }

  const activeChannel = channels.find((channel) => channel.is_active);
  if (activeChannel) {
    return activeChannel.id;
  }

  const createResponse = await fetch(`${OMS_API_URL}/channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: 'MANUAL',
      name: 'Manual',
      is_active: true
    })
  });

  if (createResponse.ok) {
    const created = (await createResponse.json()) as OmsChannel;
    return created.id;
  }

  const errorText = await createResponse.text();
  throw new Error(`Failed to resolve channel: ${errorText}`);
}

async function getOrCreateStorefrontChannelId(): Promise<number> {
  const searchedChannels = await getChannels('STOREFRONT');
  const searchedStorefront = findStorefrontChannel(searchedChannels);
  if (searchedStorefront) {
    return searchedStorefront.id;
  }

  const channels = await getChannels();
  const storefront = findStorefrontChannel(channels);
  if (storefront) {
    return storefront.id;
  }

  const activeChannel = channels.find((channel) => channel.is_active);
  if (activeChannel) {
    return activeChannel.id;
  }

  const createResponse = await fetch(`${OMS_API_URL}/channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: 'STOREFRONT',
      name: 'Storefront',
      is_active: true
    })
  });

  if (createResponse.ok) {
    const created = (await createResponse.json()) as OmsChannel;
    return created.id;
  }

  const errorText = await createResponse.text();
  throw new Error(`Failed to resolve channel: ${errorText}`);
}

export const sportApi = {
  getProducts,
  getProductById,
  getBlogs,
  getCategories,
  getBlogById,
  getBranches,
  getStringOptions,
  getConstants,
  createOrder,
  sendOtp,
  verifyOtp,
  findOrCreateCustomer,
  getOrCreateManualChannelId,
  getOrCreateStorefrontChannelId
};

