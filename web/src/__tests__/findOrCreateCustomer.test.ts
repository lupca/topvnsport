import { describe, expect, test, vi, afterEach } from 'vitest';
import { sportApi } from '../services/sport-api';

describe('findOrCreateCustomer', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('should return customer id when POST /customers returns 200 for existing customer', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        id: 42,
        name: 'Existing Customer',
        phone: '0382426669',
        email: 'existing@example.com',
        address: '123 Street'
      })
    } as Response);

    const customerId = await sportApi.findOrCreateCustomer({
      name: 'Existing Customer',
      phone: '0382426669',
      email: 'existing@example.com',
      address: '123 Street'
    });

    expect(customerId).toBe(42);
  });

  test('should return customer id when POST /customers returns 201 for new customer', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () => Promise.resolve({
        id: 100,
        name: 'New Customer',
        phone: '0988888888',
        email: 'new@example.com',
        address: '456 Street'
      })
    } as Response);

    const customerId = await sportApi.findOrCreateCustomer({
      name: 'New Customer',
      phone: '0988888888',
      email: 'new@example.com',
      address: '456 Street'
    });

    expect(customerId).toBe(100);
  });

  test('should return customer id when POST /customers returns 409 conflict with customer data', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () => Promise.resolve({
        id: 55,
        name: 'Conflicting Customer',
        phone: '0999999999',
        email: 'conflict@example.com',
        address: '789 Street'
      })
    } as Response);

    const customerId = await sportApi.findOrCreateCustomer({
      name: 'Conflicting Customer',
      phone: '0999999999',
      email: 'conflict@example.com',
      address: '789 Street'
    });

    expect(customerId).toBe(55);
  });

  test('should throw error when POST /customers returns 500', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('Not JSON')),
      text: () => Promise.resolve('Internal Server Error')
    } as Response);

    await expect(sportApi.findOrCreateCustomer({
      name: 'Test Customer',
      phone: '0111111111',
      email: 'test@example.com',
      address: '000 Street'
    })).rejects.toThrow('Failed to create customer: Internal Server Error');
  });

  test('should throw error when POST /customers returns 400 without customer data', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.reject(new Error('Not JSON')),
      text: () => Promise.resolve('{"detail":"Bad request"}')
    } as Response);

    await expect(sportApi.findOrCreateCustomer({
      name: 'Test Customer',
      phone: '0222222222',
      email: 'bad@example.com',
      address: '111 Street'
    })).rejects.toThrow('Failed to create customer');
  });
});
