import { OMS_API_URL } from './constants';
import { OmsChannel, OmsPaginatedChannels, OmsPaginatedCustomers } from './types';

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

export async function findExistingCustomerIdByPhone(phone: string): Promise<number | null> {
  const normalizedPhone = normalizePhone(phone);
  const searchRes = await fetch(
    `${OMS_API_URL}/customers?search=${encodeURIComponent(phone)}&limit=100`
  );

  if (!searchRes.ok) {
    return null;
  }

  const data = (await searchRes.json()) as OmsPaginatedCustomers;
  const existing = (data.items || []).find(
    (customer) => normalizePhone(customer.phone || '') === normalizedPhone
  );

  return existing ? existing.id : null;
}

export async function getChannels(search?: string): Promise<OmsChannel[]> {
  const query = search
    ? `?search=${encodeURIComponent(search)}&limit=100`
    : '?limit=100';

  const response = await fetch(`${OMS_API_URL}/channels${query}`);
  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as OmsPaginatedChannels;
  return data.items || [];
}

export function findManualChannel(channels: OmsChannel[]): OmsChannel | undefined {
  return channels.find((channel) => channel.is_active && channel.code?.toUpperCase() === 'MANUAL');
}
